import type { AuthenticatorEntryMetadata } from '../shared/contracts.js';

export type AuthenticatorVaultStatus = 'unavailable' | 'os-credential-vault';

export interface AuthenticatorVaultSaveOptions {
  /** A capability fence checked before and after publication. */
  shouldCommit?: () => boolean;
}

export interface AuthenticatorVault {
  status(): Promise<AuthenticatorVaultStatus>;
  listMetadata(): Promise<AuthenticatorEntryMetadata[]>;
  save(entry: AuthenticatorEntryMetadata, secret: string, options?: AuthenticatorVaultSaveOptions): Promise<void>;
  remove(entryId: string): Promise<void>;
  readSecret(entryId: string): Promise<string | null>;
}

/** Explicit no-persistence boundary used by tests and unavailable vaults. */
export class UnavailableAuthenticatorVault implements AuthenticatorVault {
  async status(): Promise<'unavailable'> { return 'unavailable'; }
  async listMetadata(): Promise<AuthenticatorEntryMetadata[]> { return []; }
  async save(): Promise<void> { throw new Error('The operating-system credential vault is unavailable.'); }
  async remove(): Promise<void> { throw new Error('The operating-system credential vault is unavailable.'); }
  async readSecret(): Promise<null> { return null; }
}
