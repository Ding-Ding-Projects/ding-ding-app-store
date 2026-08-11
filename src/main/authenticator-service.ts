import { z } from 'zod';
import {
  AUTHENTICATOR_ALGORITHMS,
  AUTHENTICATOR_DIGITS,
  AUTHENTICATOR_MAX_SECRET_LENGTH,
  type AuthenticatorPreviewRequest,
  type AuthenticatorPreviewResult,
  type AuthenticatorStatus,
} from '../shared/contracts.js';
import { generateTotp } from './totp.js';
import { MAX_TOTP_TIMESTAMP_MS } from './totp.js';

const previewRequestSchema = z.strictObject({
  secret: z.string().min(1).max(AUTHENTICATOR_MAX_SECRET_LENGTH),
  algorithm: z.enum(AUTHENTICATOR_ALGORITHMS),
  digits: z.union(AUTHENTICATOR_DIGITS.map((value) => z.literal(value)) as [z.ZodLiteral<6>, z.ZodLiteral<7>, z.ZodLiteral<8>]),
  periodSeconds: z.number().int().min(1).max(3_600),
  atMs: z.number().int().min(0).max(MAX_TOTP_TIMESTAMP_MS).optional(),
});

export interface AuthenticatorVault {
  status(): Promise<'unavailable' | 'os-credential-vault'>;
  entryCount(): Promise<number>;
}

/** The honest default until a dedicated per-entry safeStorage adapter exists. */
export class UnavailableAuthenticatorVault implements AuthenticatorVault {
  async status(): Promise<'unavailable'> { return 'unavailable'; }
  async entryCount(): Promise<0> { return 0; }
}

export class AuthenticatorService {
  constructor(private readonly vault: AuthenticatorVault = new UnavailableAuthenticatorVault()) {}

  async status(): Promise<AuthenticatorStatus> {
    const vault = await this.vault.status();
    const entryCount = vault === 'unavailable' ? 0 : await this.vault.entryCount();
    return {
      available: vault !== 'unavailable',
      vault,
      entryCount,
      checkedAt: new Date().toISOString(),
      message: vault === 'unavailable'
        ? 'Persistent authenticator entries are unavailable until an operating-system credential-vault adapter is wired. One-shot previews stay in memory only.'
        : 'Authenticator entries are held by the operating-system credential vault.',
      messageYue: vault === 'unavailable'
        ? '未接駁作業系統憑證庫配接器之前，唔可以儲存 authenticator 項目；一次性預覽只留喺記憶體。'
        : 'Authenticator 項目由作業系統憑證庫保管。',
    };
  }

  /**
   * Calculate one current code without persisting the secret. The optional
   * deterministic clock is for local RFC-vector tests only; the IPC bridge
   * never supplies it.
   */
  async preview(request: AuthenticatorPreviewRequest, options: { deterministicClock?: boolean } = {}): Promise<AuthenticatorPreviewResult> {
    const parsed = previewRequestSchema.safeParse(request);
    if (!parsed.success) return this.failure('The authenticator preview request was invalid.', 'Authenticator 預覽要求無效。');
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
    } catch {
      // Deliberately avoid echoing parser details, the submitted secret, or a
      // partially decoded value through the renderer boundary.
      return this.failure('The authenticator secret or parameters were not accepted.', 'Authenticator 秘密或者參數唔獲接受。');
    }
  }

  private failure(message: string, messageYue: string): AuthenticatorPreviewResult {
    return { ok: false, storage: 'memory-only', message, messageYue };
  }
}
