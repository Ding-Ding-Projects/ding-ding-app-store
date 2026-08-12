import { z } from 'zod';
import { access, readFile, unlink } from 'node:fs/promises';
import { writeJsonAtomic } from './json-store.js';
import type { AuthenticatorVault, AuthenticatorVaultHistorySnapshot } from './authenticator-vault-contract.js';
import { entryMetadataSchema, authenticatorGroupSchema, normalizeAuthenticatorGroups } from './authenticator-metadata.js';

const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  metadata: z.array(z.unknown()).max(10_000),
  groups: z.array(z.unknown()).max(64),
  ciphertext: z.array(z.strictObject({ entryId: z.string().uuid(), base64: z.string().max(2_800_000) })).max(10_000),
});
const journalSchema = z.strictObject({
  schemaVersion: z.literal(1),
  phase: z.enum(['applying', 'committed']),
  previous: snapshotSchema,
  target: snapshotSchema,
});

async function removeJournal(pathname: string): Promise<void> {
  try { await unlink(pathname); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    const integrity = new Error('The authenticator history journal could not be removed safely.') as NodeJS.ErrnoException;
    integrity.code = 'EINTEGRITY';
    (integrity as NodeJS.ErrnoException & { cause?: unknown }).cause = error;
    throw integrity;
  }
}

/** Bridges the OS-vault authenticator into local history without exposing secrets. */
export class AuthenticatorHistoryParticipant {
  constructor(private readonly vault: AuthenticatorVault, private readonly journalPath?: string) {}

  async snapshot(): Promise<string | null> {
    if (!this.vault.createHistorySnapshot) return null;
    if (this.vault.supportsAtomicNoFollow && !this.vault.supportsAtomicNoFollow()) return null;
    const value = await this.vault.createHistorySnapshot();
    return value ? `${JSON.stringify(value)}\n` : null;
  }

  async restore(content: string, options?: { shouldCommit?: () => boolean; recovery?: boolean }): Promise<void> {
    if (!this.vault.restoreHistorySnapshot) throw new Error('Authenticator history restore is unavailable.');
    if (this.vault.supportsAtomicNoFollow && !this.vault.supportsAtomicNoFollow()) {
      const unsupported = new Error('Protected authenticator restore is unavailable because atomic no-follow vault operations are unsupported on this platform.') as NodeJS.ErrnoException;
      unsupported.code = 'EUNSUPPORTED';
      throw unsupported;
    }
    if (this.journalPath && !options?.recovery) {
      try {
        await access(this.journalPath);
        const integrity = new Error('Authenticator history recovery is pending; startup recovery must complete before another restore.') as NodeJS.ErrnoException;
        integrity.code = 'EINTEGRITY';
        throw integrity;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    const parsed = snapshotSchema.safeParse(JSON.parse(content));
    if (!parsed.success) throw new Error('The authenticator history snapshot was invalid.');
    const metadata = parsed.data.metadata.map((value) => entryMetadataSchema.parse(value));
    const groups = normalizeAuthenticatorGroups(parsed.data.groups.map((value) => authenticatorGroupSchema.parse(value)));
    const ids = new Set(metadata.map((entry) => entry.id));
    if (new Set(metadata.map((entry) => entry.order)).size !== metadata.length || metadata.some((entry, index) => entry.order !== index || (entry.groupId !== null && !groups.some((group) => group.id === entry.groupId)))) throw new Error('The authenticator history snapshot metadata was invalid.');
    if (parsed.data.ciphertext.length !== ids.size || new Set(parsed.data.ciphertext.map((item) => item.entryId)).size !== parsed.data.ciphertext.length) throw new Error('The authenticator history ciphertext set was invalid.');
    const target = { schemaVersion: 1 as const, metadata, groups, ciphertext: parsed.data.ciphertext };
    const previous = await this.vault.createHistorySnapshot?.() ?? null;
    if (!previous) {
      const unavailable = new Error('Protected authenticator restore is unavailable because the current vault cannot be snapshotted safely.') as NodeJS.ErrnoException;
      unavailable.code = 'EUNSUPPORTED';
      throw unavailable;
    }
    if (this.journalPath && previous) await writeJsonAtomic(this.journalPath, { schemaVersion: 1, phase: 'applying', previous, target });
    try {
      await this.vault.restoreHistorySnapshot(target, options);
      if (this.journalPath && previous) await writeJsonAtomic(this.journalPath, { schemaVersion: 1, phase: 'committed', previous, target });
      if (this.journalPath) await removeJournal(this.journalPath);
    } catch (error) {
      try {
        if (previous) await this.vault.restoreHistorySnapshot(previous, { recovery: true });
        if (this.journalPath) await removeJournal(this.journalPath);
      } catch (rollbackError) {
        const uncertain = new Error('Authenticator history restore failed and its rollback could not be verified.') as NodeJS.ErrnoException;
        uncertain.code = 'EINTEGRITY';
        (uncertain as NodeJS.ErrnoException & { cause?: unknown }).cause = rollbackError;
        throw uncertain;
      }
      throw error;
    }
  }

  async recover(): Promise<void> {
    if (!this.journalPath || !this.vault.restoreHistorySnapshot) return;
    try { await access(this.journalPath); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw new Error('The authenticator history recovery journal could not be inspected safely.');
    }
    try {
      const raw: unknown = JSON.parse(await readFile(this.journalPath, 'utf8'));
      const journal = journalSchema.safeParse(raw);
      if (!journal.success) throw new Error('invalid journal');
      if (journal.data.phase === 'committed') { await removeJournal(this.journalPath); return; }
      const parsed = snapshotSchema.safeParse(journal.data.previous);
      if (!parsed.success) throw new Error('invalid journal');
      const metadata = parsed.data.metadata.map((item) => entryMetadataSchema.parse(item));
      const groups = normalizeAuthenticatorGroups(parsed.data.groups.map((item) => authenticatorGroupSchema.parse(item)));
      await this.vault.restoreHistorySnapshot({ schemaVersion: 1, metadata, groups, ciphertext: parsed.data.ciphertext });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EUNSUPPORTED' || (error as NodeJS.ErrnoException).code === 'EINTEGRITY') throw error;
      throw new Error('The authenticator history recovery journal was invalid; it was retained for recovery.');
    }
    await removeJournal(this.journalPath);
  }
}
