import { createContext, createElement, Fragment, useContext, useMemo, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { PersistedSurfaceId } from '../shared/contracts';

/** Persisted page surfaces plus the three ephemeral renderer-only search surfaces. */
export type SurfaceId = PersistedSurfaceId | 'palette' | 'tabs' | 'appearance.elements' | 'notifications' | 'changelog';

export interface RegexMode { pattern: string; flags: string }
export interface SearchState { query: string; regex: RegexMode | null }

/** Every surface without its own state reads this frozen value; a missing key is never written on read. */
export const EMPTY_SEARCH: SearchState = Object.freeze({ query: '', regex: null });

const MAX_PATTERN = 160;

export function compile(regex: RegexMode | null, extraFlags = ''): RegExp | null {
  if (!regex) return null;
  try {
    return new RegExp(regex.pattern.slice(0, MAX_PATTERN), regex.flags.replace('g', '') + extraFlags);
  } catch {
    return null;
  }
}

const escapeLiteral = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The single filter implementation every surface shares. */
export function makeMatcher(state: SearchState): (haystack: string) => boolean {
  if (!state.query) return () => true;
  if (state.regex) {
    const expression = compile(state.regex);
    if (!expression) return () => false;
    return (haystack: string) => {
      expression.lastIndex = 0;
      return expression.test(haystack);
    };
  }
  const needle = state.query.toLocaleLowerCase();
  return (haystack: string) => haystack.toLocaleLowerCase().includes(needle);
}

export const matches = (state: SearchState, haystack: string): boolean => makeMatcher(state)(haystack);

/** Wraps every hit in <mark>. Falls back to plain text when the pattern cannot compile. */
export function highlight(state: SearchState, text: string): ReactNode {
  if (!state.query) return text;
  let expression: RegExp | null;
  if (state.regex) expression = compile(state.regex, 'g');
  else {
    try { expression = new RegExp(escapeLiteral(state.query.slice(0, MAX_PATTERN)), 'gi'); }
    catch { expression = null; }
  }
  if (!expression) return text;
  const parts: ReactNode[] = [];
  let cursor = 0;
  let guard = 0;
  for (const match of text.matchAll(expression)) {
    if (guard >= 100) break;
    const index = match.index ?? 0;
    if (!match[0]) continue;
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(createElement('mark', { key: `${index}-${guard}` }, match[0]));
    cursor = index + match[0].length;
    guard += 1;
  }
  if (!parts.length) return text;
  if (cursor < text.length) parts.push(text.slice(cursor));
  return createElement(Fragment, null, ...parts);
}

export type SearchMap = Partial<Record<SurfaceId, SearchState>>;
export type SearchAction =
  | { type: 'set'; surface: SurfaceId; patch: Partial<SearchState> }
  | { type: 'clear'; surface: SurfaceId }
  | { type: 'clear-all' };

function reducer(state: SearchMap, action: SearchAction): SearchMap {
  if (action.type === 'clear-all') return {};
  if (action.type === 'clear') {
    if (!state[action.surface]) return state;
    const next = { ...state };
    delete next[action.surface];
    return next;
  }
  const current = state[action.surface] ?? EMPTY_SEARCH;
  return { ...state, [action.surface]: { ...current, ...action.patch } };
}

export interface SearchContextValue { states: SearchMap; dispatch: Dispatch<SearchAction> }

export const SearchContext = createContext<SearchContextValue | null>(null);

/** Session-only, per-surface search state. Nothing here is ever persisted: a restored filter lies about the catalog. */
export function useSearchStates(): SearchContextValue {
  const [states, dispatch] = useReducer(reducer, {});
  return useMemo(() => ({ states, dispatch }), [states]);
}

export interface SurfaceSearch {
  state: SearchState;
  setQuery(query: string): void;
  setRegex(regex: RegexMode | null): void;
  clear(): void;
}

export function useSurfaceSearch(surface: SurfaceId): SurfaceSearch {
  const context = useContext(SearchContext);
  const state = context?.states[surface] ?? EMPTY_SEARCH;
  const dispatch = context?.dispatch;
  return useMemo(() => ({
    state,
    setQuery: (query: string) => dispatch?.({ type: 'set', surface, patch: { query } }),
    setRegex: (regex: RegexMode | null) => dispatch?.({ type: 'set', surface, patch: { regex } }),
    clear: () => dispatch?.({ type: 'clear', surface }),
  }), [state, dispatch, surface]);
}
