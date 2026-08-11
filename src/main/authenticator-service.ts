import { randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  AUTHENTICATOR_ALGORITHMS,
  AUTHENTICATOR_DIGITS,
  AUTHENTICATOR_MAX_ACCOUNT_LENGTH,
  AUTHENTICATOR_MAX_ENTRIES,
  AUTHENTICATOR_MAX_EXPORT_LENGTH,
  AUTHENTICATOR_MAX_GROUP_LENGTH,
  AUTHENTICATOR_MAX_ISSUER_LENGTH,
  AUTHENTICATOR_MAX_LABEL_LENGTH,
  AUTHENTICATOR_MAX_SECRET_LENGTH,
  type AuthenticatorEntry,
  type AuthenticatorEntryMetadata,
  type AuthenticatorBulkDeleteRequest,
  type AuthenticatorBulkDeleteResult,
  type AuthenticatorDeleteRequest,
  type AuthenticatorDeleteResult,
  type AuthenticatorExportRequest,
  type AuthenticatorExportResult,
  type AuthenticatorExportOmittedField,
  type AuthenticatorGroupRequest,
  type AuthenticatorListResult,
  type AuthenticatorMutationResult,
  type AuthenticatorPreviewRequest,
  type AuthenticatorPreviewResult,
  type AuthenticatorRegistrationConfirmRequest,
  type AuthenticatorRegistrationPreviewResult,
  type AuthenticatorRegistrationRequest,
  type AuthenticatorRenameRequest,
  type AuthenticatorReorderRequest,
  type AuthenticatorStatus,
} from '../shared/contracts.js';
import { createAuthenticatorQr } from './authenticator-qr.js';
import { canonicalAuthenticatorUri, parseAuthenticatorUri, type ParsedAuthenticatorUri } from './authenticator-uri.js';
import { UnavailableAuthenticatorVault, type AuthenticatorVault } from './authenticator-vault-contract.js';
import { entryMetadataSchema } from './authenticator-metadata.js';
import { generateTotp, MAX_TOTP_TIMESTAMP_MS, normalizeBase32Secret } from './totp.js';

const algorithmSchema = z.enum(AUTHENTICATOR_ALGORITHMS);
const digitsSchema = z.union(AUTHENTICATOR_DIGITS.map((value) => z.literal(value)) as [z.ZodLiteral<6>, z.ZodLiteral<7>, z.ZodLiteral<8>]);
const previewRequestSchema = z.strictObject({
  secret: z.string().min(1).max(AUTHENTICATOR_MAX_SECRET_LENGTH),
  algorithm: algorithmSchema,
  digits: digitsSchema,
  periodSeconds: z.number().int().min(1).max(3_600),
  atMs: z.number().int().min(0).max(MAX_TOTP_TIMESTAMP_MS).optional(),
});
const registrationRequestSchema = z.discriminatedUnion('source', [
  z.strictObject({ source: z.literal('otpauth-uri'), uri: z.string().min(1).max(2_048) }),
  z.strictObject({
    source: z.literal('manual'),
    secret: z.string().min(1).max(AUTHENTICATOR_MAX_SECRET_LENGTH),
    issuer: z.string().max(AUTHENTICATOR_MAX_ISSUER_LENGTH),
    account: z.string().min(1).max(AUTHENTICATOR_MAX_ACCOUNT_LENGTH),
    algorithm: algorithmSchema,
    digits: digitsSchema,
    periodSeconds: z.number().int().min(1).max(3_600),
  }),
]);
const confirmRequestSchema = z.strictObject({
  registrationId: z.string().uuid(),
  code: z.string().regex(/^\d{6,8}$/),
});
const MAX_PENDING_REGISTRATIONS = 8;
const PENDING_TTL_MS = 10 * 60 * 1_000;
const MAX_CONFIRM_ATTEMPTS = 5;
const uuidSchema = z.string().uuid();
const entryIdRequestSchema = z.strictObject({ entryId: uuidSchema });
const renameRequestSchema = z.strictObject({ entryId: uuidSchema, label: z.string().min(1).max(AUTHENTICATOR_MAX_LABEL_LENGTH) });
const groupRequestSchema = z.strictObject({ entryId: uuidSchema, group: z.string().max(AUTHENTICATOR_MAX_GROUP_LENGTH).nullable() });
const reorderRequestSchema = z.strictObject({ entryId: uuidSchema, order: z.number().int().min(0).max(AUTHENTICATOR_MAX_ENTRIES - 1) });
const deleteRequestSchema = z.strictObject({ entryId: uuidSchema, confirmed: z.literal(true) });
const uniqueIds = (ids: string[]) => new Set(ids).size === ids.length;
const bulkDeleteRequestSchema = z.strictObject({ entryIds: z.array(uuidSchema).min(1).max(AUTHENTICATOR_MAX_ENTRIES).refine(uniqueIds), confirmed: z.literal(true) });
const exportRequestSchema = z.strictObject({ entryIds: z.array(uuidSchema).min(1).max(AUTHENTICATOR_MAX_ENTRIES).refine(uniqueIds), format: z.enum(['json', 'csv', 'markdown']) });

interface PendingRegistration {
  registrationId: string;
  metadata: AuthenticatorEntryMetadata;
  secret: string;
  uri: string;
  createdAtMs: number;
  attempts: number;
  expiryTimer?: ReturnType<typeof setTimeout>;
  cancelled?: boolean;
  confirming?: boolean;
}

function failure(message: string, messageYue: string): AuthenticatorPreviewResult {
  return { ok: false, storage: 'memory-only', message, messageYue };
}

function registrationFailure(message: string, messageYue: string): AuthenticatorRegistrationPreviewResult {
  return { ok: false, storage: 'memory-only', message, messageYue };
}

function mutationFailure(message: string, messageYue: string): AuthenticatorMutationResult {
  return { ok: false, message, messageYue };
}

function deleteFailure(message: string, messageYue: string): AuthenticatorDeleteResult {
  return { ok: false, message, messageYue };
}

function bulkDeleteFailure(message: string, messageYue: string, skippedIds: string[] = [], uncertainIds: string[] = []): AuthenticatorBulkDeleteResult {
  return { ok: false, deletedIds: [], skippedIds, uncertainIds, message, messageYue };
}

const EXPORT_OMITTED_FIELDS: AuthenticatorExportOmittedField[] = ['secret', 'uri', 'code', 'nextCode', 'remainingSeconds', 'expiresAt'];

function exportFailure(message: string, messageYue: string): AuthenticatorExportResult {
  return { ok: false, omittedFields: [...EXPORT_OMITTED_FIELDS], message, messageYue };
}

function clockFailure(message: string, messageYue: string): AuthenticatorMutationResult {
  return mutationFailure(message, messageYue);
}

function cancelledPairingFailure(rolledBack: boolean): AuthenticatorMutationResult {
  return rolledBack
    ? mutationFailure('Authenticator pairing was discarded; no entry was kept.', 'Authenticator 配對已丟棄；冇保留項目。')
    : mutationFailure('Authenticator pairing was discarded, but the saved entry could not be rolled back safely.', 'Authenticator 配對已丟棄，但未能安全回復已儲存項目。');
}

function confirmationInProgressFailure(): AuthenticatorMutationResult {
  return mutationFailure('A pairing confirmation is already in progress; wait for it to finish.', '配對確認進行緊；請等佢完成。');
}

function normalizeField(value: string, max: number, field: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) throw new Error(`The authenticator ${field} is invalid.`);
  return normalized;
}

function normalizeOptionalField(value: string, max: number, field: string): string {
  const normalized = value.trim();
  if (!normalized) return '';
  if (normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) throw new Error(`The authenticator ${field} is invalid.`);
  return normalized;
}

function metadataFor(parsed: ParsedAuthenticatorUri, order: number): AuthenticatorEntryMetadata {
  const now = new Date().toISOString();
  const label = parsed.issuer ? `${parsed.issuer} · ${parsed.account}` : parsed.account;
  return entryMetadataSchema.parse({
    id: randomUUID(),
    issuer: parsed.issuer,
    account: parsed.account,
    label,
    algorithm: parsed.algorithm,
    digits: parsed.digits,
    periodSeconds: parsed.periodSeconds,
    createdAt: now,
    updatedAt: now,
    order,
    group: null,
  }) as AuthenticatorEntryMetadata;
}

function sameCode(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected, 'utf8');
  const actualBytes = Buffer.from(actual, 'utf8');
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

export class AuthenticatorService {
  private readonly pending = new Map<string, PendingRegistration>();
  private metadataMutationSerial: Promise<void> = Promise.resolve();
  private restricted = false;
  private restrictionGeneration = 0;

  constructor(private readonly vault: AuthenticatorVault = new UnavailableAuthenticatorVault()) {}

  /** Main-process School-mode transition hook; restricted mode clears pending secrets. */
  setRestricted(restricted: boolean): void {
    if (this.restricted !== restricted) this.restrictionGeneration += 1;
    this.restricted = restricted;
    if (restricted) this.clearPending();
  }

  private capabilityIsLive(generation: number): boolean {
    return !this.restricted && this.restrictionGeneration === generation;
  }

  private restrictedList(): AuthenticatorListResult {
    return {
      entries: [],
      storage: 'memory-only',
      message: 'Authenticator entries are unavailable while the shared restricted mode is enabled or unavailable.',
      messageYue: '共享限制模式開啟或不可用時，驗證器項目暫時唔可用。',
    };
  }

  private restrictedStatus(): AuthenticatorStatus {
    return {
      available: false,
      vault: 'unavailable',
      entryCount: 0,
      checkedAt: new Date().toISOString(),
      message: 'Authenticator is unavailable while the shared restricted mode is enabled or unavailable.',
      messageYue: '共享限制模式開啟或不可用時，驗證器暫時唔可用。',
    };
  }

  private async rollbackAfterRestriction(entryId: string): Promise<boolean> {
    try {
      await this.vault.remove(entryId);
      return true;
    } catch {
      return false;
    }
  }

  private restrictedDelete(): AuthenticatorDeleteResult {
    return deleteFailure('Authenticator entry management is unavailable while the shared restricted mode is enabled or unavailable.', '共享限制模式開啟或不可用時，驗證器項目管理暫時唔可用。');
  }

  private restrictedBulkDelete(): AuthenticatorBulkDeleteResult {
    return bulkDeleteFailure('Authenticator bulk management is unavailable while the shared restricted mode is enabled or unavailable.', '共享限制模式開啟或不可用時，驗證器批量管理暫時唔可用。');
  }

  private restrictedExport(): AuthenticatorExportResult {
    return exportFailure('Authenticator metadata export is unavailable while the shared restricted mode is enabled or unavailable.', '共享限制模式開啟或不可用時，驗證器 metadata 匯出暫時唔可用。');
  }

  private withMetadataSerial<T>(operation: () => Promise<T>): Promise<T> {
    const current = this.metadataMutationSerial.then(operation, operation);
    this.metadataMutationSerial = current.then(() => undefined, () => undefined);
    return current;
  }

  private async readMutableMetadata(generation: number): Promise<AuthenticatorEntryMetadata[] | null> {
    if (!this.capabilityIsLive(generation) || await this.vault.status() === 'unavailable') return null;
    const metadata = await this.vault.listMetadata();
    return this.capabilityIsLive(generation) ? metadata.slice(0, AUTHENTICATOR_MAX_ENTRIES) : null;
  }

  private async publishMetadataMutation(before: AuthenticatorEntryMetadata[], next: AuthenticatorEntryMetadata[], generation: number): Promise<boolean | null> {
    try {
      await this.vault.writeMetadata(next, { shouldCommit: () => this.capabilityIsLive(generation) });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EINTEGRITY') return null;
      return (error as NodeJS.ErrnoException).code === 'ECANCELED' || !this.capabilityIsLive(generation) ? false : null;
    }
    if (this.capabilityIsLive(generation)) return true;
    // The writer has its own publication fence, but a transition can happen
    // immediately after its atomic rename. Restore the previous redacted
    // document before reporting a restricted failure.
    return await this.vault.writeMetadata(before).then(() => false, () => null);
  }

  private normalizeGroup(value: string | null): string | null {
    if (value === null) return null;
    const normalized = value.trim();
    if (!normalized || normalized.length > AUTHENTICATOR_MAX_GROUP_LENGTH || /[\u0000-\u001f\u007f]/.test(normalized)) throw new Error('The authenticator group is invalid.');
    return normalized;
  }

  private normalizeLabel(value: string): string {
    return normalizeField(value, AUTHENTICATOR_MAX_LABEL_LENGTH, 'label');
  }

  async status(): Promise<AuthenticatorStatus> {
    if (this.restricted) return this.restrictedStatus();
    const generation = this.restrictionGeneration;
    const vault = await this.vault.status();
    if (!this.capabilityIsLive(generation)) return this.restrictedStatus();
    let entryCount = 0;
    if (vault !== 'unavailable') {
      try {
        entryCount = (await this.vault.listMetadata()).length;
        if (!this.capabilityIsLive(generation)) return this.restrictedStatus();
      } catch {
        if (!this.capabilityIsLive(generation)) return this.restrictedStatus();
        entryCount = 0;
      }
    }
    return {
      available: vault !== 'unavailable',
      vault,
      entryCount,
      checkedAt: new Date().toISOString(),
      message: vault === 'unavailable'
        ? 'Persistent authenticator entries are unavailable until the operating-system credential-vault adapter is ready. One-shot previews stay in memory only.'
        : 'Authenticator metadata is local and secrets are held by the operating-system credential vault.',
      messageYue: vault === 'unavailable'
        ? '未接駁作業系統憑證庫配接器之前，唔可以儲存 authenticator 項目；一次性預覽只留喺記憶體。'
        : 'Authenticator metadata 留喺本機，秘密由作業系統憑證庫保管。',
    };
  }

  /** Calculate one current code without persisting the submitted secret. */
  async preview(request: AuthenticatorPreviewRequest, options: { deterministicClock?: boolean } = {}): Promise<AuthenticatorPreviewResult> {
    if (this.restricted) return failure('Authenticator preview is unavailable while the shared restricted mode is enabled or unavailable.', '共享限制模式開啟或不可用時，驗證器預覽暫時唔可用。');
    const parsed = previewRequestSchema.safeParse(request);
    if (!parsed.success) return failure('The authenticator preview request was invalid.', 'Authenticator 預覽要求無效。');
    try {
      const result = generateTotp({
        secret: parsed.data.secret,
        algorithm: parsed.data.algorithm,
        digits: parsed.data.digits,
        periodSeconds: parsed.data.periodSeconds,
        timestampMs: options.deterministicClock ? parsed.data.atMs : undefined,
      });
      return {
        ok: true,
        code: result.code,
        remainingSeconds: result.remainingSeconds,
        expiresAt: new Date(result.expiresAtMs).toISOString(),
        algorithm: parsed.data.algorithm,
        digits: parsed.data.digits,
        periodSeconds: parsed.data.periodSeconds,
        storage: 'memory-only',
        message: 'Preview calculated in memory; the secret was not stored or exported.',
        messageYue: '預覽只喺記憶體計算；秘密冇儲存或者匯出。',
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('timestamp')) {
        return failure('The system clock is outside the supported range; no authenticator code was calculated.', '系統時鐘超出支援範圍；未有計算 authenticator 驗證碼。');
      }
      return failure('The authenticator secret or parameters were not accepted.', 'Authenticator 秘密或者參數唔獲接受。');
    }
  }

  /** Prepare a QR pairing preview; persistence waits for a current-code confirmation. */
  async prepare(request: AuthenticatorRegistrationRequest): Promise<AuthenticatorRegistrationPreviewResult> {
    if (this.restricted) return registrationFailure('Authenticator registration is unavailable while the shared restricted mode is enabled or unavailable.', '共享限制模式開啟或不可用時，驗證器登記暫時唔可用。');
    const generation = this.restrictionGeneration;
    const parsedRequest = registrationRequestSchema.safeParse(request);
    if (!parsedRequest.success) return registrationFailure('The authenticator registration request was invalid.', 'Authenticator 註冊要求無效。');
    const vaultStatus = await this.vault.status();
    if (!this.capabilityIsLive(generation)) return registrationFailure('Authenticator registration is unavailable while the shared restricted mode is enabled or unavailable.', '共享限制模式開啟或不可用時，驗證器登記暫時唔可用。');
    if (vaultStatus === 'unavailable') return registrationFailure('The operating-system credential vault is unavailable; no authenticator entry was created.', '作業系統憑證庫未能使用；未有建立 authenticator 項目。');
    if (!this.capabilityIsLive(generation)) return registrationFailure('Authenticator registration is unavailable while the shared restricted mode is enabled or unavailable.', '共享限制模式開啟或不可用時，驗證器登記暫時唔可用。');
    this.expirePending();
    if (this.pending.size >= MAX_PENDING_REGISTRATIONS) return registrationFailure('Too many unfinished authenticator pairings are open; finish or wait for one to expire.', '未完成嘅 authenticator 配對太多；完成一個或者等佢過期。');
    try {
      const parsed = parsedRequest.data.source === 'otpauth-uri'
        ? parseAuthenticatorUri(parsedRequest.data.uri)
        : {
            issuer: normalizeOptionalField(parsedRequest.data.issuer, AUTHENTICATOR_MAX_ISSUER_LENGTH, 'issuer'),
            account: normalizeField(parsedRequest.data.account, AUTHENTICATOR_MAX_ACCOUNT_LENGTH, 'account'),
            secret: normalizeBase32Secret(parsedRequest.data.secret),
            algorithm: parsedRequest.data.algorithm,
            digits: parsedRequest.data.digits,
            periodSeconds: parsedRequest.data.periodSeconds,
      };
      const metadataEntries = await this.vault.listMetadata();
      if (!this.capabilityIsLive(generation)) return registrationFailure('Authenticator registration is unavailable while the shared restricted mode is enabled or unavailable.', '共享限制模式開啟或不可用時，驗證器登記暫時唔可用。');
      if (metadataEntries.length >= AUTHENTICATOR_MAX_ENTRIES) return registrationFailure('The authenticator entry limit has been reached; delete an entry before registering another.', '驗證器項目已達上限；刪除一個項目先可以再註冊。');
      const metadata = metadataFor(parsed, metadataEntries.length);
      const uri = canonicalAuthenticatorUri(parsed);
      const qr = createAuthenticatorQr(uri);
      if (!this.capabilityIsLive(generation)) return registrationFailure('Authenticator registration is unavailable while the shared restricted mode is enabled or unavailable.', '共享限制模式開啟或不可用時，驗證器登記暫時唔可用。');
      const registrationId = randomUUID();
      const pending: PendingRegistration = { registrationId, metadata, secret: parsed.secret, uri, createdAtMs: Date.now(), attempts: 0 };
      this.pending.set(registrationId, pending);
      pending.expiryTimer = setTimeout(() => {
        if (this.pending.get(registrationId) === pending) this.removePending(registrationId);
      }, PENDING_TTL_MS + 1);
      pending.expiryTimer.unref?.();
      return {
        ok: true,
        registrationId,
        metadata,
        qr,
        storage: 'memory-only',
        message: 'Pairing preview is held in memory. Confirm one current code to save this entry in the operating-system credential vault.',
        messageYue: '配對預覽只留喺記憶體；確認一個目前驗證碼之後，先會將項目儲入作業系統憑證庫。',
      };
    } catch {
      return registrationFailure('The authenticator URI, Base32 secret, or metadata was not accepted.', 'Authenticator URI、Base32 秘密或者 metadata 唔獲接受。');
    }
  }

  async confirm(request: AuthenticatorRegistrationConfirmRequest): Promise<AuthenticatorMutationResult> {
    if (this.restricted) return mutationFailure('Authenticator pairing is unavailable while the shared restricted mode is enabled or unavailable.', '共享限制模式開啟或不可用時，驗證器配對暫時唔可用。');
    const generation = this.restrictionGeneration;
    const parsed = confirmRequestSchema.safeParse(request);
    if (!parsed.success) return mutationFailure('The authenticator pairing confirmation was invalid.', 'Authenticator 配對確認無效。');
    const pending = this.pending.get(parsed.data.registrationId);
    if (!pending || Date.now() - pending.createdAtMs > PENDING_TTL_MS) {
      this.removePending(parsed.data.registrationId);
      return mutationFailure('That authenticator pairing preview has expired; start it again.', '嗰個 authenticator 配對預覽已過期；請重新開始。');
    }
    if (pending.confirming) return confirmationInProgressFailure();
    pending.confirming = true;
    pending.attempts += 1;
    const now = Date.now();
    const maximumPairingClock = MAX_TOTP_TIMESTAMP_MS - pending.metadata.periodSeconds * 1_000;
    if (!Number.isFinite(now) || now < 0 || now > maximumPairingClock) {
      pending.confirming = false;
      return clockFailure('The system clock is outside the supported range; no pairing code was accepted.', '系統時鐘超出支援範圍；未有接受配對驗證碼。');
    }
    const matches = [-1, 0, 1].some((offset) => {
      try {
        const candidate = generateTotp({ secret: pending.secret, algorithm: pending.metadata.algorithm, digits: pending.metadata.digits, periodSeconds: pending.metadata.periodSeconds, timestampMs: Math.max(0, now + offset * pending.metadata.periodSeconds * 1_000) }).code;
        return sameCode(candidate, parsed.data.code);
      } catch { return false; }
    });
    if (!matches) {
      if (pending.attempts >= MAX_CONFIRM_ATTEMPTS) this.removePending(parsed.data.registrationId);
      else pending.confirming = false;
      return mutationFailure('The pairing code did not match; no secret was saved.', '配對驗證碼唔相符；秘密冇儲存。');
    }
    if (!this.capabilityIsLive(generation)) {
      this.removePending(parsed.data.registrationId);
      return mutationFailure('Authenticator pairing is unavailable while the shared restricted mode is enabled or unavailable.', '共享限制模式開啟或不可用時，驗證器配對暫時唔可用。');
    }
    let publishedByThisConfirmation = false;
    let savedMetadata = pending.metadata;
    try {
      await this.withMetadataSerial(async () => {
        const currentMetadata = await this.vault.listMetadata();
        if (!this.capabilityIsLive(generation) || pending.cancelled || this.pending.get(pending.registrationId) !== pending) throw new Error('Authenticator pairing was cancelled before publication.');
        const ordered = currentMetadata.slice().sort((left, right) => left.order - right.order || left.createdAt.localeCompare(right.createdAt));
        if (ordered.length >= AUTHENTICATOR_MAX_ENTRIES) {
          const capacity = new Error('The authenticator entry limit has been reached.') as NodeJS.ErrnoException;
          capacity.code = 'EAUTHENTICATORCAPACITY';
          throw capacity;
        }
        savedMetadata = { ...pending.metadata, order: ordered.length, group: null };
        await this.vault.save(savedMetadata, pending.secret, { shouldCommit: () => this.capabilityIsLive(generation) && !pending.cancelled && this.pending.get(pending.registrationId) === pending });
      });
      pending.metadata = savedMetadata;
      publishedByThisConfirmation = true;
      if (!this.capabilityIsLive(generation) || pending.cancelled || this.pending.get(pending.registrationId) !== pending) {
        const cancelled = pending.cancelled || this.pending.get(pending.registrationId) !== pending;
        const rolledBack = publishedByThisConfirmation ? await this.rollbackAfterRestriction(pending.metadata.id) : true;
        this.removePending(parsed.data.registrationId);
        if (cancelled) return cancelledPairingFailure(rolledBack);
        return rolledBack
          ? mutationFailure('Authenticator pairing was cancelled because the shared restricted mode changed; no entry was kept.', '共享限制模式有變，所以 authenticator 配對已取消；冇保留項目。')
          : mutationFailure('Authenticator pairing was cancelled by the shared restricted mode, but the saved entry could not be rolled back safely.', '共享限制模式取消咗 authenticator 配對，但未能安全回復已儲存項目。');
      }
      this.removePending(parsed.data.registrationId);
      return {
        ok: true,
        entry: savedMetadata,
        message: 'Authenticator entry saved in the operating-system credential vault; the registration secret left memory.',
        messageYue: 'Authenticator 項目已儲入作業系統憑證庫；註冊秘密已離開記憶體。',
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EAUTHENTICATORCAPACITY') {
        this.removePending(parsed.data.registrationId);
        return mutationFailure('The authenticator entry limit has been reached; delete an entry before confirming this pairing.', '已經到咗 authenticator 項目上限；確認呢個配對之前請先刪除一個項目。');
      }
      if ((error as NodeJS.ErrnoException).code === 'EINTEGRITY' && (error as NodeJS.ErrnoException & { committed?: boolean }).committed) {
        const rolledBack = await this.rollbackAfterRestriction(pending.metadata.id);
        this.removePending(parsed.data.registrationId);
        return cancelledPairingFailure(rolledBack);
      }
      if (!this.capabilityIsLive(generation) || pending.cancelled || this.pending.get(pending.registrationId) !== pending) {
        const cancelled = pending.cancelled || this.pending.get(pending.registrationId) !== pending;
        const rolledBack = publishedByThisConfirmation ? await this.rollbackAfterRestriction(pending.metadata.id) : true;
        this.removePending(parsed.data.registrationId);
        if (cancelled) return cancelledPairingFailure(rolledBack);
        return rolledBack
          ? mutationFailure('Authenticator pairing was cancelled because the shared restricted mode changed; no entry was kept.', '共享限制模式有變，所以 authenticator 配對已取消；冇保留項目。')
          : mutationFailure('Authenticator pairing was cancelled by the shared restricted mode, but the saved entry could not be rolled back safely.', '共享限制模式取消咗 authenticator 配對，但未能安全回復已儲存項目。');
      }
      return mutationFailure('The credential vault could not save this entry; no plaintext fallback was used.', '憑證庫未能儲存項目；冇使用明文後備方案。');
    } finally {
      if (this.pending.get(parsed.data.registrationId) === pending) pending.confirming = false;
    }
  }

  /** Explicitly discard an unfinished pairing and its in-memory secret. */
  cancel(registrationId: string): void {
    if (!z.string().uuid().safeParse(registrationId).success) return;
    this.removePending(registrationId);
  }

  async rename(request: AuthenticatorRenameRequest): Promise<AuthenticatorMutationResult> {
    if (this.restricted) return mutationFailure('Authenticator entry management is unavailable while the shared restricted mode is enabled or unavailable.', '共享限制模式開啟或不可用時，驗證器項目管理暫時唔可用。');
    const parsed = renameRequestSchema.safeParse(request);
    if (!parsed.success) return mutationFailure('The authenticator rename request was invalid.', 'Authenticator 改名要求無效。');
    return this.withMetadataSerial(async () => {
      const generation = this.restrictionGeneration;
      try {
        const before = await this.readMutableMetadata(generation);
        if (!before) return mutationFailure('Authenticator metadata is unavailable or restricted.', 'Authenticator metadata 暫時用唔到或者受到限制。');
        const existing = before.find((entry) => entry.id === parsed.data.entryId);
        if (!existing) return mutationFailure('That authenticator entry no longer exists.', '嗰個 authenticator 項目已經唔存在。');
        const label = this.normalizeLabel(parsed.data.label);
        const updated: AuthenticatorEntryMetadata = { ...existing, label, updatedAt: new Date().toISOString() };
        const next = before.map((entry) => entry.id === updated.id ? updated : entry);
        const published = await this.publishMetadataMutation(before, next, generation);
        if (published !== true) return published === false
          ? mutationFailure('The authenticator rename was cancelled because the shared restricted mode changed.', '共享限制模式有變，所以 authenticator 改名已取消。')
          : mutationFailure('The authenticator rename could not be published or rolled back safely.', '未能安全發佈或者回復 authenticator 改名。');
        return { ok: true, entry: updated, message: 'Authenticator entry renamed; its credential-vault secret was not read or changed.', messageYue: 'Authenticator 項目已改名；憑證庫秘密冇被讀取或者改動。' };
      } catch {
        return mutationFailure('The authenticator entry could not be renamed safely.', '未能安全改動 authenticator 項目名稱。');
      }
    });
  }

  async setGroup(request: AuthenticatorGroupRequest): Promise<AuthenticatorMutationResult> {
    if (this.restricted) return mutationFailure('Authenticator entry management is unavailable while the shared restricted mode is enabled or unavailable.', '共享限制模式開啟或不可用時，驗證器項目管理暫時唔可用。');
    const parsed = groupRequestSchema.safeParse(request);
    if (!parsed.success) return mutationFailure('The authenticator group request was invalid.', 'Authenticator 分組要求無效。');
    return this.withMetadataSerial(async () => {
      const generation = this.restrictionGeneration;
      try {
        const before = await this.readMutableMetadata(generation);
        if (!before) return mutationFailure('Authenticator metadata is unavailable or restricted.', 'Authenticator metadata 暫時用唔到或者受到限制。');
        const existing = before.find((entry) => entry.id === parsed.data.entryId);
        if (!existing) return mutationFailure('That authenticator entry no longer exists.', '嗰個 authenticator 項目已經唔存在。');
        const group = this.normalizeGroup(parsed.data.group);
        const updated: AuthenticatorEntryMetadata = { ...existing, group, updatedAt: new Date().toISOString() };
        const next = before.map((entry) => entry.id === updated.id ? updated : entry);
        const published = await this.publishMetadataMutation(before, next, generation);
        if (published !== true) return published === false
          ? mutationFailure('The authenticator group change was cancelled because the shared restricted mode changed.', '共享限制模式有變，所以 authenticator 分組改動已取消。')
          : mutationFailure('The authenticator group change could not be published or rolled back safely.', '未能安全發佈或者回復 authenticator 分組改動。');
        return { ok: true, entry: updated, message: group ? 'Authenticator entry joined a local label-only group; no secret was read.' : 'Authenticator entry left its local group; no secret was read.', messageYue: group ? 'Authenticator 項目已加入本機純標籤分組；冇讀取秘密。' : 'Authenticator 項目已離開本機分組；冇讀取秘密。' };
      } catch {
        return mutationFailure('The authenticator group could not be changed safely.', '未能安全改動 authenticator 分組。');
      }
    });
  }

  async reorder(request: AuthenticatorReorderRequest): Promise<AuthenticatorMutationResult> {
    if (this.restricted) return mutationFailure('Authenticator entry management is unavailable while the shared restricted mode is enabled or unavailable.', '共享限制模式開啟或不可用時，驗證器項目管理暫時唔可用。');
    const parsed = reorderRequestSchema.safeParse(request);
    if (!parsed.success) return mutationFailure('The authenticator reorder request was invalid.', 'Authenticator 排序要求無效。');
    return this.withMetadataSerial(async () => {
      const generation = this.restrictionGeneration;
      try {
        const before = await this.readMutableMetadata(generation);
        if (!before) return mutationFailure('Authenticator metadata is unavailable or restricted.', 'Authenticator metadata 暫時用唔到或者受到限制。');
        const existing = before.find((entry) => entry.id === parsed.data.entryId);
        if (!existing) return mutationFailure('That authenticator entry no longer exists.', '嗰個 authenticator 項目已經唔存在。');
        const ordered = before.filter((entry) => entry.id !== existing.id);
        ordered.splice(Math.min(parsed.data.order, ordered.length), 0, existing);
        const now = new Date().toISOString();
        const next = ordered.map((entry, order) => entry.id === existing.id ? { ...entry, order, updatedAt: now } : { ...entry, order });
        const updated = next.find((entry) => entry.id === existing.id)!;
        const published = await this.publishMetadataMutation(before, next, generation);
        if (published !== true) return published === false
          ? mutationFailure('The authenticator reorder was cancelled because the shared restricted mode changed.', '共享限制模式有變，所以 authenticator 排序已取消。')
          : mutationFailure('The authenticator reorder could not be published or rolled back safely.', '未能安全發佈或者回復 authenticator 排序。');
        return { ok: true, entry: updated, message: 'Authenticator entry order updated without reading any secret.', messageYue: 'Authenticator 項目次序已更新，冇讀取任何秘密。' };
      } catch {
        return mutationFailure('The authenticator entry could not be reordered safely.', '未能安全重新排列 authenticator 項目。');
      }
    });
  }

  async remove(request: AuthenticatorDeleteRequest): Promise<AuthenticatorDeleteResult> {
    if (this.restricted) return this.restrictedDelete();
    const parsed = deleteRequestSchema.safeParse(request);
    if (!parsed.success) return deleteFailure('The authenticator delete request did not carry the native destructive confirmation.', 'Authenticator 刪除要求冇帶住原生破壞性確認。');
    return this.withMetadataSerial(async () => {
      const generation = this.restrictionGeneration;
      try {
        const before = await this.readMutableMetadata(generation);
        if (!before) return deleteFailure('Authenticator metadata is unavailable or restricted.', 'Authenticator metadata 暫時用唔到或者受到限制。');
        if (!before.some((entry) => entry.id === parsed.data.entryId)) return deleteFailure('That authenticator entry no longer exists.', '嗰個 authenticator 項目已經唔存在。');
        await this.vault.remove(parsed.data.entryId, { shouldCommit: () => this.capabilityIsLive(generation) });
        if (!this.capabilityIsLive(generation)) return { ok: false, deletedId: parsed.data.entryId, uncertain: true, message: 'The authenticator deletion completed as the shared restricted mode changed; refresh after leaving that mode.', messageYue: '共享限制模式改變時 authenticator 刪除已完成；離開限制模式後請重新整理。' };
        return { ok: true, deletedId: parsed.data.entryId, message: 'Authenticator entry and its credential-vault ciphertext were deleted.', messageYue: 'Authenticator 項目同憑證庫密文已刪除。' };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EINTEGRITY' && (error as NodeJS.ErrnoException & { committed?: boolean }).committed) {
          return { ok: false, deletedId: parsed.data.entryId, uncertain: true, message: 'The authenticator deletion reached an uncertain vault state; do not retry until the credential vault is checked.', messageYue: 'Authenticator 刪除令憑證庫狀態未能確定；檢查憑證庫之前唔好重試。' };
        }
        return deleteFailure('The authenticator entry could not be deleted safely.', '未能安全刪除 authenticator 項目。');
      }
    });
  }

  async bulkRemove(request: AuthenticatorBulkDeleteRequest): Promise<AuthenticatorBulkDeleteResult> {
    if (this.restricted) return this.restrictedBulkDelete();
    const parsed = bulkDeleteRequestSchema.safeParse(request);
    if (!parsed.success) return bulkDeleteFailure('The authenticator bulk-delete request was invalid or duplicated.', 'Authenticator 批量刪除要求無效或者有重複項目。');
    return this.withMetadataSerial(async () => {
      const generation = this.restrictionGeneration;
      const deletedIds: string[] = [];
      const skippedIds: string[] = [];
      const uncertainIds: string[] = [];
      try {
        const before = await this.readMutableMetadata(generation);
        if (!before) return bulkDeleteFailure('Authenticator metadata is unavailable or restricted.', 'Authenticator metadata 暫時用唔到或者受到限制。', parsed.data.entryIds);
        for (const entryId of parsed.data.entryIds) {
          if (!before.some((entry) => entry.id === entryId)) { skippedIds.push(entryId); continue; }
          try {
            await this.vault.remove(entryId, { shouldCommit: () => this.capabilityIsLive(generation) });
            deletedIds.push(entryId);
            if (!this.capabilityIsLive(generation)) { skippedIds.push(...parsed.data.entryIds.filter((id) => !deletedIds.includes(id))); break; }
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'EINTEGRITY' && (error as NodeJS.ErrnoException & { committed?: boolean }).committed) {
              deletedIds.push(entryId);
              uncertainIds.push(entryId);
              skippedIds.push(...parsed.data.entryIds.filter((id) => !deletedIds.includes(id) && id !== entryId));
              break;
            }
            skippedIds.push(entryId);
          }
        }
        const ok = skippedIds.length === 0 && uncertainIds.length === 0 && this.capabilityIsLive(generation);
        const uniqueSkipped = [...new Set(skippedIds)];
        const uniqueUncertain = [...new Set(uncertainIds)];
        return {
          ok,
          deletedIds,
          skippedIds: uniqueSkipped,
          uncertainIds: uniqueUncertain,
          message: ok ? `Deleted ${deletedIds.length} authenticator entries; no secrets were exported.` : `Deleted ${deletedIds.length} authenticator entries; ${uniqueSkipped.length} were skipped and ${uniqueUncertain.length} have uncertain rollback state.`,
          messageYue: ok ? `已刪除 ${deletedIds.length} 個 authenticator 項目；冇匯出秘密。` : `已刪除 ${deletedIds.length} 個 authenticator 項目；有 ${uniqueSkipped.length} 個跳過，${uniqueUncertain.length} 個回復狀態未能確定。`,
        };
      } catch {
        return bulkDeleteFailure('The authenticator bulk deletion could not complete safely.', '未能安全完成 authenticator 批量刪除。', parsed.data.entryIds.filter((id) => !deletedIds.includes(id)));
      }
    });
  }

  async export(request: AuthenticatorExportRequest): Promise<AuthenticatorExportResult> {
    if (this.restricted) return this.restrictedExport();
    const parsed = exportRequestSchema.safeParse(request);
    if (!parsed.success) return exportFailure('The authenticator metadata export request was invalid or duplicated.', 'Authenticator metadata 匯出要求無效或者有重複項目。');
    return this.withMetadataSerial(async () => {
      const generation = this.restrictionGeneration;
      try {
      const metadata = await this.readMutableMetadata(generation);
      if (!metadata) return this.restrictedExport();
      const selected = parsed.data.entryIds.map((id) => metadata.find((entry) => entry.id === id)).filter((entry): entry is AuthenticatorEntryMetadata => Boolean(entry));
      if (selected.length !== parsed.data.entryIds.length) return exportFailure('One or more requested authenticator entries no longer exist; no export was created.', '有一個或者以上要求嘅 authenticator 項目已經唔存在；冇建立匯出檔案。');
      const omittedFields = [...EXPORT_OMITTED_FIELDS];
      const records = selected.map(({ id, issuer, account, label, algorithm, digits, periodSeconds, createdAt, updatedAt, order, group }) => ({ id, issuer, account, label, algorithm, digits, periodSeconds, createdAt, updatedAt, order, group }));
      const markdownCell = (value: string | number | null) => String(value ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
      const csvEscape = (value: string | number | null) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      let content: string;
      let filename: string;
      if (parsed.data.format === 'json') {
        content = JSON.stringify({ schemaVersion: 2, omittedFields, entries: records }, null, 2) + '\n';
        filename = 'authenticator-metadata.json';
      } else if (parsed.data.format === 'csv') {
        // Keep this standards-compatible CSV: the schema and omission facts are
        // repeated as bounded columns instead of a comment row that strict readers
        // would mistake for a data record.
        const headers = ['schemaVersion', 'omittedFields', 'id', 'issuer', 'account', 'label', 'algorithm', 'digits', 'periodSeconds', 'createdAt', 'updatedAt', 'order', 'group'];
        content = `${headers.join(',')}\n${records.map((record) => [2, omittedFields.join(';'), record.id, record.issuer, record.account, record.label, record.algorithm, record.digits, record.periodSeconds, record.createdAt, record.updatedAt, record.order, record.group].map((value) => csvEscape(value as string | number | null)).join(',')).join('\n')}\n`;
        filename = 'authenticator-metadata.csv';
      } else {
        content = `# Authenticator metadata export\n\nSecrets, otpauth URIs, current codes, next-code peeks, countdowns, and expiry timestamps are intentionally omitted.\n\n| Label | Issuer | Account | Algorithm | Digits | Period | Group |\n| --- | --- | --- | --- | ---: | ---: | --- |\n${records.map((record) => `| ${markdownCell(record.label)} | ${markdownCell(record.issuer)} | ${markdownCell(record.account)} | ${record.algorithm} | ${record.digits} | ${record.periodSeconds} | ${markdownCell(record.group)} |`).join('\n')}\n`;
        filename = 'authenticator-metadata.md';
      }
      if (parsed.data.format === 'markdown') content = content.replace('# Authenticator metadata export\n\n', '# Authenticator metadata export\n\nEncoding: UTF-8; line endings: LF; schema: authenticator metadata v2.\n');
      if (!this.capabilityIsLive(generation)) return this.restrictedExport();
      if (Buffer.byteLength(content, 'utf8') > AUTHENTICATOR_MAX_EXPORT_LENGTH) return exportFailure('The metadata export exceeded its bounded size; no file was created.', 'Metadata 匯出超出大小上限；冇建立檔案。');
      return { ok: true, format: parsed.data.format, filename, content, omittedFields, message: 'Metadata export is ready; secrets, otpauth URIs, current codes, and next-code peeks were omitted.', messageYue: 'Metadata 匯出已準備好；秘密、otpauth URI、目前驗證碼同下一碼預覽都冇包括。' };
      } catch {
        return exportFailure('The authenticator metadata export could not be prepared safely.', '未能安全準備 authenticator metadata 匯出。');
      }
    });
  }

  async list(): Promise<AuthenticatorListResult> {
    if (this.restricted) return this.restrictedList();
    const generation = this.restrictionGeneration;
    const vaultStatus = await this.vault.status();
    if (!this.capabilityIsLive(generation)) return this.restrictedList();
    if (vaultStatus === 'unavailable') return {
      entries: [],
      storage: 'memory-only',
      message: 'Saved authenticator entries are unavailable because the operating-system credential vault is unavailable.',
      messageYue: '作業系統憑證庫未能使用，所以已儲存嘅 authenticator 項目暫時用唔到。',
    };
    let metadata: AuthenticatorEntryMetadata[];
    try { metadata = await this.vault.listMetadata(); }
    catch {
      if (!this.capabilityIsLive(generation)) return this.restrictedList();
      return { entries: [], storage: 'os-vault', message: 'Authenticator metadata could not be read safely.', messageYue: 'Authenticator metadata 未能安全讀取。' };
    }
    if (!this.capabilityIsLive(generation)) return this.restrictedList();
    const entries: AuthenticatorEntry[] = [];
    let unavailableSecret = false;
    const now = Date.now();
    if (!Number.isFinite(now) || now < 0 || now > MAX_TOTP_TIMESTAMP_MS) {
      if (!this.capabilityIsLive(generation)) return this.restrictedList();
      return {
        entries: metadata.slice(0, AUTHENTICATOR_MAX_ENTRIES).map((item) => ({ ...item, code: null, nextCode: null, remainingSeconds: null, expiresAt: null })),
        storage: 'os-vault',
        message: 'The system clock is outside the supported range; authenticator codes are unavailable until it is corrected.',
        messageYue: '系統時鐘超出支援範圍；校正之前 authenticator 驗證碼都用唔到。',
      };
    }
    for (const item of metadata.slice(0, AUTHENTICATOR_MAX_ENTRIES)) {
      const secret = await this.vault.readSecret(item.id);
      if (!this.capabilityIsLive(generation)) return this.restrictedList();
      if (!secret) {
        unavailableSecret = true;
        entries.push({ ...item, code: null, nextCode: null, remainingSeconds: null, expiresAt: null });
        continue;
      }
      try {
        const result = generateTotp({ secret, algorithm: item.algorithm, digits: item.digits, periodSeconds: item.periodSeconds, timestampMs: now });
        const nextCode = result.expiresAtMs <= MAX_TOTP_TIMESTAMP_MS
          ? generateTotp({ secret, algorithm: item.algorithm, digits: item.digits, periodSeconds: item.periodSeconds, timestampMs: result.expiresAtMs }).code
          : null;
        entries.push({ ...item, code: result.code, nextCode, remainingSeconds: result.remainingSeconds, expiresAt: new Date(result.expiresAtMs).toISOString() });
      } catch {
        unavailableSecret = true;
        entries.push({ ...item, code: null, nextCode: null, remainingSeconds: null, expiresAt: null });
      }
    }
    if (!this.capabilityIsLive(generation)) return this.restrictedList();
    return {
      entries,
      storage: 'os-vault',
      message: unavailableSecret ? 'Some authenticator secrets could not be read from the credential vault; no plaintext fallback was attempted.' : 'Authenticator entries and current codes are calculated locally.',
      messageYue: unavailableSecret ? '部分 authenticator 秘密未能由憑證庫讀取；冇嘗試明文後備方案。' : 'Authenticator 項目同目前驗證碼都喺本機計算。',
    };
  }

  private expirePending(): void {
    const now = Date.now();
    for (const [id, pending] of this.pending) if (now - pending.createdAtMs > PENDING_TTL_MS) this.removePending(id);
  }

  private clearPending(): void {
    for (const id of this.pending.keys()) this.removePending(id);
  }

  private removePending(id: string): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    if (pending.expiryTimer) clearTimeout(pending.expiryTimer);
    pending.cancelled = true;
    // Drop references eagerly; the timeout also ensures abandoned pairings do
    // not retain a plaintext secret or URI after the bounded TTL.
    pending.secret = '';
    pending.uri = '';
    this.pending.delete(id);
  }
}
