import type { AuthenticatorEntryMetadata, AuthenticatorGroup } from '../shared/contracts.js';

export type AuthenticatorVaultStatus = 'unavailable' | 'os-credential-vault';

export interface AuthenticatorVaultMetadataWriteOptions {
  /** Capability fence checked before publication and again after it settles. */
  shouldCommit?: () => boolean;
  groups?: readonly AuthenticatorGroup[];
}

export interface AuthenticatorVaultSaveOptions {
  /** A capability fence checked before and after publication. */
  shouldCommit?: () => boolean;
  groups?: readonly AuthenticatorGroup[];
}

export interface AuthenticatorVault {
  status(): Promise<AuthenticatorVaultStatus>;
  listMetadata(): Promise<AuthenticatorEntryMetadata[]>;
  listGroups?(): Promise<AuthenticatorGroup[]>;
  writeMetadata(entries: readonly AuthenticatorEntryMetadata[], options?: AuthenticatorVaultMetadataWriteOptions): Promise<void>;
  save(entry: AuthenticatorEntryMetadata, secret: string, options?: AuthenticatorVaultSaveOptions): Promise<void>;
  remove(entryId: string, options?: AuthenticatorVaultSaveOptions): Promise<void>;
  readSecret(entryId: string): Promise<string | null>;
}

/** Explicit no-persistence boundary used by tests and unavailable vaults. */
export class UnavailableAuthenticatorVault implements AuthenticatorVault {
  async status(): Promise<'unavailable'> { return 'unavailable'; }
  async listMetadata(): Promise<AuthenticatorEntryMetadata[]> { return []; }
  async writeMetadata(): Promise<void> { throw new Error('The operating-system credential vault is unavailable.'); }
  async save(): Promise<void> { throw new Error('The operating-system credential vault is unavailable.'); }
  async remove(): Promise<void> { throw new Error('The operating-system credential vault is unavailable.'); }
  async readSecret(): Promise<null> { return null; }
}
