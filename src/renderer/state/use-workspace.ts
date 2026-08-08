import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { DEFAULT_TAB_WORKSPACE, MAX_TAB_GROUPS } from '../../shared/contracts';
import type { TabGroup, TabGroupColor, TabId, TabRailLayout, TabState, TabWorkspace } from '../../shared/contracts';
import type { Notify } from '../notify';

export type WorkspaceAction =
  | { type: 'replace'; value: TabWorkspace }
  | { type: 'activate'; id: TabId }
  | { type: 'pin'; id: TabId; pinned: boolean | 'toggle' }
  | { type: 'move'; id: TabId; direction: -1 | 1 }
  | { type: 'move-to'; id: TabId; targetId: TabId }
  | { type: 'group-create'; group: TabGroup; memberId: TabId | null }
  | { type: 'group-rename'; groupId: string; name: string }
  | { type: 'group-color'; groupId: string; color: TabGroupColor }
  | { type: 'group-assign'; id: TabId; groupId: string }
  | { type: 'group-remove'; id: TabId }
  | { type: 'group-collapse'; groupId: string; collapsed: boolean | 'toggle' }
  | { type: 'group-collapse-all' }
  | { type: 'group-delete'; groupId: string }
  | { type: 'rail'; patch: Partial<TabRailLayout> }
  | { type: 'reset' };

export type RegionKind = 'pinned' | 'group' | 'ungrouped';
export interface Region { kind: RegionKind; group: TabGroup | null; tabs: TabState[] }

const regionKeyOf = (tab: TabState): string => (tab.pinned ? 'pinned' : tab.groupId ? `g:${tab.groupId}` : 'ungrouped');

/** Re-indexes every region densely and clears group links a pinned tab may no longer hold. */
function renormalize(workspace: TabWorkspace): TabWorkspace {
  const groupIds = new Set(workspace.groups.map((group) => group.id));
  const tabs = workspace.tabs.map((tab) => ({
    ...tab,
    groupId: tab.pinned || !tab.groupId || !groupIds.has(tab.groupId) ? null : tab.groupId,
    previousGroupId: tab.previousGroupId && groupIds.has(tab.previousGroupId) ? tab.previousGroupId : null,
  }));
  const buckets = new Map<string, TabState[]>();
  for (const tab of [...tabs].sort((left, right) => left.order - right.order)) {
    const key = regionKeyOf(tab);
    const bucket = buckets.get(key) ?? [];
    bucket.push(tab);
    buckets.set(key, bucket);
  }
  for (const bucket of buckets.values()) bucket.forEach((tab, index) => { tab.order = index; });
  return { ...workspace, tabs };
}

/** Regions in render order: pinned first, then each group in declared order, then ungrouped tabs. */
export function regionsOf(workspace: TabWorkspace): Region[] {
  const sorted = (predicate: (tab: TabState) => boolean) => workspace.tabs.filter(predicate).sort((left, right) => left.order - right.order);
  const regions: Region[] = [{ kind: 'pinned', group: null, tabs: sorted((tab) => tab.pinned) }];
  for (const group of workspace.groups) regions.push({ kind: 'group', group, tabs: sorted((tab) => !tab.pinned && tab.groupId === group.id) });
  regions.push({ kind: 'ungrouped', group: null, tabs: sorted((tab) => !tab.pinned && !tab.groupId) });
  return regions;
}

export const orderedTabIds = (workspace: TabWorkspace): TabId[] => regionsOf(workspace).flatMap((region) => region.tabs.map((tab) => tab.id));

export function newGroupId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `grp_${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')}`;
}

function reducer(state: TabWorkspace, action: WorkspaceAction): TabWorkspace {
  const mapTabs = (mutate: (tab: TabState) => TabState) => renormalize({ ...state, tabs: state.tabs.map(mutate) });
  switch (action.type) {
    case 'replace': return action.value;
    case 'reset': return DEFAULT_TAB_WORKSPACE;
    case 'activate': return { ...state, activeTabId: action.id };
    case 'pin': {
      return mapTabs((tab) => {
        if (tab.id !== action.id) return tab;
        const pinned = action.pinned === 'toggle' ? !tab.pinned : action.pinned;
        if (pinned === tab.pinned) return tab;
        if (pinned) return { ...tab, pinned: true, previousGroupId: tab.groupId, groupId: null, order: 63 };
        const restored = tab.previousGroupId && state.groups.some((group) => group.id === tab.previousGroupId) ? tab.previousGroupId : null;
        return { ...tab, pinned: false, groupId: restored, previousGroupId: null, order: 63 };
      });
    }
    case 'move': {
      const target = state.tabs.find((tab) => tab.id === action.id);
      if (!target) return state;
      const siblings = state.tabs.filter((tab) => regionKeyOf(tab) === regionKeyOf(target)).sort((left, right) => left.order - right.order);
      const index = siblings.findIndex((tab) => tab.id === action.id);
      const swap = siblings[index + action.direction];
      if (!swap) return state;
      return mapTabs((tab) => (tab.id === target.id ? { ...tab, order: swap.order } : tab.id === swap.id ? { ...tab, order: target.order } : tab));
    }
    case 'move-to': {
      const target = state.tabs.find((tab) => tab.id === action.targetId);
      const source = state.tabs.find((tab) => tab.id === action.id);
      if (!target || !source || target.id === source.id) return state;
      return mapTabs((tab) => (tab.id === source.id
        ? { ...tab, pinned: target.pinned, groupId: target.pinned ? null : target.groupId, order: target.order - 0.5 }
        : tab));
    }
    case 'group-create': {
      if (state.groups.length >= MAX_TAB_GROUPS) return state;
      const groups = [...state.groups, action.group];
      const tabs = state.tabs.map((tab) => (action.memberId && tab.id === action.memberId ? { ...tab, pinned: false, groupId: action.group.id, order: 0 } : tab));
      return renormalize({ ...state, groups, tabs });
    }
    case 'group-rename': return { ...state, groups: state.groups.map((group) => (group.id === action.groupId ? { ...group, name: action.name.trim().slice(0, 32) || group.name } : group)) };
    case 'group-color': return { ...state, groups: state.groups.map((group) => (group.id === action.groupId ? { ...group, color: action.color } : group)) };
    case 'group-assign': return mapTabs((tab) => (tab.id === action.id ? { ...tab, pinned: false, groupId: action.groupId, previousGroupId: null, order: 63 } : tab));
    case 'group-remove': return mapTabs((tab) => (tab.id === action.id ? { ...tab, groupId: null, previousGroupId: null, order: 63 } : tab));
    case 'group-collapse': return { ...state, groups: state.groups.map((group) => (group.id === action.groupId ? { ...group, collapsed: action.collapsed === 'toggle' ? !group.collapsed : action.collapsed } : group)) };
    case 'group-collapse-all': return { ...state, groups: state.groups.map((group) => ({ ...group, collapsed: true })) };
    case 'group-delete': {
      const groups = state.groups.filter((group) => group.id !== action.groupId);
      const tabs = state.tabs.map((tab) => (tab.groupId === action.groupId ? { ...tab, groupId: null, order: 63 } : tab));
      return renormalize({ ...state, groups, tabs });
    }
    case 'rail': return { ...state, rail: { ...state.rail, ...action.patch } };
    default: return state;
  }
}

export interface WorkspaceApi {
  workspace: TabWorkspace;
  ready: boolean;
  dispatch(action: WorkspaceAction): void;
  reset(): Promise<void>;
  exportLayout(): Promise<string>;
  importLayout(document: string): Promise<boolean>;
}

const SAVE_DELAY_MS = 300;

export function useWorkspace(notify: Notify): WorkspaceApi {
  const [workspace, dispatch] = useReducer(reducer, DEFAULT_TAB_WORKSPACE);
  const [ready, setReady] = useState(false);
  const lastGood = useRef<TabWorkspace>(DEFAULT_TAB_WORKSPACE);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    void window.dingDingStore.workspace.load().then((value) => {
      lastGood.current = value;
      dispatch({ type: 'replace', value });
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready || workspace === lastGood.current) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    const pending = workspace;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void window.dingDingStore.workspace.save(pending).then(
        (saved) => { lastGood.current = saved; },
        (error: unknown) => {
          const restored = lastGood.current;
          dispatch({ type: 'replace', value: restored });
          notify({ ok: false, message: `Tab layout was not saved: ${(error as Error).message}` });
        },
      );
    }, SAVE_DELAY_MS);
    return () => { if (timer.current !== null) window.clearTimeout(timer.current); };
  }, [workspace, ready, notify]);

  const reset = useCallback(async () => {
    const value = await window.dingDingStore.workspace.reset();
    lastGood.current = value;
    dispatch({ type: 'replace', value });
    notify({ ok: true, message: 'Tab layout reset to defaults.' });
  }, [notify]);

  const exportLayout = useCallback(() => window.dingDingStore.workspace.export(), []);

  const importLayout = useCallback(async (document: string) => {
    try {
      const value = await window.dingDingStore.workspace.import(document);
      lastGood.current = value;
      dispatch({ type: 'replace', value });
      notify({ ok: true, message: 'Tab layout imported.' });
      return true;
    } catch (error) {
      notify({ ok: false, message: `Tab layout import failed: ${(error as Error).message.slice(0, 200)}` });
      return false;
    }
  }, [notify]);

  return { workspace, ready, dispatch, reset, exportLayout, importLayout };
}
