import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { UserSettings } from '../../shared/contracts';
import { el } from '../el';
import { Icon } from '../icons';
import { dialogCopy } from '../dialog-emoji';
import { label } from '../i18n';
import type { Action, Entry, EntryControl, EntryGroup, TokenValue } from '../registry';
import { highlight, makeMatcher, useSurfaceSearch } from '../search';
import { SearchBox } from './SearchBox';
import { ColorTranslatorControl } from './ColorTranslatorControl';
import { SearchablePicker } from './SearchablePicker';

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
      rows.push(...entries.filter((entry) => entry.group === group && matcher(`${entry.en}\n${entry.yue}\n${entry.keywords.join(' ')}`)).slice(0, limit));
    }
    return rows;
  }, [entries, matcher, search.state.query]);

  useEffect(() => { setCursor((current) => (current < visible.length ? current : 0)); }, [visible.length]);

  const optionId = (index: number) => `palette-option-${index}`;
  const activate = (entry: Entry) => {
    onAction(entry.action);
    const keepsPaletteOpen = entry.action.type === 'command' && entry.action.command === 'open-regex:palette';
    if (!keepsPaletteOpen) onClose();
  };

  const applyControl = (entry: Entry, control: EntryControl, raw: string | number | boolean) => {
    const action = entry.action;
    if (action.type === 'set-setting') {
      onAction({ ...action, value: raw as UserSettings[keyof UserSettings] });
      return;
    }
    if (action.type === 'set-schedule') {
      onAction({ ...action, value: typeof raw === 'string' ? Number(raw) : raw as number | boolean });
      return;
    }
    if (action.type === 'set-appearance') {
      const value = control.kind === 'color' ? { kind: 'hex' as const, hex: String(raw).toLowerCase() } : raw;
      onAction({ ...action, value: value as TokenValue });
    }
  };

  const renderControl = (entry: Entry) => {
    const control = entry.control;
    if (!control) return null;
    const labelText = label(settings, entry.en, entry.yue);
    const stop = (event: ReactKeyboardEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => event.stopPropagation();
    if (control.kind === 'select') return (
      <div className="command-inline-control" onClick={stop} onKeyDown={stop}>
        <SearchablePicker labelText={`${labelText} control`} settings={settings} value={control.value} options={control.options} onChange={(value) => applyControl(entry, control, value)} />
      </div>
    );
    if (control.kind === 'range') return (
      <input className="command-inline-control command-inline-range" aria-label={`${labelText} control`} type="range" min={control.min} max={control.max} step={control.step ?? 1} value={control.value} onClick={stop} onChange={(event) => applyControl(entry, control, Number(event.target.value))} />
    );
    if (control.kind === 'color') return (
      <div className="command-inline-color" onClick={stop} onKeyDown={stop}><ColorTranslatorControl settings={settings} value={control.value} labelText={`${labelText} control`} onChange={(next) => applyControl(entry, control, next)} /></div>
    );
    if (control.kind === 'switch') return (
      <input className="command-inline-control" aria-label={`${labelText} control`} type="checkbox" checked={control.value} onClick={stop} onChange={(event) => applyControl(entry, control, event.target.checked)} />
    );
    return (
      <input className="command-inline-control command-inline-text" aria-label={`${labelText} control`} type="text" value={control.value} maxLength={control.maxLength} onClick={stop} onChange={(event) => applyControl(entry, control, event.target.value)} />
    );
  };

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setCursor((current) => (visible.length ? (current + 1) % visible.length : 0)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setCursor((current) => (visible.length ? (current - 1 + visible.length) % visible.length : 0)); }
    if (event.key === 'Enter' && visible[cursor]) { event.preventDefault(); activate(visible[cursor]); }
  };

  const trap = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])');
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
          <h2>{dialogCopy(settings, 'Command palette · 指令板', '🧭')}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close command palette"><Icon>close</Icon></button>
        </header>
        <SearchBox
          surface="palette"
          settings={settings}
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
                    <div
                      key={entry.id}
                      id={optionId(position)}
                      role="option"
                      aria-selected={position === cursor}
                      className={position === cursor ? 'command-row active' : 'command-row'}
                      tabIndex={-1}
                      aria-disabled={entry.enabled === false}
                      onMouseEnter={() => setCursor(position)}
                      onClick={() => { if (entry.enabled !== false) activate(entry); }}
                      onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && !event.defaultPrevented) { event.preventDefault(); if (entry.enabled !== false) activate(entry); } }}
                    >
                      <Icon>{entry.icon}</Icon>
                      <span>
                        <strong>{highlight(search.state, label(settings, entry.en, entry.yue))}</strong>
                        <small>{entry.kind}</small>
                      </span>
                      {renderControl(entry)}
                      <Icon>arrow_forward</Icon>
                    </div>
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
