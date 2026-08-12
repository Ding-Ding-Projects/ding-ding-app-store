import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { UserSettings } from '../../shared/contracts';
import { Icon } from '../icons';
import { label } from '../i18n';
import { makeMatcher, type RegexMode, type SearchState } from '../search';
import { RegexBuilder } from './RegexBuilder';

export interface SearchablePickerOption {
  readonly value: string;
  readonly en: string;
  readonly yue: string;
}

/** The same bounded matcher used by every search field, kept pure for picker tests. */
export function filterSearchablePickerOptions(options: readonly SearchablePickerOption[], state: SearchState, settings: UserSettings): SearchablePickerOption[] {
  const matcher = makeMatcher(state);
  return options.filter((option) => matcher(label(settings, option.en, option.yue)));
}

interface SearchablePickerProps {
  id?: string;
  labelText: string;
  settings: UserSettings;
  value: string;
  options: readonly SearchablePickerOption[];
  onChange(value: string): void;
  disabled?: boolean;
  title?: string;
  className?: string;
  describedBy?: string;
}

/**
 * A native-select replacement for bounded option lists. Each instance owns its
 * query, regex builder, highlighted option, and return focus; no picker shares
 * state with another surface.
 */
export function SearchablePicker({ id, labelText, settings, value, options, onChange, disabled = false, title, className, describedBy }: SearchablePickerProps) {
  const generatedId = useId().replace(/:/g, '');
  const pickerId = id ?? `searchable-picker-${generatedId}`;
  const listId = `${pickerId}-list`;
  const inputId = `${pickerId}-search`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [regex, setRegex] = useState<RegexMode | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const state = useMemo<SearchState>(() => ({ query, regex }), [query, regex]);
  const visible = useMemo(() => filterSearchablePickerOptions(options, state, settings), [options, settings, state]);
  const selected = options.find((option) => option.value === value) ?? options[0];
  const selectedLabel = selected ? label(settings, selected.en, selected.yue) : label(settings, 'No value selected', '未揀值');

  const returnFocus = () => window.setTimeout(() => triggerRef.current?.focus(), 0);
  const close = () => {
    setOpen(false);
    setBuilderOpen(false);
    setQuery('');
    setRegex(null);
    setActiveIndex(0);
    returnFocus();
  };
  const choose = (option: SearchablePickerOption | undefined) => {
    if (!option) return;
    onChange(option.value);
    close();
  };
  const openPicker = () => {
    if (disabled) return;
    setOpen(true);
    setActiveIndex(Math.max(0, visible.findIndex((option) => option.value === value)));
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };
  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!target || (target as HTMLElement).closest?.(`[data-picker-id="${pickerId}"]`)) return;
      close();
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open, pickerId]);
  useEffect(() => {
    if (activeIndex >= visible.length) setActiveIndex(Math.max(0, visible.length - 1));
    if (open && visible[activeIndex]) document.getElementById(`${listId}-${visible[activeIndex].value}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, listId, open, visible]);

  const move = (delta: number) => {
    if (!visible.length) return;
    setActiveIndex((current) => (current + delta + visible.length) % visible.length);
  };
  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) openPicker(); else move(1);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    }
  };
  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
    else if (event.key === 'Home') { event.preventDefault(); setActiveIndex(0); }
    else if (event.key === 'End') { event.preventDefault(); setActiveIndex(Math.max(0, visible.length - 1)); }
    else if (event.key === 'Enter') { event.preventDefault(); choose(visible[activeIndex]); }
    else if (event.key === 'Escape') { event.preventDefault(); close(); }
  };

  return (
    <div className={className ? `searchable-picker ${className}` : 'searchable-picker'} data-picker-id={pickerId}>
      <span className="searchable-picker-label" id={`${pickerId}-label`}>{labelText}</span>
      <button
        ref={triggerRef}
        id={pickerId}
        type="button"
        className="searchable-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${pickerId}-label ${pickerId}-value`}
        aria-describedby={describedBy}
        title={title}
        disabled={disabled}
        onClick={() => open ? close() : openPicker()}
        onKeyDown={onTriggerKeyDown}
      >
        <span id={`${pickerId}-value`} className="searchable-picker-value">{selectedLabel}</span>
        <Icon>expand_more</Icon>
      </button>
      {open && <div className="searchable-picker-popover popover" role="dialog" aria-label={label(settings, `${labelText} options`, `${labelText} 選項`)}>
        <div className="searchable-picker-search search-wrap">
          <Icon>search</Icon>
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            role="combobox"
            value={query}
            maxLength={160}
            placeholder={label(settings, 'Filter options', '篩選選項')}
            aria-label={label(settings, `Filter ${labelText}`, `篩選 ${labelText}`)}
            aria-controls={listId}
            aria-expanded="true"
            aria-haspopup="listbox"
            aria-activedescendant={visible[activeIndex] ? `${listId}-${visible[activeIndex].value}` : undefined}
            onChange={(event) => { setQuery(event.target.value); if (regex) setRegex({ ...regex, pattern: event.target.value }); setActiveIndex(0); }}
            onKeyDown={onInputKeyDown}
          />
          <button type="button" className="icon-button" aria-label={label(settings, 'Open regex builder for this picker', '開呢個選擇器嘅 Regex 建造器')} aria-expanded={builderOpen} onClick={() => setBuilderOpen((current) => !current)}><Icon>regular_expression</Icon></button>
          {builderOpen && <RegexBuilder query={query} settings={settings} onClose={() => { setBuilderOpen(false); window.setTimeout(() => inputRef.current?.focus(), 0); }} onApply={(pattern, flags) => { setQuery(pattern); setRegex({ pattern, flags }); setBuilderOpen(false); window.setTimeout(() => inputRef.current?.focus(), 0); }} />}
        </div>
        <p className="visually-hidden" role="status">{label(settings, `${visible.length} option${visible.length === 1 ? '' : 's'} shown`, `${visible.length} 個選項顯示緊`)}</p>
        <div id={listId} className="searchable-picker-options" role="listbox" aria-label={label(settings, `${labelText} choices`, `${labelText} 選擇`) }>
          {visible.length ? visible.map((option, index) => {
            const optionLabel = label(settings, option.en, option.yue);
            return <button key={option.value} id={`${listId}-${option.value}`} type="button" role="option" aria-selected={option.value === value} className={index === activeIndex ? 'searchable-picker-option active' : 'searchable-picker-option'} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option)}>{optionLabel}</button>;
          }) : <p className="searchable-picker-empty" role="status">{label(settings, 'No matching options.', '冇符合嘅選項。')}</p>}
        </div>
      </div>}
    </div>
  );
}
