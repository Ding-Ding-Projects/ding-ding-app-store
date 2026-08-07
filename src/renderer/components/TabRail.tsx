import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentPropsWithRef, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { MAX_TAB_GROUPS, TAB_GROUP_COLORS } from '../../shared/contracts';
import type { TabGroup, TabId, TabState, TabWorkspace, UserSettings } from '../../shared/contracts';
import { el } from '../el';
import { Icon } from '../icons';
import { label } from '../i18n';
import { GROUP_COLOR_LABELS, TAB_META } from '../registry';
import { highlight, makeMatcher, useSurfaceSearch } from '../search';
import { newGroupId, regionsOf } from '../state/use-workspace';
import type { RegionKind, WorkspaceAction } from '../state/use-workspace';
import { SearchBox } from './SearchBox';

const ROW_HEIGHT: Record<TabWorkspace['rail']['tabHeight'], number> = { compact: 36, comfortable: 44, tall: 52 };
const ROW_GAP = 5;

/**
 * Arithmetic capacity only: one ResizeObserver, one rAF guard, no per-node measurement and therefore
 * no layout loop. Capacity is floored at one so the active tab and the overflow button always render.
 */
export function useTabOverflow(containerRef: RefObject<HTMLDivElement | null>, rowHeight: number, rowCount: number, horizontal = false): number {
  const [capacity, setCapacity] = useState(rowCount);
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const slot = horizontal ? rowHeight * 2.6 : rowHeight;
      const size = horizontal ? node.clientWidth : node.clientHeight;
      setCapacity(Math.max(1, Math.floor((size + ROW_GAP) / (slot + ROW_GAP))));
    };
    const observer = new ResizeObserver(() => { if (!frame) frame = requestAnimationFrame(measure); });
    observer.observe(node);
    measure();
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [containerRef, rowHeight, rowCount, horizontal]);
  return capacity;
}

export type TabRow =
  | { key: string; kind: 'header'; group: TabGroup }
  | { key: string; kind: 'tab'; tab: TabState; region: RegionKind; groupId: string | null; peek: boolean };

type TabRowOnly = Extract<TabRow, { kind: 'tab' }>;

export type MenuTarget = { kind: 'tab'; id: TabId } | { kind: 'group'; groupId: string };

export interface TabRailProps {
  settings: UserSettings;
  workspace: TabWorkspace;
  dispatch(action: WorkspaceAction): void;
  updatesBadge: boolean;
  onOpenPalette(): void;
  announce(message: string): void;
  openOverflow: boolean;
  onOverflowHandled(): void;
  openTabRegex: boolean;
  onTabRegexHandled(): void;
  renameGroupId: string | null;
  onRenameHandled(): void;
}

type HeaderProps = ComponentPropsWithRef<'button'> & {
  group: TabGroup; settings: UserSettings; expanded: boolean; bodyId: string; renaming: boolean;
  onRename(name: string | null): void; onToggle(): void;
};

export function TabGroupHeader({ group, settings, expanded, bodyId, renaming, onRename, onToggle, ...rest }: HeaderProps) {
  if (renaming) {
    return (
      <div className="tab-group-header renaming">
        <input
          autoFocus
          defaultValue={group.name}
          maxLength={32}
          aria-label={label(settings, `Rename group ${group.name}`, `改名分組 ${group.name}`)}
          onBlur={(event) => onRename(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); onRename((event.target as HTMLInputElement).value); }
            if (event.key === 'Escape') { event.preventDefault(); onRename(null); }
          }}
        />
      </div>
    );
  }
  return (
    <button {...rest} className="tab-group-header" aria-expanded={expanded} aria-controls={bodyId} data-color={group.color} onClick={onToggle} {...el('tab-group-header')}>
      <span className="tab-group-caret" aria-hidden="true"><Icon>chevron_right</Icon></span>
      <span className="tab-group-dot" data-color={group.color} aria-hidden="true" />
      <span className="tab-group-name">{group.name}</span>
    </button>
  );
}

type ItemProps = ComponentPropsWithRef<'button'> & {
  row: TabRowOnly; settings: UserSettings; active: boolean; badge: boolean;
  showColorBar: boolean; iconOnly: boolean; groupColor: string | null; searchLabel: ReactNode; dropTarget: boolean;
};

export function TabRailItem({ row, settings, active, badge, showColorBar, iconOnly, groupColor, searchLabel, dropTarget, ...rest }: ItemProps) {
  const meta = TAB_META[row.tab.id];
  return (
    <button
      {...rest}
      id={`tab-${row.tab.id}`}
      role="tab"
      aria-selected={active}
      aria-controls="surface-panel"
      className={active ? 'nav-tab selected' : 'nav-tab'}
      data-pinned={row.tab.pinned || undefined}
      data-peek={row.peek || undefined}
      data-drop={dropTarget || undefined}
      data-color={showColorBar && groupColor ? groupColor : undefined}
      {...el(active ? 'nav-tab-selected' : 'nav-tab')}
    >
      <Icon>{meta.icon}</Icon>
      {!iconOnly && <span className="tab-label">{searchLabel}</span>}
      {row.tab.pinned && <span className="tab-pin" aria-label={label(settings, 'Pinned', '已釘住')}><Icon>push_pin</Icon></span>}
      {badge && <span className="nav-dot" aria-label="Updates available" />}
    </button>
  );
}

export function TabOverflowSheet({ rows, settings, onActivate, onClose }: {
  rows: TabRowOnly[]; settings: UserSettings; onActivate(id: TabId): void; onClose(): void;
}) {
  return (
    <div className="popover tab-overflow-sheet" role="dialog" aria-label={label(settings, 'More tabs', '更多分頁')}>
      <header><strong>{label(settings, 'More tabs', '更多分頁')}</strong><button className="icon-button" aria-label="Close overflow menu" onClick={onClose}><Icon>close</Icon></button></header>
      <div className="command-list">
        {rows.length
          ? rows.map((row) => (
            <button key={row.key} onClick={() => { onActivate(row.tab.id); onClose(); }}>
              <Icon>{TAB_META[row.tab.id].icon}</Icon>
              <span><strong>{label(settings, TAB_META[row.tab.id].en, TAB_META[row.tab.id].yue)}</strong><small>{label(settings, 'Open this page', '開呢一頁')}</small></span>
              <Icon>arrow_forward</Icon>
            </button>
          ))
          : <p className="supporting">{label(settings, 'Every tab fits right now.', '而家所有分頁都放得落。')}</p>}
      </div>
    </div>
  );
}

export function TabContextMenu({ target, workspace, settings, dispatch, onClose, onRename, announce }: {
  target: MenuTarget; workspace: TabWorkspace; settings: UserSettings;
  dispatch(action: WorkspaceAction): void; onClose(): void; onRename(groupId: string): void; announce(message: string): void;
}) {
  const close = (message?: string) => { if (message) announce(message); onClose(); };
  if (target.kind === 'group') {
    const group = workspace.groups.find((item) => item.id === target.groupId);
    if (!group) return null;
    return (
      <div className="popover tab-context-menu" role="menu" aria-label={label(settings, 'Group actions', '分組操作')}>
        <button role="menuitem" onClick={() => { onRename(group.id); onClose(); }}>{label(settings, 'Rename group', '改分組名')}</button>
        <button role="menuitem" onClick={() => { dispatch({ type: 'group-collapse', groupId: group.id, collapsed: 'toggle' }); close(group.collapsed ? 'Group expanded' : 'Group collapsed'); }}>{group.collapsed ? label(settings, 'Expand group', '展開分組') : label(settings, 'Collapse group', '收埋分組')}</button>
        <div className="chip-row" role="group" aria-label={label(settings, 'Group colour', '分組顏色')}>
          {TAB_GROUP_COLORS.map((color) => (
            <button key={color} {...el('chip')} aria-pressed={group.color === color} data-color={color} onClick={() => { dispatch({ type: 'group-color', groupId: group.id, color }); close(`Group colour ${color}`); }}>
              {label(settings, GROUP_COLOR_LABELS[color].en, GROUP_COLOR_LABELS[color].yue)}
            </button>
          ))}
        </div>
        <button role="menuitem" className="danger" onClick={() => { dispatch({ type: 'group-delete', groupId: group.id }); close('Group deleted; its tabs moved out of the group'); }}>{label(settings, 'Delete group (tabs are kept)', '刪除分組（分頁會留低）')}</button>
      </div>
    );
  }
  const tab = workspace.tabs.find((item) => item.id === target.id);
  if (!tab) return null;
  const meta = TAB_META[tab.id];
  return (
    <div className="popover tab-context-menu" role="menu" aria-label={label(settings, `${meta.en} actions`, `${meta.yue} 操作`)}>
      <button role="menuitem" onClick={() => { dispatch({ type: 'pin', id: tab.id, pinned: 'toggle' }); close(tab.pinned ? `${meta.en} unpinned` : `${meta.en} pinned`); }}>{tab.pinned ? label(settings, 'Unpin tab', '取消釘住') : label(settings, 'Pin tab', '釘住分頁')}</button>
      <button role="menuitem" onClick={() => { dispatch({ type: 'move', id: tab.id, direction: -1 }); close(`${meta.en} moved up`); }}>{label(settings, 'Move up', '上移')}</button>
      <button role="menuitem" onClick={() => { dispatch({ type: 'move', id: tab.id, direction: 1 }); close(`${meta.en} moved down`); }}>{label(settings, 'Move down', '下移')}</button>
      {!tab.pinned && workspace.groups.length < MAX_TAB_GROUPS && (
        <button role="menuitem" onClick={() => {
          const group: TabGroup = { id: newGroupId(), name: `Group ${workspace.groups.length + 1}`, color: TAB_GROUP_COLORS[(workspace.groups.length + 1) % TAB_GROUP_COLORS.length], collapsed: false };
          dispatch({ type: 'group-create', group, memberId: tab.id });
          onRename(group.id);
          onClose();
        }}>{label(settings, 'New group with this tab', '用呢個分頁開新組')}</button>
      )}
      {!tab.pinned && workspace.groups.filter((group) => group.id !== tab.groupId).map((group) => (
        <button key={group.id} role="menuitem" onClick={() => { dispatch({ type: 'group-assign', id: tab.id, groupId: group.id }); close(`${meta.en} added to ${group.name}`); }}>{label(settings, `Add to ${group.name}`, `加入 ${group.name}`)}</button>
      ))}
      {tab.groupId && <button role="menuitem" onClick={() => { dispatch({ type: 'group-remove', id: tab.id }); close(`${meta.en} removed from its group`); }}>{label(settings, 'Remove from group', '離開分組')}</button>}
    </div>
  );
}

export function TabRail({ settings, workspace, dispatch, updatesBadge, onOpenPalette, announce, openOverflow, onOverflowHandled, openTabRegex, onTabRegexHandled, renameGroupId: renameRequest, onRenameHandled }: TabRailProps) {
  const search = useSurfaceSearch('tabs');
  const stripRef = useRef<HTMLDivElement | null>(null);
  const stopRefs = useRef(new Map<string, HTMLButtonElement>());
  const [focusKey, setFocusKey] = useState<string>(`t:${workspace.activeTabId}`);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [dragId, setDragId] = useState<TabId | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);

  const matcher = useMemo(() => makeMatcher(search.state), [search.state]);
  const horizontal = workspace.rail.side === 'top';

  const { rows, matchCount } = useMemo(() => {
    const built: TabRow[] = [];
    let matched = 0;
    for (const region of regionsOf(workspace)) {
      const visible = region.tabs.filter((tab) => {
        const hit = matcher(`${TAB_META[tab.id].en}\n${TAB_META[tab.id].yue}\n${tab.id}`);
        if (hit) matched += 1;
        return hit || tab.id === workspace.activeTabId;
      });
      if (!visible.length) continue;
      if (region.kind === 'group' && region.group) {
        built.push({ key: `h:${region.group.id}`, kind: 'header', group: region.group });
        for (const tab of visible) {
          if (region.group.collapsed && tab.id !== workspace.activeTabId) continue;
          built.push({ key: `t:${tab.id}`, kind: 'tab', tab, region: 'group', groupId: region.group.id, peek: region.group.collapsed });
        }
      } else {
        for (const tab of visible) built.push({ key: `t:${tab.id}`, kind: 'tab', tab, region: region.kind, groupId: null, peek: false });
      }
    }
    return { rows: built, matchCount: matched };
  }, [workspace, matcher]);

  const capacity = useTabOverflow(stripRef, ROW_HEIGHT[workspace.rail.tabHeight], rows.length, horizontal);
  const overflowing = workspace.rail.overflowMode === 'menu' && rows.length > capacity;
  const budget = overflowing ? Math.max(1, capacity - 1) : rows.length;

  const { visibleRows, overflowRows } = useMemo(() => {
    if (!overflowing) return { visibleRows: rows, overflowRows: [] as TabRowOnly[] };
    const keep = new Set<string>();
    for (const row of rows) if (row.kind === 'tab' && (row.tab.pinned || row.tab.id === workspace.activeTabId)) keep.add(row.key);
    for (const row of rows) {
      if (keep.size >= budget) break;
      if (row.kind === 'tab') keep.add(row.key);
    }
    const keptGroups = new Set(rows.filter((row): row is TabRowOnly => row.kind === 'tab' && keep.has(row.key) && Boolean(row.groupId)).map((row) => row.groupId));
    return {
      visibleRows: rows.filter((row) => (row.kind === 'header' ? keptGroups.has(row.group.id) : keep.has(row.key))),
      overflowRows: rows.filter((row): row is TabRowOnly => row.kind === 'tab' && !keep.has(row.key)),
    };
  }, [rows, overflowing, budget, workspace.activeTabId]);

  useEffect(() => {
    if (visibleRows.length && !visibleRows.some((row) => row.key === focusKey)) setFocusKey(visibleRows[0].key);
  }, [visibleRows, focusKey]);

  useEffect(() => { if (openOverflow) { setOverflowOpen(true); onOverflowHandled(); } }, [openOverflow, onOverflowHandled]);
  useEffect(() => { if (renameRequest) { setRenamingGroupId(renameRequest); onRenameHandled(); } }, [renameRequest, onRenameHandled]);

  useEffect(() => {
    if (!menu && !overflowOpen) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setMenu(null);
      setOverflowOpen(false);
    };
    window.addEventListener('keydown', listener, true);
    return () => window.removeEventListener('keydown', listener, true);
  }, [menu, overflowOpen]);

  const focusStop = useCallback((key: string) => {
    setFocusKey(key);
    stopRefs.current.get(key)?.focus();
  }, []);

  const activate = useCallback((id: TabId) => {
    dispatch({ type: 'activate', id });
    setFocusKey(`t:${id}`);
  }, [dispatch]);

  const moveFocus = (from: number, delta: number) => {
    if (!visibleRows.length) return;
    focusStop(visibleRows[(from + delta + visibleRows.length) % visibleRows.length].key);
  };

  const onRowKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number, row: TabRow) => {
    const key = event.key;
    if (event.altKey && (key === 'ArrowUp' || key === 'ArrowDown') && row.kind === 'tab') {
      event.preventDefault();
      dispatch({ type: 'move', id: row.tab.id, direction: key === 'ArrowUp' ? -1 : 1 });
      announce(`${TAB_META[row.tab.id].en} moved ${key === 'ArrowUp' ? 'up' : 'down'}`);
      return;
    }
    if (key === 'ArrowDown' || (horizontal && key === 'ArrowRight' && row.kind === 'tab')) { event.preventDefault(); moveFocus(index, 1); return; }
    if (key === 'ArrowUp' || (horizontal && key === 'ArrowLeft' && row.kind === 'tab')) { event.preventDefault(); moveFocus(index, -1); return; }
    if (key === 'Home' && visibleRows.length) { event.preventDefault(); focusStop(visibleRows[0].key); return; }
    if (key === 'End' && visibleRows.length) { event.preventDefault(); focusStop(visibleRows[visibleRows.length - 1].key); return; }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (row.kind === 'tab') activate(row.tab.id);
      else dispatch({ type: 'group-collapse', groupId: row.group.id, collapsed: 'toggle' });
      return;
    }
    if (key === 'ArrowRight') {
      event.preventDefault();
      if (row.kind === 'header' && row.group.collapsed) dispatch({ type: 'group-collapse', groupId: row.group.id, collapsed: false });
      else setMenu(row.kind === 'tab' ? { kind: 'tab', id: row.tab.id } : { kind: 'group', groupId: row.group.id });
      return;
    }
    if (key === 'ArrowLeft') {
      event.preventDefault();
      if (row.kind === 'header') dispatch({ type: 'group-collapse', groupId: row.group.id, collapsed: true });
      else if (row.groupId) focusStop(`h:${row.groupId}`);
      return;
    }
    if (key === 'ContextMenu' || (key === 'F10' && event.shiftKey)) {
      event.preventDefault();
      setMenu(row.kind === 'tab' ? { kind: 'tab', id: row.tab.id } : { kind: 'group', groupId: row.group.id });
    }
  };

  const registerStop = (key: string) => (node: HTMLButtonElement | null) => {
    if (node) stopRefs.current.set(key, node);
    else stopRefs.current.delete(key);
  };

  const groupColorOf = (groupId: string | null) => workspace.groups.find((group) => group.id === groupId)?.color ?? null;

  const renderTab = (row: TabRowOnly, index: number) => {
    const meta = TAB_META[row.tab.id];
    const iconOnly = workspace.rail.labelMode === 'icon' || (row.tab.pinned && workspace.rail.pinnedIconOnly);
    return (
      <TabRailItem
        key={row.key}
        row={row}
        settings={settings}
        active={workspace.activeTabId === row.tab.id}
        badge={workspace.rail.showBadges && row.tab.id === 'updates' && updatesBadge}
        showColorBar={workspace.rail.showGroupColorBar}
        groupColor={groupColorOf(row.groupId)}
        iconOnly={iconOnly}
        dropTarget={dropKey === row.key}
        searchLabel={highlight(search.state, label(settings, meta.en, meta.yue))}
        ref={registerStop(row.key)}
        tabIndex={focusKey === row.key ? 0 : -1}
        title={label(settings, meta.en, meta.yue)}
        draggable
        onDragStart={(event) => { setDragId(row.tab.id); event.dataTransfer.effectAllowed = 'move'; }}
        onDragOver={(event) => { if (dragId && dragId !== row.tab.id) { event.preventDefault(); setDropKey(row.key); } }}
        onDragLeave={() => setDropKey((current) => (current === row.key ? null : current))}
        onDrop={(event) => { event.preventDefault(); if (dragId && dragId !== row.tab.id) dispatch({ type: 'move-to', id: dragId, targetId: row.tab.id }); setDragId(null); setDropKey(null); }}
        onDragEnd={() => { setDragId(null); setDropKey(null); }}
        onFocus={() => setFocusKey(row.key)}
        onKeyDown={(event) => onRowKeyDown(event, index, row)}
        onContextMenu={(event) => { event.preventDefault(); setMenu({ kind: 'tab', id: row.tab.id }); }}
        onClick={() => activate(row.tab.id)}
      />
    );
  };

  const blocks: ReactNode[] = [];
  let cursor = 0;
  while (cursor < visibleRows.length) {
    const row = visibleRows[cursor];
    if (row.kind === 'header') {
      const headerIndex = cursor;
      const bodyId = `tab-group-${row.group.id}`;
      const body: TabRowOnly[] = [];
      cursor += 1;
      while (cursor < visibleRows.length) {
        const next = visibleRows[cursor];
        if (next.kind !== 'tab' || next.groupId !== row.group.id) break;
        body.push(next);
        cursor += 1;
      }
      blocks.push(
        <div className="tab-region" key={row.key}>
          <TabGroupHeader
            group={row.group}
            settings={settings}
            expanded={!row.group.collapsed}
            bodyId={bodyId}
            renaming={renamingGroupId === row.group.id}
            ref={registerStop(row.key)}
            tabIndex={focusKey === row.key ? 0 : -1}
            onFocus={() => setFocusKey(row.key)}
            onKeyDown={(event) => onRowKeyDown(event, headerIndex, row)}
            onContextMenu={(event) => { event.preventDefault(); setMenu({ kind: 'group', groupId: row.group.id }); }}
            onToggle={() => dispatch({ type: 'group-collapse', groupId: row.group.id, collapsed: 'toggle' })}
            onRename={(name) => {
              if (name !== null) dispatch({ type: 'group-rename', groupId: row.group.id, name });
              setRenamingGroupId(null);
              window.setTimeout(() => focusStop(row.key), 0);
            }}
          />
          <div role="tablist" aria-orientation={horizontal ? 'horizontal' : 'vertical'} aria-label={row.group.name} id={bodyId} className="tab-group-body" hidden={row.group.collapsed && body.length === 0}>
            {body.map((child) => renderTab(child, visibleRows.indexOf(child)))}
          </div>
        </div>,
      );
      continue;
    }
    const region = row.region;
    const block: TabRowOnly[] = [];
    while (cursor < visibleRows.length) {
      const next = visibleRows[cursor];
      if (next.kind !== 'tab' || next.region !== region || next.groupId) break;
      block.push(next);
      cursor += 1;
    }
    blocks.push(
      <div
        key={`${region}-${block[0]?.key ?? cursor}`}
        className={region === 'pinned' ? 'tab-region pinned' : 'tab-region'}
        role="tablist"
        aria-orientation={horizontal ? 'horizontal' : 'vertical'}
        aria-label={region === 'pinned' ? label(settings, 'Pinned tabs', '釘住嘅分頁') : label(settings, 'Tabs', '分頁')}
      >
        {block.map((child) => renderTab(child, visibleRows.indexOf(child)))}
      </div>,
    );
  }

  return (
    <nav className="navigation" aria-label={label(settings, 'Tabs', '分頁')} {...el('nav-rail')}>
      <div className="nav-title" {...el('nav-title')}>Ding Ding</div>
      <SearchBox surface="tabs" className="tab-search" placeholder={label(settings, 'Search tabs', '搵分頁')} openBuilder={openTabRegex} onBuilderHandled={onTabRegexHandled} />
      <div className="tab-strip" ref={stripRef}>
        {blocks}
        {Boolean(search.state.query) && matchCount === 0 && (
          <div className="tab-empty" role="status">
            <p>{label(settings, 'No tab matches this search.', '冇分頁配到呢個搜尋。')}</p>
            <button className="text-button" onClick={() => search.clear()}>{label(settings, 'Clear', '清除')}</button>
          </div>
        )}
      </div>
      {overflowing && (
        <button className="tab-overflow-button" aria-haspopup="dialog" aria-expanded={overflowOpen} onClick={() => setOverflowOpen((open) => !open)}>
          <Icon>more_horiz</Icon><span>{label(settings, `${overflowRows.length} more`, `仲有 ${overflowRows.length} 個`)}</span>
        </button>
      )}
      {overflowOpen && <TabOverflowSheet rows={overflowRows} settings={settings} onActivate={activate} onClose={() => setOverflowOpen(false)} />}
      {menu && (
        <TabContextMenu target={menu} workspace={workspace} settings={settings} dispatch={dispatch} announce={announce} onRename={(groupId) => setRenamingGroupId(groupId)} onClose={() => setMenu(null)} />
      )}
      <button className="palette-hint" onClick={onOpenPalette} {...el('palette-hint')}>
        <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd><span>Commands</span>
      </button>
    </nav>
  );
}
