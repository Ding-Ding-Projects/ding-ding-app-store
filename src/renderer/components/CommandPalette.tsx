import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { UserSettings } from '../../shared/contracts';
import { el } from '../el';
import { Icon } from '../icons';
import { label } from '../i18n';
import type { Action, Entry, EntryGroup } from '../registry';
import { highlight, makeMatcher, useSurfaceSearch } from '../search';
import { SearchBox } from './SearchBox';

const GROUP_ORDER: EntryGroup[] = ['Pages', 'Tabs', 'Appearance', 'Schedule', 'Search', 'Settings', 'Apps'];
const GROUP_LABELS: Record<EntryGroup, { en: string; yue: string }> = {
  Pages: { en: 'Pages', yue: '頁面' }, Tabs: { en: 'Tabs', yue: '分頁' }, Appearance: { en: 'Appearance', yue: '外觀' },
  Schedule: { en: 'Schedule', yue: '排程' }, Search: { en: 'Search', yue: '搜尋' }, Settings: { en: 'Settings', yue: '設定' },
  Apps: { en: 'Apps', yue: '應用' },
};
const BROWSE_LIMIT = 6;
const SEARCH_LIMIT = 40;

/**
 * Every page, command, setting, appearance control, and schedule field reaches the user here.
 * The palette itself holds no callbacks: each row emits one Action into the shell's dispatch.
 */
export function CommandPalette({ settings, entries, onAction, onClose, openRegex, onRegexHandled }: {
  settings: UserSettings;
  entries: Entry[];
  onAction(action: Action): void;
  onClose(): void;
  openRegex: boolean;
  onRegexHandled(): void;
}) {
  const search = useSurfaceSearch('palette');
  const [cursor, setCursor] = useState(0);
  const dialogRef = useRef<HTMLElement | null>(null);
  const invoker = useRef<HTMLElement | null>(null);

  useEffect(() => {
    invoker.current = window.document.activeElement as HTMLElement | null;
    return () => invoker.current?.focus();
  }, []);

  const matcher = useMemo(() => makeMatcher(search.state), [search.state]);
  const visible = useMemo(() => {
    const limit = search.state.query ? SEARCH_LIMIT : BROWSE_LIMIT;
    const rows: Entry[] = [];
    for (const group of GROUP_ORDER) {
      rows.push(...entries.filter((entry) => entry.group === group && matcher(`${entry.en}\n${entry.yue}\n${entry.keywords.join(' ')}\n${entry.id}`)).slice(0, limit));
    }
    return rows;
  }, [entries, matcher, search.state.query]);

  useEffect(() => { setCursor((current) => (current < visible.length ? current : 0)); }, [visible.length]);

  const optionId = (index: number) => `palette-option-${index}`;

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setCursor((current) => (visible.length ? (current + 1) % visible.length : 0)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setCursor((current) => (visible.length ? (current - 1 + visible.length) % visible.length : 0)); }
    if (event.key === 'Enter' && visible[cursor]) { event.preventDefault(); onAction(visible[cursor].action); onClose(); }
  };

  const trap = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  let index = -1;
  return (
    <div className="scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" ref={dialogRef} onKeyDown={trap} {...el('command-palette')}>
        <header>
          <h2>Command palette · 指令板</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close command palette"><Icon>close</Icon></button>
        </header>
        <SearchBox
          surface="palette"
          placeholder={label(settings, 'Search commands, pages, settings, appearance, and apps', '搵指令、頁面、設定、外觀同 apps')}
          autoFocusInput
          controls="palette-list"
          activeDescendant={visible.length ? optionId(cursor) : undefined}
          onInputKeyDown={onInputKeyDown}
          openBuilder={openRegex}
          onBuilderHandled={onRegexHandled}
        />
        <div className="command-list" role="listbox" id="palette-list" aria-label="Commands">
          {GROUP_ORDER.map((group) => {
            const rows = visible.filter((entry) => entry.group === group);
            if (!rows.length) return null;
            return (
              <div key={group} role="group" aria-label={label(settings, GROUP_LABELS[group].en, GROUP_LABELS[group].yue)}>
                <p className="command-group">{label(settings, GROUP_LABELS[group].en, GROUP_LABELS[group].yue)}</p>
                {rows.map((entry) => {
                  index += 1;
                  const position = index;
                  return (
                    <button
                      key={entry.id}
                      id={optionId(position)}
                      role="option"
                      aria-selected={position === cursor}
                      className={position === cursor ? 'command-row active' : 'command-row'}
                      disabled={entry.enabled === false}
                      onMouseEnter={() => setCursor(position)}
                      onClick={() => { onAction(entry.action); onClose(); }}
                    >
                      <Icon>{entry.icon}</Icon>
                      <span>
                        <strong>{highlight(search.state, label(settings, entry.en, entry.yue))}</strong>
                        <small>{entry.kind} · {entry.id}</small>
                      </span>
                      <Icon>arrow_forward</Icon>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {!visible.length && <p className="supporting">{label(settings, 'No command matches this search.', '冇指令配到呢個搜尋。')}</p>}
        </div>
      </section>
    </div>
  );
}
