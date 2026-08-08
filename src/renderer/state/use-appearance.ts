import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toCssVariables } from '../../shared/contracts';
import type { AppearanceDocument, AppearanceElements, AppearanceImportResult, ElementKey, ElementOverride, TokenId } from '../../shared/contracts';
import type { Notify } from '../notify';
import type { TokenValue } from '../registry';

const SAVE_DELAY_MS = 400;
const UNDO_WINDOW_MS = 10_000;
const EMPTY_DOCUMENT: AppearanceDocument = { schemaVersion: 1, elements: {} };

export interface AppearanceApi {
  document: AppearanceDocument;
  /** Stored overrides with the live draft layered on top, so the preview is always what you will get. */
  elements: AppearanceElements;
  editMode: boolean;
  setEditMode(on: boolean | 'toggle'): void;
  selectedKey: ElementKey | null;
  select(key: ElementKey | null): void;
  overrideOf(key: ElementKey): ElementOverride;
  setToken(token: TokenId, value: TokenValue | undefined): void;
  commit(): void;
  resetElement(key: ElementKey): void;
  resetAll(): void;
  canUndo: boolean;
  undo(): void;
  exportDocument(): Promise<string>;
  importDocument(payload: string): Promise<AppearanceImportResult>;
}

export function useAppearance(notify: Notify): AppearanceApi {
  const [document, setDocument] = useState<AppearanceDocument>(EMPTY_DOCUMENT);
  const [editMode, setEditModeState] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ElementKey | null>(null);
  const [draft, setDraft] = useState<{ key: ElementKey; override: ElementOverride } | null>(null);
  const requestId = useRef(0);
  const timer = useRef<number | null>(null);
  const undoRef = useRef<{ key: ElementKey; override: ElementOverride; at: number } | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const accept = useCallback((id: number, next: AppearanceDocument) => {
    if (id !== requestId.current) return;
    setDocument(next);
    if (next.warning) notify({ ok: false, message: next.warning });
  }, [notify]);

  const run = useCallback((work: () => Promise<AppearanceDocument>) => {
    requestId.current += 1;
    const id = requestId.current;
    void work().then((next) => accept(id, next), (error: unknown) => notify({ ok: false, message: (error as Error).message.slice(0, 200) }));
  }, [accept, notify]);

  useEffect(() => { run(() => window.dingDingStore.appearance.load()); }, [run]);

  const elements = useMemo<AppearanceElements>(() => {
    if (!draft) return document.elements;
    const merged: AppearanceElements = { ...document.elements };
    if (Object.keys(draft.override).length) merged[draft.key] = draft.override;
    else delete merged[draft.key];
    return merged;
  }, [document, draft]);

  const flush = useCallback((key: ElementKey, override: ElementOverride) => {
    run(() => window.dingDingStore.appearance.setElement(key, override));
  }, [run]);

  const setToken = useCallback((token: TokenId, value: TokenValue | undefined) => {
    if (!selectedKey) return;
    const base = draft && draft.key === selectedKey ? draft.override : (document.elements[selectedKey] ?? {});
    const override: ElementOverride = { ...base };
    if (value === undefined) delete override[token];
    else Object.assign(override, { [token]: value });
    setDraft({ key: selectedKey, override });
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { timer.current = null; flush(selectedKey, override); }, SAVE_DELAY_MS);
  }, [selectedKey, draft, document, flush]);

  const commit = useCallback(() => {
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
    if (draft) flush(draft.key, draft.override);
  }, [draft, flush]);

  const resetElement = useCallback((key: ElementKey) => {
    const previous = document.elements[key];
    if (previous && Object.keys(previous).length) {
      undoRef.current = { key, override: previous, at: Date.now() };
      setCanUndo(true);
      window.setTimeout(() => setCanUndo(false), UNDO_WINDOW_MS);
    }
    setDraft((current) => (current?.key === key ? null : current));
    run(() => window.dingDingStore.appearance.resetElement(key));
  }, [document, run]);

  const resetAll = useCallback(() => {
    undoRef.current = null;
    setCanUndo(false);
    setDraft(null);
    run(() => window.dingDingStore.appearance.resetAll());
    notify({ ok: true, message: 'All appearance overrides were removed.' });
  }, [run, notify]);

  const undo = useCallback(() => {
    const entry = undoRef.current;
    if (!entry || Date.now() - entry.at > UNDO_WINDOW_MS) return;
    undoRef.current = null;
    setCanUndo(false);
    flush(entry.key, entry.override);
  }, [flush]);

  const importDocument = useCallback(async (payload: string) => {
    const result = await window.dingDingStore.appearance.import(payload);
    if (result.ok) {
      requestId.current += 1;
      setDraft(null);
      setDocument(result.document);
      notify({ ok: true, message: `Appearance imported: ${result.applied} elements applied.` });
    } else {
      notify({ ok: false, message: `${result.message} ${result.issues.slice(0, 3).join(' ')}`.slice(0, 200) });
    }
    return result;
  }, [notify]);

  const select = useCallback((key: ElementKey | null) => {
    if (draft && draft.key !== key) {
      if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
      flush(draft.key, draft.override);
      setDraft(null);
    }
    setSelectedKey(key);
  }, [draft, flush]);

  const overrideOf = useCallback((key: ElementKey): ElementOverride => (draft?.key === key ? draft.override : document.elements[key] ?? {}), [draft, document]);

  return {
    document,
    elements,
    editMode,
    setEditMode: (on) => setEditModeState((current) => (on === 'toggle' ? !current : on)),
    selectedKey,
    select,
    overrideOf,
    setToken,
    commit,
    resetElement,
    resetAll,
    canUndo,
    undo,
    exportDocument: () => window.dingDingStore.appearance.export(),
    importDocument,
  };
}

/**
 * Applies every override as a CSS custom property on the document element. The Content-Security-Policy
 * forbids injected stylesheets, so the emitter's closed [name, value] pairs go through CSSOM only.
 */
export function useAppearanceVars(elements: AppearanceElements): void {
  const applied = useRef<string[]>([]);
  const appliedElements = useRef<HTMLElement[]>([]);
  useLayoutEffect(() => {
    const pairs = toCssVariables(elements);
    const names = pairs.map(([name]) => name);
    const root = window.document.documentElement;
    for (const name of applied.current) if (!names.includes(name)) root.style.removeProperty(name);
    for (const [name, value] of pairs) root.style.setProperty(name, value);
    applied.current = names;
    const appearanceProperties = ['font-family', 'font-style', 'text-decoration', 'letter-spacing', 'line-height', 'font-variation-settings', 'text-decoration-style', 'text-decoration-color', 'text-decoration-thickness', 'text-transform', 'font-variant-caps', 'vertical-align', 'direction', 'text-align', 'text-shadow'];
    const appearanceVariables = ['--appearance-font-family', '--appearance-font-style', '--appearance-text-decoration', '--appearance-letter-spacing', '--appearance-line-height', '--appearance-font-variation-settings', '--appearance-text-decoration-style', '--appearance-text-decoration-color', '--appearance-text-decoration-thickness', '--appearance-text-transform', '--appearance-font-variant-caps', '--appearance-vertical-align', '--appearance-direction', '--appearance-text-align', '--appearance-text-shadow'];
    for (const element of appliedElements.current) for (const property of appearanceVariables) element.style.removeProperty(property);
    const byElement = new Map<string, Record<string, string>>();
    for (const [name, value] of pairs) {
      const match = /^--elx-([a-z0-9-]+)-(font-family|font-style|text-decoration|letter-spacing|line-height|font-variation-settings|text-decoration-style|text-decoration-color|text-decoration-thickness|text-transform|font-variant-caps|vertical-align|direction|text-align|text-shadow)$/.exec(name);
      if (match) (byElement.get(match[1]) ?? (byElement.set(match[1], {}), byElement.get(match[1])!))[match[2]] = value;
    }
    const nextElements: HTMLElement[] = [];
    for (const element of Array.from(root.ownerDocument.querySelectorAll<HTMLElement>('[data-el]'))) {
      const values = byElement.get(element.dataset.el ?? '');
      if (!values) continue;
      for (const [property, value] of Object.entries(values)) element.style.setProperty(`--appearance-${property}`, value);
      nextElements.push(element);
    }
    appliedElements.current = nextElements;
  }, [elements]);
}
