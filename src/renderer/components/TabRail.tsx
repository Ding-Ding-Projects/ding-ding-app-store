import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentPropsWithRef, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { MAX_TAB_GROUPS, TAB_GROUP_COLORS } from '../../shared/contracts';
import type { LockTarget, TabGroup, TabId, TabState, TabWorkspace, UserSettings } from '../../shared/contracts';
import { el } from '../el';
import { Icon } from '../icons';
import { label } from '../i18n';
import { GROUP_COLOR_LABELS, TAB_META } from '../registry';
import { EMPTY_SEARCH, compile, highlight, makeMatcher, SearchContext, useSurfaceSearch } from '../search';
import { newGroupId, regionsOf } from '../state/use-workspace';
import type { RegionKind, WorkspaceAction } from '../state/use-workspace';
import type { LocksApi } from '../state/use-locks';
import { SearchBox, searchInputId } from './SearchBox';
import { dialogCopy } from '../dialog-emoji';

const ROW_HEIGHT: Record<TabWorkspace['rail']['tabHeight'], number> = { compact: 36, comfortable: 44, tall: 52 };
const ROW_GAP = 5;

export interface TabShortcut {
  readonly display: string;
  readonly aria: string;
  readonly key: string;
  readonly ctrlKey?: true;
  readonly shiftKey?: true;
  readonly altKey?: true;
}

export const TAB_SHORTCUTS = {
  pin: { display: 'Ctrl+Shift+P', aria: 'Control+Shift+P', key: 'p', ctrlKey: true, shiftKey: true },
  newGroup: { display: 'Ctrl+Shift+G', aria: 'Control+Shift+G', key: 'g', ctrlKey: true, shiftKey: true },
  railSearch: { display: 'Ctrl+Shift+K', aria: 'Control+Shift+K', key: 'k', ctrlKey: true, shiftKey: true },
  moveUp: { display: 'Alt+↑', aria: 'Alt+ArrowUp', key: 'ArrowUp', altKey: true },
  moveDown: { display: 'Alt+↓', aria: 'Alt+ArrowDown', key: 'ArrowDown', altKey: true },
} as const satisfies Record<string, TabShortcut>;

export function matchesTabShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>,
  shortcut: TabShortcut,
): boolean {
  return event.key.toLocaleLowerCase() === shortcut.key.toLocaleLowerCase()
    && event.ctrlKey === Boolean(shortcut.ctrlKey)
    && event.shiftKey === Boolean(shortcut.shiftKey)
    && event.altKey === Boolean(shortcut.altKey)
    && !event.metaKey;
}

export function nextTabGroup(workspace: TabWorkspace): TabGroup {
  const index = workspace.groups.length + 1;
  return { id: newGroupId(), name: `Group ${index}`, color: TAB_GROUP_COLORS[index % TAB_GROUP_COLORS.length], collapsed: false };
}

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
  locks?: LocksApi;
  onEditAppearance(target: MenuTarget, returnFocus: HTMLElement | null): void;
  schoolModeEnabled?: boolean;
  onManageLock?(target: LockTarget): void;
}

type HeaderProps = ComponentPropsWithRef<'button'> & {
  group: TabGroup; settings: UserSettings; expanded: boolean; bodyId: string; renaming: boolean; locked: boolean;
  onRename(name: string | null): void; onToggle(): void;
};

export function TabGroupHeader({ group, settings, expanded, bodyId, renaming, locked, onRename, onToggle, ...rest }: HeaderProps) {
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
    <button {...rest} id={`tab-group-header-${group.id}`} className="tab-group-header" aria-expanded={expanded} aria-controls={bodyId} data-color={group.color} onClick={onToggle} {...el('tab-group-header')}>
      <span className="tab-group-caret" aria-hidden="true"><Icon>chevron_right</Icon></span>
      <span className="tab-group-dot" data-color={group.color} aria-hidden="true" />
      <span className="tab-group-name">{group.name}</span>
      {locked && <span className="tab-lock" aria-label={label(settings, 'Locked group', '已鎖定分組')}><Icon>lock</Icon></span>}
    </button>
  );
}

type ItemProps = ComponentPropsWithRef<'button'> & {
  row: TabRowOnly; settings: UserSettings; active: boolean; badge: boolean; locked: boolean;
  showColorBar: boolean; iconOnly: boolean; groupColor: string | null; searchLabel: ReactNode; dropTarget: boolean;
};

export function TabRailItem({ row, settings, active, badge, locked, showColorBar, iconOnly, groupColor, searchLabel, dropTarget, ...rest }: ItemProps) {
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
      {locked && <span className="tab-lock" aria-label={label(settings, 'Locked tab', '已鎖定分頁')}><Icon>lock</Icon></span>}
      {badge && <span className="nav-dot" aria-label="Updates available" />}
    </button>
  );
}

export function TabOverflowSheet({ rows, settings, onActivate, onClose }: {
  rows: TabRowOnly[]; settings: UserSettings; onActivate(id: TabId): void; onClose(): void;
}) {
  return (
    <div className="popover tab-overflow-sheet" role="dialog" aria-label={label(settings, 'More tabs', '更多分頁')}>
      <header><strong>{dialogCopy(settings, label(settings, 'More tabs', '更多分頁'), '🗂️')}</strong><button className="icon-button" aria-label="Close overflow menu" onClick={onClose}><Icon>close</Icon></button></header>
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

export function TabContextMenu({ target, workspace, settings, locks, dispatch, onClose, onRename, onMovePicker, onEditAppearance, returnFocus, onManageLock, announce }: {
  target: MenuTarget; workspace: TabWorkspace; settings: UserSettings;
  dispatch(action: WorkspaceAction): void; onClose(): void; onRename(groupId: string): void; onMovePicker(tabId: TabId): void;
  locks?: LocksApi;
  onEditAppearance?(target: MenuTarget, returnFocus: HTMLElement | null): void; returnFocus?: HTMLElement | null; onManageLock?(target: LockTarget): void; announce(message: string): void;
}) {
  const menuSearch = useSurfaceSearch('tabs.menu');
  const menuMatcher = useMemo(() => makeMatcher(menuSearch.state), [menuSearch.state]);
  const [credential, setCredential] = useState('');
  const item = (text: string, node: ReactNode) => menuMatcher(text) ? node : null;
  useEffect(() => { menuSearch.clear(); // Search state is intentionally reset for each newly opened target.
    setCredential('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  const close = (message?: string) => { if (message) announce(message); onClose(); };
  if (target.kind === 'group') {
    const group = workspace.groups.find((item) => item.id === target.groupId);
    if (!group) return null;
    const lockTarget: LockTarget = { targetKind: 'group', targetId: group.id };
    const lock = locks?.state.records.find((record) => record.targetKind === 'group' && record.targetId === group.id);
    return (
      <div className="popover tab-context-menu" role="menu" aria-label={label(settings, 'Group actions', '分組操作')}>
        <SearchBox surface="tabs.menu" settings={settings} placeholder={label(settings, 'Search menu actions', '搜尋選單操作')} />
        {item('Rename group 改分組名', <button role="menuitem" key="rename" onClick={() => { onRename(group.id); onClose(); }}>{label(settings, 'Rename group', '改分組名')}</button>)}
        {item(`${group.collapsed ? 'Expand' : 'Collapse'} group`, <button role="menuitem" key="collapse" onClick={() => { dispatch({ type: 'group-collapse', groupId: group.id, collapsed: 'toggle' }); close(group.collapsed ? 'Group expanded' : 'Group collapsed'); }}>{group.collapsed ? label(settings, 'Expand group', '展開分組') : label(settings, 'Collapse group', '收埋分組')}</button>)}
        {item('Group colour', <div className="chip-row" role="group" key="colour" aria-label={label(settings, 'Group colour', '分組顏色')}>
          {TAB_GROUP_COLORS.map((color) => (
            <button key={color} {...el('chip')} aria-pressed={group.color === color} data-color={color} onClick={() => { dispatch({ type: 'group-color', groupId: group.id, color }); close(`Group colour ${color}`); }}>
              {label(settings, GROUP_COLOR_LABELS[color].en, GROUP_COLOR_LABELS[color].yue)}
            </button>
          ))}
        </div>)}
        {item('Edit group appearance appearance colour font', <button role="menuitem" key="appearance" onClick={() => { onEditAppearance?.(target, returnFocus ?? null); onClose(); }}>{label(settings, 'Edit group appearance…', '編輯分組外觀…')}</button>)}
        {item('Manage group lock', <button role="menuitem" key="lock-manage" onClick={() => { onManageLock?.(lockTarget); onClose(); }}>{lock ? label(settings, 'Manage group lock', '管理分組鎖') : label(settings, 'Set group lock…', '設定分組鎖…')}</button>)}
        {lock?.locked && item('Unlock group', <div key="unlock" className="menu-credential-row"><label htmlFor={`unlock-group-${group.id}`}>{label(settings, lock.credentialKind === 'totp' ? 'Current TOTP code' : 'Password', lock.credentialKind === 'totp' ? '目前 TOTP 驗證碼' : '密碼')}<input id={`unlock-group-${group.id}`} type="password" inputMode={lock.credentialKind === 'totp' ? 'numeric' : undefined} autoComplete={lock.credentialKind === 'totp' ? 'one-time-code' : 'current-password'} value={credential} onChange={(event) => setCredential(event.target.value)} /></label><button role="menuitem" disabled={!locks?.state.vaultAvailable || credential.length < (lock.credentialKind === 'totp' ? 6 : 4)} onClick={() => void locks?.unlock({ ...lockTarget, credential })}>{label(settings, 'Unlock', '解鎖')}</button><small>{label(settings, `Forgotten it? Delete ${locks?.state.recoveryPath ?? ''} yourself.`, `唔記得？自己刪除 ${locks?.state.recoveryPath ?? ''}。`)} <button type="button" className="text-button" onClick={() => { onManageLock?.(lockTarget); onClose(); }}>{label(settings, 'Open Support Tickets', '開支援票')}</button></small></div>)}
        {lock && !lock.locked && item('Lock group again', <button role="menuitem" key="lock-again" onClick={() => void locks?.lockAgain(lockTarget)}>{label(settings, 'Lock group again', '重新鎖定分組')}</button>)}
        {item('Delete group', <button role="menuitem" key="delete" className="danger" onClick={() => { dispatch({ type: 'group-delete', groupId: group.id }); close('Group deleted; its tabs moved out of the group'); }}>{label(settings, 'Delete group (tabs are kept)', '刪除分組（分頁會留低）')}</button>)}
      </div>
    );
  }
  const tab = workspace.tabs.find((item) => item.id === target.id);
  if (!tab) return null;
  const meta = TAB_META[tab.id];
  const lockTarget: LockTarget = { targetKind: 'tab', targetId: tab.id };
  const lock = locks?.state.records.find((record) => record.targetKind === 'tab' && record.targetId === tab.id);
  const togglePin = () => { dispatch({ type: 'pin', id: tab.id, pinned: 'toggle' }); close(tab.pinned ? `${meta.en} unpinned` : `${meta.en} pinned`); };
  const move = (direction: -1 | 1) => { dispatch({ type: 'move', id: tab.id, direction }); close(`${meta.en} moved ${direction < 0 ? 'up' : 'down'}`); };
  const createGroup = () => {
    if (tab.pinned || workspace.groups.length >= MAX_TAB_GROUPS) return;
    const group = nextTabGroup(workspace);
    dispatch({ type: 'group-create', group, memberId: tab.id });
    onRename(group.id);
    onClose();
  };
  const onShortcut = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (matchesTabShortcut(event.nativeEvent, TAB_SHORTCUTS.pin)) { event.preventDefault(); togglePin(); return; }
    if (matchesTabShortcut(event.nativeEvent, TAB_SHORTCUTS.moveUp)) { event.preventDefault(); move(-1); return; }
    if (matchesTabShortcut(event.nativeEvent, TAB_SHORTCUTS.moveDown)) { event.preventDefault(); move(1); return; }
    if (!tab.pinned && workspace.groups.length < MAX_TAB_GROUPS && matchesTabShortcut(event.nativeEvent, TAB_SHORTCUTS.newGroup)) { event.preventDefault(); createGroup(); }
  };
  return (
    <div className="popover tab-context-menu" role="menu" aria-label={label(settings, `${meta.en} actions`, `${meta.yue} 操作`)} onKeyDown={onShortcut}>
      <SearchBox surface="tabs.menu" settings={settings} placeholder={label(settings, 'Search menu actions', '搜尋選單操作')} />
      {item(`Pin tab ${TAB_SHORTCUTS.pin.display}`, <button role="menuitem" key="pin" aria-keyshortcuts={TAB_SHORTCUTS.pin.aria} onClick={togglePin}><span>{tab.pinned ? label(settings, 'Unpin tab', '取消釘住') : label(settings, 'Pin tab', '釘住分頁')}</span><kbd aria-hidden="true">{TAB_SHORTCUTS.pin.display}</kbd></button>)}
      {item(`Move up ${TAB_SHORTCUTS.moveUp.display}`, <button role="menuitem" key="up" aria-keyshortcuts={TAB_SHORTCUTS.moveUp.aria} onClick={() => move(-1)}><span>{label(settings, 'Move up', '上移')}</span><kbd aria-hidden="true">{TAB_SHORTCUTS.moveUp.display}</kbd></button>)}
      {item(`Move down ${TAB_SHORTCUTS.moveDown.display}`, <button role="menuitem" key="down" aria-keyshortcuts={TAB_SHORTCUTS.moveDown.aria} onClick={() => move(1)}><span>{label(settings, 'Move down', '下移')}</span><kbd aria-hidden="true">{TAB_SHORTCUTS.moveDown.display}</kbd></button>)}
      {tab.open && !tab.pinned && item('Close tab', <button role="menuitem" key="close" onClick={() => { dispatch({ type: 'close', id: tab.id }); close(`${meta.en} closed`); }}>{label(settings, 'Close tab', '關閉分頁')}</button>)}
      {!tab.open && item('Reopen tab', <button role="menuitem" key="reopen" onClick={() => { dispatch({ type: 'reopen', id: tab.id }); close(`${meta.en} reopened`); }}>{label(settings, 'Reopen tab', '重新開啟分頁')}</button>)}
      {!tab.pinned && workspace.groups.length < MAX_TAB_GROUPS && item(`New group ${TAB_SHORTCUTS.newGroup.display}`,
        <button role="menuitem" aria-keyshortcuts={TAB_SHORTCUTS.newGroup.aria} onClick={createGroup}><span>{label(settings, 'New group with this tab', '用呢個分頁開新組')}</span><kbd aria-hidden="true">{TAB_SHORTCUTS.newGroup.display}</kbd></button>
      )}
      {!tab.pinned && workspace.groups.some((group) => group.id !== tab.groupId) && item('Move into group', <button role="menuitem" key="move-group" onClick={() => { onMovePicker(tab.id); onClose(); }}>{label(settings, 'Move… into group…', '移動…去分組…')}</button>)}
      {tab.groupId && item('Remove from group', <button role="menuitem" key="remove" onClick={() => { dispatch({ type: 'group-remove', id: tab.id }); close(`${meta.en} removed from its group`); }}>{label(settings, 'Remove from group', '離開分組')}</button>)}
      {item('Edit tab appearance appearance colour font', <button role="menuitem" key="appearance" onClick={() => { onEditAppearance?.(target, returnFocus ?? null); onClose(); }}>{label(settings, 'Edit tab appearance…', '編輯分頁外觀…')}</button>)}
      {item('Manage tab lock', <button role="menuitem" key="lock-manage" onClick={() => { onManageLock?.(lockTarget); onClose(); }}>{lock ? label(settings, 'Manage tab lock', '管理分頁鎖') : label(settings, 'Set tab lock…', '設定分頁鎖…')}</button>)}
      {lock?.locked && item('Unlock tab', <div key="unlock" className="menu-credential-row"><label htmlFor={`unlock-tab-${tab.id}`}>{label(settings, lock.credentialKind === 'totp' ? 'Current TOTP code' : 'Password', lock.credentialKind === 'totp' ? '目前 TOTP 驗證碼' : '密碼')}<input id={`unlock-tab-${tab.id}`} type="password" inputMode={lock.credentialKind === 'totp' ? 'numeric' : undefined} autoComplete={lock.credentialKind === 'totp' ? 'one-time-code' : 'current-password'} value={credential} onChange={(event) => setCredential(event.target.value)} /></label><button role="menuitem" disabled={!locks?.state.vaultAvailable || credential.length < (lock.credentialKind === 'totp' ? 6 : 4)} onClick={() => void locks?.unlock({ ...lockTarget, credential })}>{label(settings, 'Unlock', '解鎖')}</button><small>{label(settings, `Forgotten it? Delete ${locks?.state.recoveryPath ?? ''} yourself.`, `唔記得？自己刪除 ${locks?.state.recoveryPath ?? ''}。`)} <button type="button" className="text-button" onClick={() => { onManageLock?.(lockTarget); onClose(); }}>{label(settings, 'Open Support Tickets', '開支援票')}</button></small></div>)}
      {lock && !lock.locked && item('Lock tab again', <button role="menuitem" key="lock-again" onClick={() => void locks?.lockAgain(lockTarget)}>{label(settings, 'Lock tab again', '重新鎖定分頁')}</button>)}
    </div>
  );
}

export function TabMoveGroupPicker({ tabId, workspace, settings, dispatch, onClose, announce }: {
  tabId: TabId; workspace: TabWorkspace; settings: UserSettings;
  dispatch(action: WorkspaceAction): void; onClose(): void; announce(message: string): void;
}) {
  const search = useSurfaceSearch('tabs.move-group');
  const matcher = useMemo(() => makeMatcher(search.state), [search.state]);
  const tab = workspace.tabs.find((candidate) => candidate.id === tabId);
  if (!tab) return null;
  const groups = workspace.groups.filter((group) => group.id !== tab.groupId && matcher(`${group.name}\n${group.color}`));
  const createGroup = () => {
    if (workspace.groups.length >= MAX_TAB_GROUPS || tab.pinned) return;
    const group = nextTabGroup(workspace);
    dispatch({ type: 'group-create', group, memberId: tab.id });
    announce(`${TAB_META[tab.id].en} moved into ${group.name}`);
    onClose();
  };
  return (
    <div className="popover tab-group-picker" role="dialog" aria-label={label(settings, 'Move tab into group', '將分頁移動到分組')}>
      <header><strong>{dialogCopy(settings, label(settings, 'Move tab into group', '將分頁移動到分組'), '📁')}</strong><button className="icon-button" aria-label={label(settings, 'Close group picker', '關閉分組選擇器')} onClick={onClose}><Icon>close</Icon></button></header>
      <SearchBox surface="tabs.move-group" settings={settings} placeholder={label(settings, 'Search groups', '搜尋分組')} />
      <div className="command-list" role="listbox" aria-label={label(settings, 'Available groups', '可用分組')}>
        {groups.map((group) => {
          const count = workspace.tabs.filter((candidate) => candidate.groupId === group.id).length;
          return <button key={group.id} role="option" onClick={() => { dispatch({ type: 'group-assign', id: tab.id, groupId: group.id }); announce(`${TAB_META[tab.id].en} moved to ${group.name}`); onClose(); }}><span className="tab-group-dot" data-color={group.color} aria-hidden="true" /><span><strong>{group.name}</strong><small>{label(settings, `${count} member${count === 1 ? '' : 's'}`, `${count} 個成員`)}</small></span><Icon>arrow_forward</Icon></button>;
        })}
        {!groups.length && <p className="supporting">{label(settings, 'No other groups match this search.', '冇其他分組符合呢個搜尋。')}</p>}
      </div>
      {!tab.pinned && workspace.groups.length < MAX_TAB_GROUPS && <button type="button" className="tonal-button" onClick={createGroup}><Icon>add</Icon>{label(settings, 'Create new group', '建立新分組')}</button>}
    </div>
  );
}

type BulkCloseMode = 'containing' | 'not-containing';

/**
 * Local, reversible bulk tab management. The preview is computed from visible labels only;
 * pinned tabs are protected unless the user explicitly includes them. A second, plain-language
 * confirmation click is used instead of a type-to-confirm gate, and every closed tab can be reopened.
 */
export function TabBulkClosePanel({ workspace, settings, dispatch, announce, schoolModeEnabled = false }: {
  workspace: TabWorkspace; settings: UserSettings; dispatch(action: WorkspaceAction): void; announce(message: string): void; schoolModeEnabled?: boolean;
}) {
  const search = useSurfaceSearch('tabs.bulk-close');
  const matcher = useMemo(() => makeMatcher(search.state), [search.state]);
  const invalidRegex = Boolean(search.state.regex && !compile(search.state.regex));
  const [mode, setMode] = useState<BulkCloseMode | null>(null);
  const [includePinned, setIncludePinned] = useState(false);
  const [armed, setArmed] = useState(false);
  const openTabs = workspace.tabs.filter((tab) => tab.open && !(schoolModeEnabled && tab.id === 'authenticator'));
  const closedTabs = workspace.tabs.filter((tab) => !tab.open && !(schoolModeEnabled && tab.id === 'authenticator'));
  const candidates = useMemo(() => openTabs.filter((tab) => {
    const text = `${TAB_META[tab.id].en}\n${TAB_META[tab.id].yue}\n${tab.id}`;
    const hit = matcher(text);
    if (!mode || !search.state.query || invalidRegex) return false;
    return (mode === 'containing' ? hit : !hit) && (includePinned || !tab.pinned);
  }), [openTabs, matcher, mode, search.state.query, includePinned, invalidRegex]);
  const matchingOpen = useMemo(() => openTabs.filter((tab) => matcher(`${TAB_META[tab.id].en}\n${TAB_META[tab.id].yue}\n${tab.id}`)), [openTabs, matcher]);
  const ids = candidates.map((tab) => tab.id);
  const excludedPinned = matchingOpen.filter((tab) => tab.pinned && !includePinned).length;
  const activateMode = (next: BulkCloseMode) => { setMode(next); setArmed(false); };
  useEffect(() => { setArmed(false); }, [search.state, includePinned, ids.join(',')]);
  const apply = () => {
    if (!ids.length) return;
    if (!armed) { setArmed(true); return; }
    dispatch({ type: 'close-many', ids });
    announce(`${ids.length} tabs closed; reopen them from this panel`);
    setMode(null);
    setArmed(false);
  };
  return (
    <details className="tab-management-panel">
      <summary>{label(settings, search.state.query ? 'Tab actions and discovery · filtered' : 'Tab actions and discovery', search.state.query ? '分頁操作同探索 · 已篩選' : '分頁操作同探索')}</summary>
      <div className="tab-management-body">
      <SearchBox surface="tabs.bulk-close" settings={settings} placeholder={label(settings, 'Filter tab labels', '篩選分頁標籤')} />
        <div className="tab-bulk-actions" role="group" aria-label={label(settings, 'Bulk tab actions', '批量分頁操作')}>
          <button type="button" className={mode === 'containing' ? 'tonal-button selected' : 'tonal-button'} onClick={() => activateMode('containing')} disabled={!search.state.query}>
            {label(settings, 'Close tabs containing text', '關閉包含文字嘅分頁')}
          </button>
          <button type="button" className={mode === 'not-containing' ? 'tonal-button selected' : 'tonal-button'} onClick={() => activateMode('not-containing')} disabled={!search.state.query}>
            {label(settings, 'Close tabs not containing text', '關閉唔包含文字嘅分頁')}
          </button>
          <label className="switch-row"><input type="checkbox" checked={includePinned} onChange={(event) => { setIncludePinned(event.target.checked); setArmed(false); }} /><span>{label(settings, 'Include pinned tabs', '包括釘住分頁')}</span></label>
        </div>
        <p className="supporting" aria-live="polite">
          {!search.state.query
            ? label(settings, 'Enter text or open the regex builder to preview matching labels.', '輸入文字或者開 regex 建造器預覽符合嘅標籤。')
            : invalidRegex
              ? label(settings, 'This pattern is invalid or exceeds the safety limit; no tab can close.', '呢個 pattern 無效或者超出安全限制；唔會關閉任何分頁。')
            : mode === null
              ? label(settings, 'Choose a close direction to preview affected tabs.', '揀一個關閉方向預覽受影響分頁。')
              : label(settings, `${ids.length} tab${ids.length === 1 ? '' : 's'} will close${excludedPinned ? `; ${excludedPinned} pinned tab${excludedPinned === 1 ? '' : 's'} protected` : ''}.`, `${ids.length} 個分頁會關閉${excludedPinned ? `；${excludedPinned} 個釘住分頁受到保護` : ''}。`)}
        </p>
        {mode !== null && ids.length > 0 && <button type="button" className="danger tonal-button" onClick={apply}>{armed ? label(settings, `Confirm close ${ids.length} tabs`, `確認關閉 ${ids.length} 個分頁`) : label(settings, `Review and close ${ids.length} tabs`, `檢查並關閉 ${ids.length} 個分頁`)}</button>}
        {mode !== null && ids.length === 0 && search.state.query && <p className="supporting">{label(settings, 'No closable tabs match this preview.', '呢個預覽冇可關閉分頁。')}</p>}
        {closedTabs.length > 0 && (
          <div className="closed-tabs" aria-label={label(settings, 'Closed tabs', '已關閉分頁')}>
            <strong>{label(settings, 'Closed tabs', '已關閉分頁')}</strong>
            {closedTabs.map((tab) => <button type="button" className="text-button" key={tab.id} onClick={() => { dispatch({ type: 'reopen', id: tab.id }); announce(`${TAB_META[tab.id].en} reopened`); }}>{label(settings, `Reopen ${TAB_META[tab.id].en}`, `重新開啟 ${TAB_META[tab.id].yue}`)}</button>)}
          </div>
        )}
      </div>
    </details>
  );
}

export function TabRail({ settings, workspace, dispatch, locks, updatesBadge, onOpenPalette, announce, openOverflow, onOverflowHandled, openTabRegex, onTabRegexHandled, renameGroupId: renameRequest, onRenameHandled, onEditAppearance, schoolModeEnabled = false, onManageLock }: TabRailProps) {
  const search = useSurfaceSearch('tabs');
  const groupNames = useSurfaceSearch('tabs.groups');
  const master = useSurfaceSearch('tabs.master');
  const searchContext = useContext(SearchContext);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const stopRefs = useRef(new Map<string, HTMLButtonElement>());
  const [focusKey, setFocusKey] = useState<string>(`t:${workspace.activeTabId}`);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [movePickerTabId, setMovePickerTabId] = useState<TabId | null>(null);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [dragId, setDragId] = useState<TabId | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const matcher = useMemo(() => makeMatcher(search.state), [search.state]);
  const groupNameMatcher = useMemo(() => makeMatcher(groupNames.state), [groupNames.state]);
  const masterMatcher = useMemo(() => makeMatcher(master.state), [master.state]);
  const horizontal = workspace.rail.side === 'top' || workspace.rail.side === 'bottom';

  const { rows, matchCount } = useMemo(() => {
    const built: TabRow[] = [];
    let matched = 0;
    for (const region of regionsOf(workspace)) {
      const groupNameHit = region.group ? groupNameMatcher(`${region.group.name}\n${region.group.color}`) : true;
      if (!groupNameHit) continue;
      const groupSearchState = region.group ? (searchContext?.states[`tabs.group.${region.group.id}`] ?? EMPTY_SEARCH) : EMPTY_SEARCH;
      const groupMatcher = region.group ? makeMatcher(groupSearchState) : () => true;
      const visible = region.tabs.filter((tab) => {
        if (schoolModeEnabled && tab.id === 'authenticator') return false;
        const text = `${TAB_META[tab.id].en}\n${TAB_META[tab.id].yue}\n${tab.id}\n${region.group?.name ?? ''}`;
        const hit = matcher(text) && groupMatcher(text) && masterMatcher(text);
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
  }, [workspace, matcher, groupNameMatcher, masterMatcher, searchContext?.states, schoolModeEnabled]);

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
    if (schoolModeEnabled && menu?.kind === 'tab' && menu.id === 'authenticator') setMenu(null);
  }, [menu, schoolModeEnabled]);

  useEffect(() => {
    if (!menu && !overflowOpen && !movePickerTabId) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setMenu(null);
      setMovePickerTabId(null);
      setOverflowOpen(false);
    };
    window.addEventListener('keydown', listener, true);
    return () => window.removeEventListener('keydown', listener, true);
  }, [menu, overflowOpen, movePickerTabId]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (!matchesTabShortcut(event, TAB_SHORTCUTS.railSearch)) return;
      event.preventDefault();
      event.stopPropagation();
      window.document.getElementById(searchInputId('tabs'))?.focus();
      announce('Tab search focused');
    };
    window.addEventListener('keydown', listener, true);
    return () => window.removeEventListener('keydown', listener, true);
  }, [announce]);

  const focusStop = useCallback((key: string) => {
    setFocusKey(key);
    stopRefs.current.get(key)?.focus();
  }, []);

  const openMenuFor = useCallback((next: MenuTarget, returnFocus: HTMLElement | null) => {
    returnFocusRef.current = returnFocus;
    setMenu(next);
  }, []);

  const isLocked = useCallback((target: LockTarget) => Boolean(locks?.isLocked(target)), [locks]);

  const activate = useCallback((id: TabId) => {
    const tab = workspace.tabs.find((candidate) => candidate.id === id);
    const groupTarget = tab?.groupId ? { targetKind: 'group' as const, targetId: tab.groupId } : null;
    if (groupTarget && isLocked(groupTarget)) {
      setMenu({ kind: 'group', groupId: groupTarget.targetId });
      announce('This tab is inside a locked group. Unlock the group before opening it.');
      return;
    }
    if (isLocked({ targetKind: 'tab', targetId: id })) {
      setMenu({ kind: 'tab', id });
      announce('This tab is locked. Unlock it before opening it.');
      return;
    }
    dispatch({ type: 'activate', id });
    setFocusKey(`t:${id}`);
  }, [announce, dispatch, isLocked, workspace.tabs]);

  const moveFocus = (from: number, delta: number) => {
    if (!visibleRows.length) return;
    focusStop(visibleRows[(from + delta + visibleRows.length) % visibleRows.length].key);
  };

  const onRowKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number, row: TabRow) => {
    const key = event.key;
    if (row.kind === 'tab' && matchesTabShortcut(event.nativeEvent, TAB_SHORTCUTS.pin)) {
      event.preventDefault();
      dispatch({ type: 'pin', id: row.tab.id, pinned: 'toggle' });
      announce(`${TAB_META[row.tab.id].en} ${row.tab.pinned ? 'unpinned' : 'pinned'}`);
      return;
    }
    if (row.kind === 'tab' && matchesTabShortcut(event.nativeEvent, TAB_SHORTCUTS.newGroup)) {
      event.preventDefault();
      if (row.tab.pinned) { announce('Pinned tabs must be unpinned before grouping'); return; }
      if (workspace.groups.length >= MAX_TAB_GROUPS) { announce('The tab group limit has been reached'); return; }
      const group = nextTabGroup(workspace);
      dispatch({ type: 'group-create', group, memberId: row.tab.id });
      setRenamingGroupId(group.id);
      announce(`${TAB_META[row.tab.id].en} moved into a new group`);
      return;
    }
    if (row.kind === 'tab' && (matchesTabShortcut(event.nativeEvent, TAB_SHORTCUTS.moveUp) || matchesTabShortcut(event.nativeEvent, TAB_SHORTCUTS.moveDown))) {
      event.preventDefault();
      const direction = matchesTabShortcut(event.nativeEvent, TAB_SHORTCUTS.moveUp) ? -1 : 1;
      dispatch({ type: 'move', id: row.tab.id, direction });
      announce(`${TAB_META[row.tab.id].en} moved ${direction < 0 ? 'up' : 'down'}`);
      return;
    }
    if (key === 'ArrowDown' || (horizontal && key === 'ArrowRight' && row.kind === 'tab')) { event.preventDefault(); moveFocus(index, 1); return; }
    if (key === 'ArrowUp' || (horizontal && key === 'ArrowLeft' && row.kind === 'tab')) { event.preventDefault(); moveFocus(index, -1); return; }
    if (key === 'Home' && visibleRows.length) { event.preventDefault(); focusStop(visibleRows[0].key); return; }
    if (key === 'End' && visibleRows.length) { event.preventDefault(); focusStop(visibleRows[visibleRows.length - 1].key); return; }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (row.kind === 'tab') activate(row.tab.id);
      else if (isLocked({ targetKind: 'group', targetId: row.group.id })) {
        setMenu({ kind: 'group', groupId: row.group.id });
        announce('This group is locked. Unlock it before changing its state.');
      } else dispatch({ type: 'group-collapse', groupId: row.group.id, collapsed: 'toggle' });
      return;
    }
    if (key === 'ArrowRight') {
      event.preventDefault();
      if (row.kind === 'header' && row.group.collapsed) {
        if (isLocked({ targetKind: 'group', targetId: row.group.id })) {
          setMenu({ kind: 'group', groupId: row.group.id });
          announce('This group is locked. Unlock it before expanding it.');
        } else dispatch({ type: 'group-collapse', groupId: row.group.id, collapsed: false });
      }
      else openMenuFor(row.kind === 'tab' ? { kind: 'tab', id: row.tab.id } : { kind: 'group', groupId: row.group.id }, event.currentTarget);
      return;
    }
    if (key === 'ArrowLeft') {
      event.preventDefault();
      if (row.kind === 'header') {
        if (isLocked({ targetKind: 'group', targetId: row.group.id })) {
          setMenu({ kind: 'group', groupId: row.group.id });
          announce('This group is locked. Unlock it before collapsing it.');
        } else dispatch({ type: 'group-collapse', groupId: row.group.id, collapsed: true });
      }
      else if (row.groupId) focusStop(`h:${row.groupId}`);
      return;
    }
    if (key === 'ContextMenu' || (key === 'F10' && event.shiftKey)) {
      event.preventDefault();
      openMenuFor(row.kind === 'tab' ? { kind: 'tab', id: row.tab.id } : { kind: 'group', groupId: row.group.id }, event.currentTarget);
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
        locked={isLocked({ targetKind: 'tab', targetId: row.tab.id })}
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
        onContextMenu={(event) => { event.preventDefault(); openMenuFor({ kind: 'tab', id: row.tab.id }, event.currentTarget); }}
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
            locked={isLocked({ targetKind: 'group', targetId: row.group.id })}
            bodyId={bodyId}
            renaming={renamingGroupId === row.group.id}
            ref={registerStop(row.key)}
            tabIndex={focusKey === row.key ? 0 : -1}
            onFocus={() => setFocusKey(row.key)}
            onKeyDown={(event) => onRowKeyDown(event, headerIndex, row)}
            onContextMenu={(event) => { event.preventDefault(); openMenuFor({ kind: 'group', groupId: row.group.id }, event.currentTarget); }}
            onToggle={() => {
              const target = { targetKind: 'group' as const, targetId: row.group.id };
              if (isLocked(target)) {
                setMenu({ kind: 'group', groupId: row.group.id });
                announce('This group is locked. Unlock it before changing its state.');
              } else dispatch({ type: 'group-collapse', groupId: row.group.id, collapsed: 'toggle' });
            }}
            onRename={(name) => {
              if (name !== null) dispatch({ type: 'group-rename', groupId: row.group.id, name });
              setRenamingGroupId(null);
              window.setTimeout(() => focusStop(row.key), 0);
            }}
          />
          <SearchBox
            surface={`tabs.group.${row.group.id}`}
            settings={settings}
            className="tab-group-search"
            placeholder={label(settings, `Search ${row.group.name}`, `搜尋 ${row.group.name}`)}
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
      <SearchBox surface="tabs" settings={settings} className="tab-search" placeholder={label(settings, 'Search tabs', '搵分頁')} ariaKeyShortcuts={TAB_SHORTCUTS.railSearch.aria} openBuilder={openTabRegex} onBuilderHandled={onTabRegexHandled} />
      <details className="tab-discovery-panel">
        <summary>{label(settings, groupNames.state.query || master.state.query ? 'All tab searches · filtered' : 'All tab searches', groupNames.state.query || master.state.query ? '所有分頁搜尋 · 已篩選' : '所有分頁搜尋')}</summary>
        <SearchBox surface="tabs.groups" settings={settings} placeholder={label(settings, 'Search tab groups', '搜尋分頁組')} />
        <SearchBox surface="tabs.master" settings={settings} placeholder={label(settings, 'Search every open tab', '搜尋所有開啟分頁')} />
        <p className="supporting">{label(settings, 'Use the strip search for this rail, group search inside each group, group search for names, or master search across every open tab.', '分頁列搜尋查呢條列；分組搜尋查組內；分頁組搜尋查組名；主搜尋查所有開啟分頁。')}</p>
      </details>
      <TabBulkClosePanel workspace={workspace} settings={settings} dispatch={dispatch} announce={announce} schoolModeEnabled={schoolModeEnabled} />
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
        <TabContextMenu target={menu} workspace={workspace} settings={settings} locks={locks} dispatch={dispatch} announce={announce} onRename={(groupId) => setRenamingGroupId(groupId)} onMovePicker={(tabId) => setMovePickerTabId(tabId)} onEditAppearance={onEditAppearance} returnFocus={returnFocusRef.current} onManageLock={onManageLock} onClose={() => { setMenu(null); window.setTimeout(() => returnFocusRef.current?.focus(), 0); }} />
      )}
      {movePickerTabId && <TabMoveGroupPicker tabId={movePickerTabId} workspace={workspace} settings={settings} dispatch={dispatch} announce={announce} onClose={() => setMovePickerTabId(null)} />}
      <button className="palette-hint" onClick={onOpenPalette} {...el('palette-hint')}>
        <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd><span>Commands</span>
      </button>
    </nav>
  );
}
