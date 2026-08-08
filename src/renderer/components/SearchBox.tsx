import { useEffect, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { el } from '../el';
import { Icon } from '../icons';
import { useSurfaceSearch } from '../search';
import type { SurfaceId } from '../search';
import { RegexBuilder } from './RegexBuilder';

export const searchInputId = (surface: SurfaceId): string => `search-${surface.replace('.', '-')}`;

/**
 * One search field per surface, each with its own state and its own full regex builder.
 * `openBuilder` lets a palette command open the builder for a named surface.
 */
export function SearchBox({ surface, placeholder, openBuilder, onBuilderHandled, className, autoFocusInput, activeDescendant, controls, onInputKeyDown }: {
  surface: SurfaceId;
  placeholder: string;
  openBuilder?: boolean;
  onBuilderHandled?: () => void;
  className?: string;
  autoFocusInput?: boolean;
  activeDescendant?: string;
  controls?: string;
  onInputKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
}) {
  const { state, setQuery, setRegex } = useSurfaceSearch(surface);
  const [builderOpen, setBuilderOpen] = useState(false);

  useEffect(() => {
    if (!openBuilder) return;
    setBuilderOpen(true);
    onBuilderHandled?.();
  }, [openBuilder, onBuilderHandled]);

  return (
    <div className={className ? `search-wrap ${className}` : 'search-wrap'} {...el('search-field')}>
      <Icon>search</Icon>
      <input
        id={searchInputId(surface)}
        type="search"
        value={state.query}
        maxLength={160}
        onChange={(event) => { setQuery(event.target.value); if (state.regex) setRegex({ ...state.regex, pattern: event.target.value }); }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocusInput}
        aria-activedescendant={activeDescendant}
        aria-controls={controls}
        onKeyDown={onInputKeyDown}
      />
      {state.regex && <span className="regex-chip">/{state.regex.flags}</span>}
      {state.query && <button className="icon-button" {...el('icon-button')} aria-label={`Clear search in ${surface}`} onClick={() => { setQuery(''); setRegex(null); }}><Icon>close</Icon></button>}
      <button className="icon-button" {...el('icon-button')} aria-label="Open full regex builder" aria-expanded={builderOpen} onClick={() => setBuilderOpen((open) => !open)}><Icon>regular_expression</Icon></button>
      {builderOpen && <RegexBuilder query={state.query} onClose={() => setBuilderOpen(false)} onApply={(pattern, flags) => { setQuery(pattern); setRegex({ pattern, flags }); setBuilderOpen(false); }} />}
    </div>
  );
}
