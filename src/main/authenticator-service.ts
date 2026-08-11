import { randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  AUTHENTICATOR_ALGORITHMS,
  AUTHENTICATOR_DIGITS,
  AUTHENTICATOR_MAX_ACCOUNT_LENGTH,
  AUTHENTICATOR_MAX_ENTRIES,
  AUTHENTICATOR_MAX_ISSUER_LENGTH,
  AUTHENTICATOR_MAX_SECRET_LENGTH,
  type AuthenticatorEntry,
  type AuthenticatorEntryMetadata,
  type AuthenticatorListResult,
  type AuthenticatorMutationResult,
  type AuthenticatorPreviewRequest,
  type AuthenticatorPreviewResult,
  type AuthenticatorRegistrationConfirmRequest,
  type AuthenticatorRegistrationPreviewResult,
  type AuthenticatorRegistrationRequest,
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
  }) as AuthenticatorEntryMetadata;
}

function sameCode(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected, 'utf8');
  const actualBytes = Buffer.from(actual, 'utf8');
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

export class AuthenticatorService {
  private readonly pending = new Map<string, PendingRegistration>();
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
    try {
      await this.vault.save(pending.metadata, pending.secret, { shouldCommit: () => this.capabilityIsLive(generation) && !pending.cancelled && this.pending.get(pending.registrationId) === pending });
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
        entry: pending.metadata,
        message: 'Authenticator entry saved in the operating-system credential vault; the registration secret left memory.',
        messageYue: 'Authenticator 項目已儲入作業系統憑證庫；註冊秘密已離開記憶體。',
      };
    } catch {
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
        entries: metadata.slice(0, AUTHENTICATOR_MAX_ENTRIES).map((item) => ({ ...item, code: null, remainingSeconds: null, expiresAt: null })),
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
        entries.push({ ...item, code: null, remainingSeconds: null, expiresAt: null });
        continue;
      }
      try {
        const result = generateTotp({ secret, algorithm: item.algorithm, digits: item.digits, periodSeconds: item.periodSeconds });
        entries.push({ ...item, code: result.code, remainingSeconds: result.remainingSeconds, expiresAt: new Date(result.expiresAtMs).toISOString() });
      } catch {
        unavailableSecret = true;
        entries.push({ ...item, code: null, remainingSeconds: null, expiresAt: null });
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
