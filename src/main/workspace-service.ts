import path from 'node:path';
import { app } from 'electron';
import type { TabState, TabWorkspace } from '../shared/contracts.js';
import { DEFAULT_TAB_WORKSPACE, MAX_DOCUMENT_BYTES, MAX_TAB_GROUPS, TAB_IDS, tabWorkspaceSchema } from '../shared/contracts.js';
import { readJson, writeJsonAtomic } from './json-store.js';

export class WorkspaceService {
  private readonly filePath = path.join(app.getPath('userData'), 'workspace.v1.json');

  async load(): Promise<TabWorkspace> {
    try {
      const stored = await readJson<unknown>(this.filePath, DEFAULT_TAB_WORKSPACE);
      const parsed = tabWorkspaceSchema.safeParse(stored);
      return parsed.success ? this.normalize(parsed.data) : DEFAULT_TAB_WORKSPACE;
    } catch {
      return DEFAULT_TAB_WORKSPACE;
    }
  }

  async save(input: unknown): Promise<TabWorkspace> {
    const value = this.normalize(tabWorkspaceSchema.parse(input));
    await writeJsonAtomic(this.filePath, value);
    return value;
  }

  async reset(): Promise<TabWorkspace> {
    await writeJsonAtomic(this.filePath, DEFAULT_TAB_WORKSPACE);
    return DEFAULT_TAB_WORKSPACE;
  }

  async export(): Promise<string> {
    return `${JSON.stringify(await this.load(), null, 2)}\n`;
  }

  async import(document: string): Promise<TabWorkspace> {
    if (typeof document !== 'string' || Buffer.byteLength(document, 'utf8') > MAX_DOCUMENT_BYTES) {
      throw new Error('Tab layout file is larger than the 64 KB limit.');
    }
    let candidate: unknown;
    try {
      candidate = JSON.parse(document) as unknown;
    } catch {
      throw new Error('Tab layout file is not valid JSON.');
    }
    const parsed = tabWorkspaceSchema.safeParse(candidate);
    if (!parsed.success) throw new Error('Tab layout file does not match the supported layout format.');
    return this.save(parsed.data);
  }

  private normalize(input: TabWorkspace): TabWorkspace {
    const groups = input.groups
      .filter((group, index, all) => all.findIndex((other) => other.id === group.id) === index)
      .slice(0, MAX_TAB_GROUPS)
      .map((group) => ({ ...group, name: group.name.trim().slice(0, 32) }));
    const groupIds = new Set(groups.map((group) => group.id));

    const byId = new Map(input.tabs.map((tab) => [tab.id, tab]));
    const tabs: TabState[] = TAB_IDS.map((id, index) => {
      const existing = byId.get(id) ?? { id, open: true, pinned: false, groupId: null, previousGroupId: null, order: index };
      const previousGroupId = existing.previousGroupId && groupIds.has(existing.previousGroupId) ? existing.previousGroupId : null;
      let groupId = existing.groupId && groupIds.has(existing.groupId) ? existing.groupId : null;
      const pinnedPrevious = existing.pinned && groupId ? groupId : previousGroupId;
      if (existing.pinned) groupId = null;
      return { id, open: existing.open !== false, pinned: existing.pinned, groupId, previousGroupId: pinnedPrevious, order: existing.order };
    });

    const safeTabs = tabs.some((tab) => tab.open)
      ? tabs
      : tabs.map((tab, index) => (index === 0 ? { ...tab, open: true } : tab));
    const regions: TabState[][] = [
      safeTabs.filter((tab) => tab.open && tab.pinned),
      ...groups.map((group) => safeTabs.filter((tab) => tab.open && !tab.pinned && tab.groupId === group.id)),
      safeTabs.filter((tab) => tab.open && !tab.pinned && tab.groupId === null),
    ];
    let cursor = 0;
    for (const region of regions) {
      for (const tab of region.sort((left, right) => left.order - right.order)) {
        tab.order = cursor;
        cursor += 1;
      }
    }

    const activeTabId = TAB_IDS.includes(input.activeTabId) && safeTabs.find((tab) => tab.id === input.activeTabId)?.open
      ? input.activeTabId
      : (safeTabs.find((tab) => tab.open)?.id ?? 'catalog');
    return { schemaVersion: 1, activeTabId, tabs: safeTabs, groups, rail: { ...input.rail } };
  }
}
