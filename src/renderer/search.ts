import { createContext, createElement, Fragment, useContext, useMemo, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { PersistedSurfaceId } from '../shared/contracts';
import {
  boundedHaystack,
  boundedPattern,
  regexFlagsIssue,
  regexSafetyIssue,
  MAX_REGEX_PATTERN_LENGTH,
} from './regex-safety';

export { MAX_REGEX_HAYSTACK_LENGTH, MAX_REGEX_MATCHES, MAX_REGEX_PATTERN_LENGTH, MAX_REGEX_SAMPLE_LENGTH, REGEX_WORKER_BUDGET_MS, REGEX_WORKER_TIMEOUT_MS, SUPPORTED_REGEX_FLAGS } from './regex-safety';
export { regexFlagsIssue, regexSafetyIssue } from './regex-safety';

/** Persisted page surfaces plus the three ephemeral renderer-only search surfaces. */
export type SurfaceId = PersistedSurfaceId
  | 'palette'
  | 'tabs'
  | 'tabs.groups'
  | 'tabs.master'
  | 'tabs.menu'
  | 'tabs.bulk-close'
  | 'tabs.move-group'
  | `tabs.group.${string}`
  | 'appearance.elements'
  | 'notifications'
  | 'changelog';

export interface RegexMode { pattern: string; flags: string }
export interface SearchState { query: string; regex: RegexMode | null }

/** Every surface without its own state reads this frozen value; a missing key is never written on read. */
export const EMPTY_SEARCH: SearchState = Object.freeze({ query: '', regex: null });

export function compile(regex: RegexMode | null, extraFlags = ''): RegExp | null {
  if (!regex) return null;
  if (regexSafetyIssue(regex.pattern) || regexFlagsIssue(regex.flags)) return null;
  try {
    const flags = `${regex.flags}${extraFlags}`;
    if (regexFlagsIssue(flags.replace('g', ''))) return null;
    return new RegExp(boundedPattern(regex.pattern), flags);
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
      try {
        expression.lastIndex = 0;
        return expression.test(boundedHaystack(haystack));
      } catch {
        // A malformed or unsupported pattern must never make a collection render fail.
        return false;
      }
    };
  }
  const needle = boundedPattern(state.query).toLocaleLowerCase();
  return (haystack: string) => boundedHaystack(haystack).toLocaleLowerCase().includes(needle);
}

export const matches = (state: SearchState, haystack: string): boolean => makeMatcher(state)(haystack);

/** Wraps every hit in <mark>. Falls back to plain text when the pattern cannot compile. */
export function highlight(state: SearchState, text: string): ReactNode {
  if (!state.query) return text;
  let expression: RegExp | null;
  if (state.regex) expression = compile(state.regex, 'g');
  else {
    try { expression = new RegExp(escapeLiteral(boundedPattern(state.query)), 'gi'); }
    catch { expression = null; }
  }
  if (!expression) return text;
  const parts: ReactNode[] = [];
  let cursor = 0;
  let guard = 0;
  const boundedText = boundedHaystack(text);
  while (guard < 100) {
    let match: RegExpExecArray | null;
    try { match = expression.exec(boundedText); } catch { return text; }
    if (!match) break;
    const index = match.index ?? 0;
    if (!match[0]) {
      // RegExp.exec does not advance on a zero-width global match. Advance one
      // UTF-16 code unit so a pattern such as ^ or (?=.) cannot loop forever.
      expression.lastIndex = Math.max(expression.lastIndex, index + 1);
      guard += 1;
      continue;
    }
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(createElement('mark', { key: `${index}-${guard}` }, match[0]));
    cursor = index + match[0].length;
    guard += 1;
  }
  if (!parts.length) return text;
  if (cursor < boundedText.length) parts.push(text.slice(cursor, boundedText.length));
  if (boundedText.length < text.length) parts.push(text.slice(boundedText.length));
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
