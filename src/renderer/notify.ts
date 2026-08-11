import type { NarratorCategory } from './narrator';
import type { SchoolModeMutationCode } from '../shared/contracts';

/**
 * Recovery is deliberately a small typed vocabulary. A notification may offer
 * one only when its producer knows how to repeat that exact safe operation.
 */
export const RECOVERY_ACTION_KINDS = [
  'retry-catalog-refresh',
  'retry-installer',
  'retry-managed-update',
  'retry-store-update-check',
  'retry-scheduled-check',
  'retry-source-job',
  'open-source-details',
] as const;

export type RecoveryActionKind = typeof RECOVERY_ACTION_KINDS[number];

/** Serializable action evidence retained in notification history and exports. */
export interface RecoveryActionMetadata {
  kind: RecoveryActionKind;
}

/** Runtime capability. The callback never enters persistence or an export. */
export interface RecoveryAction extends RecoveryActionMetadata {
  run: () => void | Promise<void>;
}

/** One corner-notification shape for every informational and failure message in the renderer. */
export interface Notice {
  title?: string;
  message: string;
  ok: boolean;
  category?: NarratorCategory;
  operationId?: string;
  undo?: { label: string; run: () => void };
  recovery?: RecoveryAction;
  /** Semantic School mutation evidence; rendered against the current shared name. */
  schoolModeCode?: SchoolModeMutationCode;
}

export type Notify = (notice: Notice) => void;

export interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  ok: boolean;
  createdAt: string;
  dismissedAt: string | null;
  category?: NarratorCategory;
  operationId?: string;
  recovery?: RecoveryActionMetadata;
  schoolModeCode?: SchoolModeMutationCode;
}

export interface ActiveNotice extends NotificationRecord {
  undo?: Notice['undo'];
  recovery?: Notice['recovery'];
}
