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

/** Opaque, vault-encrypted material used only by the protected local-history service. */
export interface AuthenticatorVaultHistorySnapshot {
  schemaVersion: 1;
  metadata: AuthenticatorEntryMetadata[];
  groups: AuthenticatorGroup[];
  ciphertext: Array<{ entryId: string; base64: string }>;
}

export interface AuthenticatorVaultHistoryOptions {
  shouldCommit?: () => boolean;
  recovery?: boolean;
}

export interface AuthenticatorVault {
  status(): Promise<AuthenticatorVaultStatus>;
  listMetadata(): Promise<AuthenticatorEntryMetadata[]>;
  listGroups?(): Promise<AuthenticatorGroup[]>;
  writeMetadata(entries: readonly AuthenticatorEntryMetadata[], options?: AuthenticatorVaultMetadataWriteOptions): Promise<void>;
  save(entry: AuthenticatorEntryMetadata, secret: string, options?: AuthenticatorVaultSaveOptions): Promise<void>;
  remove(entryId: string, options?: AuthenticatorVaultSaveOptions): Promise<void>;
  readSecret(entryId: string): Promise<string | null>;
  /** True only when the platform offers atomic directory-handle no-follow operations. */
  supportsAtomicNoFollow?(): boolean;
  /** Optional so in-memory test vaults remain deliberately history-free. */
  createHistorySnapshot?(): Promise<AuthenticatorVaultHistorySnapshot | null>;
  restoreHistorySnapshot?(snapshot: AuthenticatorVaultHistorySnapshot, options?: AuthenticatorVaultHistoryOptions): Promise<void>;
  recoverHistoryRestore?(): Promise<void>;
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
