import type { NarratorCategory } from './narrator';

/** One corner-notification shape for every informational and failure message in the renderer. */
export interface Notice {
  title?: string;
  message: string;
  ok: boolean;
  category?: NarratorCategory;
  undo?: { label: string; run: () => void };
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
}

export interface ActiveNotice extends NotificationRecord {
  undo?: Notice['undo'];
}
