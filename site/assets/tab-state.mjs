export const SITE_TAB_SCHEMA_VERSION = 1;
export const HOME_TAB_ID = 'home';

function unique(values) {
  return [...new Set(values)];
}

function knownSet(knownIds = []) {
  return new Set([HOME_TAB_ID, ...knownIds]);
}

export function normalizeTabState(raw, knownIds = []) {
  const known = knownSet(knownIds);
  const candidateTabs = Array.isArray(raw?.openTabs)
    ? raw.openTabs
    : [raw?.activeTab || HOME_TAB_ID];
  const openTabs = unique(candidateTabs.filter((id) => typeof id === 'string' && known.has(id)));
  if (!openTabs.length) openTabs.push(HOME_TAB_ID);
  const activeTab = openTabs.includes(raw?.activeTab) ? raw.activeTab : openTabs[0];
  const pinnedTabs = unique(Array.isArray(raw?.pinnedTabs) ? raw.pinnedTabs : [])
    .filter((id) => openTabs.includes(id));
  return {
    version: SITE_TAB_SCHEMA_VERSION,
    openTabs,
    activeTab,
    pinnedTabs,
  };
}

export function parseTabState(serialized, knownIds = [], legacyArticle = HOME_TAB_ID) {
  let raw = null;
  try {
    raw = serialized ? JSON.parse(serialized) : null;
  } catch {
    raw = null;
  }
  if (!raw || typeof raw !== 'object') raw = { activeTab: legacyArticle, openTabs: [legacyArticle] };
  return normalizeTabState(raw, knownIds);
}

export function addTab(state, id, knownIds = []) {
  const normalized = normalizeTabState(state, knownIds);
  const known = knownSet(knownIds);
  const target = known.has(id) ? id : HOME_TAB_ID;
  return normalizeTabState({
    ...normalized,
    openTabs: normalized.openTabs.includes(target) ? normalized.openTabs : [...normalized.openTabs, target],
    activeTab: target,
  }, knownIds);
}

export function closeTab(state, id, knownIds = []) {
  const normalized = normalizeTabState(state, knownIds);
  if (normalized.openTabs.length <= 1 || !normalized.openTabs.includes(id)) return normalized;
  const index = normalized.openTabs.indexOf(id);
  const openTabs = normalized.openTabs.filter((tabId) => tabId !== id);
  const activeTab = normalized.activeTab === id
    ? openTabs[Math.min(index, openTabs.length - 1)]
    : normalized.activeTab;
  return normalizeTabState({
    ...normalized,
    openTabs,
    activeTab,
    pinnedTabs: normalized.pinnedTabs.filter((tabId) => tabId !== id),
  }, knownIds);
}

export function moveTab(state, id, direction, knownIds = []) {
  const normalized = normalizeTabState(state, knownIds);
  const index = normalized.openTabs.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= normalized.openTabs.length) return normalized;
  const openTabs = [...normalized.openTabs];
  [openTabs[index], openTabs[target]] = [openTabs[target], openTabs[index]];
  return normalizeTabState({ ...normalized, openTabs }, knownIds);
}

export function togglePinned(state, id, knownIds = []) {
  const normalized = normalizeTabState(state, knownIds);
  if (!normalized.openTabs.includes(id)) return normalized;
  const pinnedTabs = normalized.pinnedTabs.includes(id)
    ? normalized.pinnedTabs.filter((tabId) => tabId !== id)
    : [...normalized.pinnedTabs, id];
  return normalizeTabState({ ...normalized, pinnedTabs }, knownIds);
}

export function routeHash(id) {
  return `#/${encodeURIComponent(id)}`;
}

export function tabIdFromHash(hash, knownIds = []) {
  if (typeof hash !== 'string' || !hash.startsWith('#/')) return null;
  let id = null;
  try {
    id = decodeURIComponent(hash.slice(2));
  } catch {
    return null;
  }
  return knownSet(knownIds).has(id) ? id : null;
}
