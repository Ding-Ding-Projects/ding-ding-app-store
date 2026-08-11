import type { HistoryMutationResult, HistoryRevision, UserSettings } from '../shared/contracts';
import { matchesHistoryDate, type HistoryDateLanguage, type HistoryDateRange } from './history-date-filter';
import { label } from './i18n';

export type HistoryRevisionMutation = 'label' | 'restore';

export function historyMutationMessage(
  settings: UserSettings,
  operation: HistoryRevisionMutation,
  revision: HistoryRevision,
  requestedLabel: string,
  result: HistoryMutationResult,
): string {
  if (result.ok) {
    return operation === 'label'
      ? label(settings, `Saved local version label “${requestedLabel.trim()}”.`, `已經儲存本機版本標籤「${requestedLabel.trim()}」。`)
      : label(settings, `Restored local App Store state from ${revision.id.slice(0, 12)}.`, `已經由 ${revision.id.slice(0, 12)} 還原 App Store 本機狀態。`);
  }
  const fallbackEnglish = operation === 'label' ? 'The local version label could not be saved.' : 'The local version could not be restored.';
  const fallbackCantonese = operation === 'label' ? '本機版本標籤儲存唔成功。' : '本機版本還原唔成功。';
  const detail = result.message.trim();
  if (settings.language === 'en') return detail || fallbackEnglish;
  if (settings.language === 'yue') return detail ? `${fallbackCantonese}（${detail}）` : fallbackCantonese;
  return detail ? `${fallbackEnglish} · ${fallbackCantonese} (${detail})` : `${fallbackEnglish} · ${fallbackCantonese}`;
}

export function filterHistoryRevisions(
  revisions: readonly HistoryRevision[],
  matcher: (haystack: string) => boolean,
  dateRange: HistoryDateRange,
  language: HistoryDateLanguage,
): HistoryRevision[] {
  return revisions.filter((revision) => matchesHistoryDate(revision.occurredAt, dateRange, language)
    && matcher(`${revision.id}\n${revision.subject}\n${revision.label}\n${revision.changedFiles.join('\n')}`));
}

export function selectRevisionRange(
  revisions: readonly HistoryRevision[],
  current: ReadonlySet<string>,
  index: number,
  checked: boolean,
  shiftAnchorId: string | null,
): Set<string> {
  const next = new Set(current);
  const anchor = shiftAnchorId ? revisions.findIndex((revision) => revision.id === shiftAnchorId) : -1;
  const start = anchor >= 0 ? Math.min(anchor, index) : index;
  const end = anchor >= 0 ? Math.max(anchor, index) : index;
  for (let cursor = start; cursor <= end; cursor += 1) {
    const id = revisions[cursor]?.id;
    if (!id) continue;
    if (checked) next.add(id); else next.delete(id);
  }
  return next;
}

export function invertRevisionSelection(revisions: readonly HistoryRevision[], current: ReadonlySet<string>): Set<string> {
  const next = new Set(current);
  for (const revision of revisions) {
    if (next.has(revision.id)) next.delete(revision.id);
    else next.add(revision.id);
  }
  return next;
}
