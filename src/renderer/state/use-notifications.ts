import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ActiveNotice, Notice, NotificationRecord, Notify } from '../notify';

export const NOTIFICATION_STORAGE_KEY = 'ding-ding-app-store.notifications.v1';
export const MAX_NOTIFICATION_RECORDS = 250;
export const MAX_NOTIFICATION_STORAGE_BYTES = 512_000;
export const MAX_NOTIFICATION_TITLE_LENGTH = 120;
export const MAX_NOTIFICATION_MESSAGE_LENGTH = 1_000;

export function parseNotificationRecords(value: string | null): NotificationRecord[] {
  if (!value || value.length > MAX_NOTIFICATION_STORAGE_BYTES) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is NotificationRecord => Boolean(
        item && typeof item === 'object'
        && typeof (item as NotificationRecord).id === 'string'
        && typeof (item as NotificationRecord).title === 'string'
        && typeof (item as NotificationRecord).message === 'string'
        && typeof (item as NotificationRecord).ok === 'boolean'
        && ((item as NotificationRecord).category === undefined || ['general', 'success', 'progress', 'warning', 'error'].includes((item as NotificationRecord).category!))
        && typeof (item as NotificationRecord).createdAt === 'string'
        && ((item as NotificationRecord).dismissedAt === null || typeof (item as NotificationRecord).dismissedAt === 'string'),
      ))
      .map((record) => ({ ...record, title: record.title.slice(0, MAX_NOTIFICATION_TITLE_LENGTH), message: record.message.slice(0, MAX_NOTIFICATION_MESSAGE_LENGTH) }))
      .slice(0, MAX_NOTIFICATION_RECORDS);
  } catch {
    return [];
  }
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `notice-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export interface NotificationApi {
  records: NotificationRecord[];
  active: ActiveNotice[];
  unreadCount: number;
  persistenceAvailable: boolean;
  notify: Notify;
  dismiss(id: string): void;
  dismissMany(ids: readonly string[]): void;
  deleteMany(ids: readonly string[]): void;
}

export function useNotifications(): NotificationApi {
  const [records, setRecords] = useState<NotificationRecord[]>(() => {
    try { return parseNotificationRecords(window.localStorage.getItem(NOTIFICATION_STORAGE_KEY)); }
    catch { return []; }
  });
  const [active, setActive] = useState<ActiveNotice[]>([]);
  const [persistenceAvailable, setPersistenceAvailable] = useState(true);

  useEffect(() => {
    try {
      window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(records.slice(0, MAX_NOTIFICATION_RECORDS)));
      setPersistenceAvailable(true);
    } catch {
      setPersistenceAvailable(false);
    }
  }, [records]);

  const notify = useCallback<Notify>((notice: Notice) => {
    const record: ActiveNotice = {
      id: newId(),
      title: (notice.title ?? (notice.ok ? 'Completed' : 'Needs attention')).slice(0, MAX_NOTIFICATION_TITLE_LENGTH),
      message: notice.message.slice(0, MAX_NOTIFICATION_MESSAGE_LENGTH),
      ok: notice.ok,
      category: notice.category,
      createdAt: new Date().toISOString(),
      dismissedAt: null,
      undo: notice.undo,
    };
    setRecords((current) => [{ ...record, undo: undefined }, ...current].slice(0, MAX_NOTIFICATION_RECORDS));
    setActive((current) => [...current, record].slice(-4));
  }, []);

  const dismissMany = useCallback((ids: readonly string[]) => {
    const selected = new Set(ids);
    const dismissedAt = new Date().toISOString();
    setActive((current) => current.filter((notice) => !selected.has(notice.id)));
    setRecords((current) => current.map((record) => selected.has(record.id) && record.dismissedAt === null ? { ...record, dismissedAt } : record));
  }, []);

  const dismiss = useCallback((id: string) => dismissMany([id]), [dismissMany]);
  const deleteMany = useCallback((ids: readonly string[]) => {
    const selected = new Set(ids);
    setActive((current) => current.filter((notice) => !selected.has(notice.id)));
    setRecords((current) => current.filter((record) => !selected.has(record.id)));
  }, []);

  const unreadCount = useMemo(() => records.filter((record) => record.dismissedAt === null).length, [records]);
  return { records, active, unreadCount, persistenceAvailable, notify, dismiss, dismissMany, deleteMany };
}
