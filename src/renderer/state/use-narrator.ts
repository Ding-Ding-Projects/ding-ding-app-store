import { useEffect, useRef } from 'react';
import type { ScheduleConfig, UserSettings } from '../../shared/contracts';
import type { ActiveNotice } from '../notify';
import { browserSpeechPort, NarratorQueue, narratorLines } from '../narrator';

function quietNow(schedule: ScheduleConfig, now = new Date()): boolean {
  const quiet = schedule.quietHours;
  if (!quiet.enabled) return false;
  const minute = now.getHours() * 60 + now.getMinutes();
  return quiet.endMinute < quiet.startMinute
    ? minute >= quiet.startMinute || minute < quiet.endMinute
    : minute >= quiet.startMinute && minute < quiet.endMinute;
}

/** An active polite/assertive live region means assistive technology owns the spoken channel. */
function screenReaderAnnouncementActive(): boolean {
  if (typeof document === 'undefined') return false;
  // Browsers deliberately do not expose screen-reader presence. A native accessibility
  // integration may set this narrow, explicit marker; without it we never guess.
  return document.documentElement.dataset.screenReaderActive === 'true';
}

export function useNarrator(settings: UserSettings, schedule: ScheduleConfig, notices: readonly ActiveNotice[]): void {
  const queue = useRef<NarratorQueue | null>(null);
  const seen = useRef(new Set<string>());
  if (!queue.current) queue.current = new NarratorQueue(browserSpeechPort());

  useEffect(() => () => queue.current?.stop(), []);

  useEffect(() => {
    if (!settings.narratorEnabled || settings.narratorReducedSound || quietNow(schedule)) queue.current?.stop();
  }, [schedule, settings.narratorEnabled, settings.narratorReducedSound]);

  useEffect(() => {
    for (const notice of notices) {
      if (seen.current.has(notice.id)) continue;
      seen.current.add(notice.id);
      const category = notice.category ?? (notice.ok ? 'success' : 'error');
      queue.current?.enqueue(narratorLines(settings, category, notice.message), category, {
        quiet: quietNow(schedule),
        reducedSound: settings.narratorReducedSound,
        screenReaderActive: screenReaderAnnouncementActive(),
      });
    }
  }, [notices, schedule, settings]);
}
