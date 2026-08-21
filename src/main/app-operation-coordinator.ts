import { randomUUID } from 'node:crypto';
import type { OperationKind } from '../shared/contracts.js';

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/;

export type AppOperationLeaseKind = Extract<OperationKind, 'install' | 'uninstall' | 'launch' | 'update'>;

export interface AppOperationLease {
  readonly appId: string;
  readonly kind: AppOperationLeaseKind;
  readonly operationId: string;
  /** Release only after the operation's final cleanup has completed. */
  release(): void;
  /** Keep the barrier when process termination or final state is not proven. */
  retain(): void;
}

interface LeaseRecord {
  appId: string;
  kind: AppOperationLeaseKind;
  operationId: string;
  retained: boolean;
}

/**
 * Synchronous, per-app mutation barrier shared by launch, install, update and
 * uninstall.  Acquisition does no I/O and therefore must happen before the
 * first await in each caller.  A retained lease is intentionally indistinguishable
 * from an active lease to every later caller: an unknown process outcome is not
 * safe to race with a second privileged action.
 */
export class AppOperationCoordinator {
  private readonly leases = new Map<string, LeaseRecord>();

  acquire(appId: string, kind: AppOperationLeaseKind): AppOperationLease | null {
    if (!APP_ID_PATTERN.test(appId) || this.leases.has(appId)) return null;
    const record: LeaseRecord = { appId, kind, operationId: randomUUID(), retained: false };
    this.leases.set(appId, record);
    let released = false;
    return {
      appId,
      kind,
      operationId: record.operationId,
      release: () => {
        if (released) return;
        released = true;
        if (this.leases.get(appId)?.operationId === record.operationId && !record.retained) this.leases.delete(appId);
      },
      retain: () => {
        if (released) return;
        record.retained = true;
      },
    };
  }

  isBusy(appId: string): boolean { return this.leases.has(appId); }

  isRetained(appId: string): boolean { return this.leases.get(appId)?.retained === true; }

  current(): readonly Readonly<LeaseRecord>[] { return [...this.leases.values()].map((record) => Object.freeze({ ...record })); }
}

export const appOperationCoordinatorInternals = { APP_ID_PATTERN };
