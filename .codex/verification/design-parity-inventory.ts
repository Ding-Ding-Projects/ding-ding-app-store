import registryDocument from '../../tools/design-reference/scenes.json';

export type DesignParityKind = 'base' | 'overlay' | 'variant';
export type DesignParityTheme = 'light' | 'dark';
export type DesignParityLocale = 'en' | 'yue' | 'bilingual';
export type EvidencePointer = { path: string; sha256: string | null };

type RegistryAction = { action: 'click' | 'contextmenu' | 'select' | 'launch'; selector: string; value?: string };
type RegistryScene = {
  id: string; kind: DesignParityKind; page: string; settings?: string; overlay?: string; state: string;
  theme: DesignParityTheme; locale: DesignParityLocale; viewport: [number, number]; scale: 1;
  builtActions: RegistryAction[]; readySelector: string;
};

export type PrimitiveMd3Audit = {
  primitive: 'surface' | 'navigation' | 'primary-action' | 'field' | 'feedback';
  selector: string;
  component: string;
  tokenEvidence: readonly string[];
  stateLayer: 'required';
  focusIndicator: 'required';
};

export type DesignParityRow = {
  id: string;
  kind: DesignParityKind;
  surface: string;
  variant: string;
  referenceFiles: readonly { path: string; sha256: string }[];
  referenceRoute: string;
  builtRoute: string;
  builtActions: readonly RegistryAction[];
  readySelector: string;
  normalizedTuple: { screen: string; state: string; theme: DesignParityTheme; viewport: string; scale: 1; locale: DesignParityLocale };
  tuple: readonly [string, string, DesignParityTheme, string, 1, DesignParityLocale];
  capturePolicy: { fixture: 'fixture-default'; time: 'fixed'; motion: 'reduced'; random: 'seeded'; font: 'bundled'; network: 'offline' };
  semanticAssertions: readonly string[];
  geometryAssertions: readonly string[];
  md3Audit: readonly PrimitiveMd3Audit[];
  rawEvidence: { reference: EvidencePointer; built: EvidencePointer; comparison: EvidencePointer; diff: EvidencePointer; receipt: EvidencePointer };
  sourceProvenance: { referenceSourceCommit: string; builtSourceCommit: null; artifactSha256: null };
  status: 'awaiting-final-reconciled-capture';
  runtimeVerified: false;
  pendingReason: string;
};

const registry = registryDocument as { schemaVersion: number; referenceSourceCommit: string; capturePolicy: DesignParityRow['capturePolicy']; scenes: RegistryScene[] };
const REFERENCE_FILES = [
  { path: 'design/reference.html', sha256: '0902097f7e79176f72b3115c85ec7f7f82363ea2793e37472e25ac86988da464' },
  { path: 'design/reference.mjs', sha256: '28a240ec19b3c02964827fa0fae10e56aec5432f5b6fe3d3008f089975ba22f3' },
  { path: 'design/reference.css', sha256: 'd5f016c50d51b1e74774da2a5dd3fe9f77a39a6a7d0e0c824e626d30bd7d0315' },
] as const;
const EXPECTED_IDS = [
  'catalog', 'installed', 'updates', 'authenticator', 'docs-article', 'activity',
  'settings-general', 'settings-appearance', 'settings-schedule', 'settings-about', 'settings-support',
  'command-palette', 'regex-builder', 'tab-management', 'tab-context-menu', 'notification-center',
  'anchored-appearance-panel', 'action-progress-dialog', 'destructive-super-confirm', 'source-terminal',
  'changelog', 'dim-sum-surprise', 'catalog-dark', 'catalog-compact', 'catalog-narrow', 'catalog-english', 'catalog-cantonese',
] as const;

function query(scene: RegistryScene): string {
  const params = new URLSearchParams({ page: scene.page, lang: scene.locale, theme: scene.theme, mode: 'reference', row: scene.id });
  if (scene.settings) params.set('settings', scene.settings);
  if (scene.overlay) params.set('overlay', scene.overlay);
  return `design/reference.html?${params.toString()}`;
}

function md3Audit(scene: RegistryScene): PrimitiveMd3Audit[] {
  const target = scene.kind === 'overlay' ? scene.readySelector : '#surface-panel';
  return [
    { primitive: 'surface', selector: target, component: `${scene.id} rendered surface`, tokenEvidence: ['surface-role', 'container-shape', 'elevation'], stateLayer: 'required', focusIndicator: 'required' },
    { primitive: 'navigation', selector: `#tab-${scene.page}`, component: `${scene.page} browser-style tab`, tokenEvidence: ['surface-container-role', 'selected-state', 'label-typography'], stateLayer: 'required', focusIndicator: 'required' },
    { primitive: 'primary-action', selector: `${target} button`, component: `${scene.id} primary action`, tokenEvidence: ['filled-or-tonal-role', 'label-large', 'minimum-target'], stateLayer: 'required', focusIndicator: 'required' },
    { primitive: 'field', selector: `${target} input, ${target} select`, component: `${scene.id} field`, tokenEvidence: ['outlined-role', 'body-typography', 'supporting-copy'], stateLayer: 'required', focusIndicator: 'required' },
    { primitive: 'feedback', selector: `${target} .notice, ${target} [role='status']`, component: `${scene.id} feedback`, tokenEvidence: ['tonal-container-role', 'status-semantics', 'contrast'], stateLayer: 'required', focusIndicator: 'required' },
  ];
}

function pointer(id: string, name: string, extension = 'png'): EvidencePointer {
  return { path: `.codex/verification/design-parity/${id}/${name}.${extension}`, sha256: null };
}

function row(scene: RegistryScene): DesignParityRow {
  const viewport = `${scene.viewport[0]}x${scene.viewport[1]}`;
  const tuple = [scene.page, scene.state, scene.theme, viewport, scene.scale, scene.locale] as const;
  return {
    id: scene.id,
    kind: scene.kind,
    surface: scene.page,
    variant: scene.state,
    referenceFiles: REFERENCE_FILES,
    referenceRoute: query(scene),
    builtRoute: `npm run design:plan -- --scene=${scene.id}`,
    builtActions: scene.builtActions,
    readySelector: scene.readySelector,
    normalizedTuple: { screen: scene.page, state: scene.state, theme: scene.theme, viewport, scale: scene.scale, locale: scene.locale },
    tuple,
    capturePolicy: registry.capturePolicy,
    semanticAssertions: [`page=${scene.page}`, `ready=${scene.readySelector}`, `actions=${scene.builtActions.length}`],
    geometryAssertions: [`viewport=${viewport}`, 'content-inside-viewport', 'no-overlap-or-clipping'],
    md3Audit: md3Audit(scene),
    rawEvidence: { reference: pointer(scene.id, 'reference'), built: pointer(scene.id, 'built'), comparison: pointer(scene.id, 'comparison'), diff: pointer(scene.id, 'diff'), receipt: pointer(scene.id, 'receipt', 'json') },
    sourceProvenance: { referenceSourceCommit: registry.referenceSourceCommit, builtSourceCommit: null, artifactSha256: null },
    status: 'awaiting-final-reconciled-capture',
    runtimeVerified: false,
    pendingReason: 'Catalog integration is still active; final evidence must bind to the final reconciled commit and packaged artifact.',
  };
}

export const DESIGN_PARITY_EXPECTED_IDS = EXPECTED_IDS;
export const DESIGN_PARITY_COUNTS = { total: 27, base: 11, overlay: 11, variant: 5 } as const;
export const DESIGN_PARITY_INVENTORY: readonly DesignParityRow[] = registry.scenes.map(row);

function violation(message: string): never { throw new Error(`Design parity contract violation: ${message}`); }
export function assertExactMembership(rows: readonly DesignParityRow[]): void {
  const actual = rows.map(({ id }) => id).sort(); const expected = [...EXPECTED_IDS].sort();
  if (actual.length !== expected.length || actual.some((id, index) => id !== expected[index])) violation(`membership must exactly equal ${expected.length} hand-written scenes.`);
}
export function assertUniqueOutputs(rows: readonly DesignParityRow[]): void {
  for (const name of ['reference', 'built', 'comparison', 'diff', 'receipt'] as const) if (new Set(rows.map((entry) => entry.rawEvidence[name].path)).size !== rows.length) violation(`${name} evidence paths must be unique.`);
}
export function assertTuple(rows: readonly DesignParityRow[]): void {
  for (const entry of rows) if (JSON.stringify(entry.tuple) !== JSON.stringify(Object.values(entry.normalizedTuple))) violation(`${entry.id} tuple does not match normalized fields.`);
}
export function assertRoutes(rows: readonly DesignParityRow[]): void {
  for (const entry of rows) {
    const url = new URL(entry.referenceRoute, 'file:///');
    if (url.pathname !== '/design/reference.html' || url.searchParams.get('page') !== entry.surface || url.searchParams.get('row') !== entry.id) violation(`${entry.id} reference query is invalid.`);
    if (entry.builtRoute !== `npm run design:plan -- --scene=${entry.id}` || entry.builtActions.length === 0 || !entry.readySelector) violation(`${entry.id} built drive route is invalid.`);
  }
}
export function assertCapturePolicy(rows: readonly DesignParityRow[]): void { for (const entry of rows) if (JSON.stringify(entry.capturePolicy) !== JSON.stringify(registry.capturePolicy)) violation(`${entry.id} capture policy drifted.`); }
export function assertSemanticAssertions(rows: readonly DesignParityRow[]): void { for (const entry of rows) if (entry.semanticAssertions.length < 3) violation(`${entry.id} semantic assertions are incomplete.`); }
export function assertGeometry(rows: readonly DesignParityRow[]): void { for (const entry of rows) { const [width, height] = entry.tuple[3].split('x').map(Number); if (width < 320 || height < 240 || entry.geometryAssertions.length < 3) violation(`${entry.id} geometry is incomplete.`); } }
export function assertMd3Audit(rows: readonly DesignParityRow[]): void { for (const entry of rows) if (entry.md3Audit.length !== 5 || new Set(entry.md3Audit.map(({ primitive }) => primitive)).size !== 5 || entry.md3Audit.some(({ selector, component, tokenEvidence }) => !selector || !component || tokenEvidence.length < 3)) violation(`${entry.id} screen-specific Material Design 3 audit is incomplete.`); }
export function assertEvidenceFields(rows: readonly DesignParityRow[]): void {
  for (const entry of rows) {
    if (!/^[a-f0-9]{40}$/.test(entry.sourceProvenance.referenceSourceCommit) || entry.referenceFiles.some(({ path, sha256 }) => !path.startsWith('design/reference.') || !/^[a-f0-9]{64}$/.test(sha256))) violation(`${entry.id} reference provenance is incomplete.`);
    if (entry.sourceProvenance.builtSourceCommit !== null || entry.sourceProvenance.artifactSha256 !== null || entry.status !== 'awaiting-final-reconciled-capture' || entry.runtimeVerified) violation(`${entry.id} final capture state overclaims evidence.`);
    for (const pointer of Object.values(entry.rawEvidence)) if (!pointer.path.startsWith(`.codex/verification/design-parity/${entry.id}/`) || pointer.sha256 !== null) violation(`${entry.id} pending evidence pointer is invalid.`);
  }
}
export function assertCoverage(rows: readonly DesignParityRow[]): void {
  const required = [rows.some(({ theme }) => theme === 'dark'), rows.some(({ normalizedTuple }) => normalizedTuple.locale === 'en'), rows.some(({ normalizedTuple }) => normalizedTuple.locale === 'yue'), rows.some(({ id }) => id === 'tab-management'), rows.some(({ id }) => id === 'tab-context-menu'), rows.some(({ id }) => id === 'catalog-compact'), rows.some(({ id }) => id === 'catalog-narrow')];
  if (required.some((value) => !value)) violation('dark, locale, tab, compact, or narrow coverage is missing.');
}
export function validateDesignParityInventory(rows: readonly DesignParityRow[] = DESIGN_PARITY_INVENTORY) {
  assertExactMembership(rows); assertUniqueOutputs(rows); assertRoutes(rows); assertTuple(rows); assertCapturePolicy(rows); assertSemanticAssertions(rows); assertGeometry(rows); assertMd3Audit(rows); assertEvidenceFields(rows); assertCoverage(rows);
  const byKind = { base: 0, overlay: 0, variant: 0 }; for (const entry of rows) byKind[entry.kind] += 1;
  if (byKind.base !== 11 || byKind.overlay !== 11 || byKind.variant !== 5) violation('kind counts must be 11 base, 11 overlay, and 5 variants.');
  return { total: rows.length, byKind };
}
export const DESIGN_PARITY_VALIDATION = validateDesignParityInventory();
