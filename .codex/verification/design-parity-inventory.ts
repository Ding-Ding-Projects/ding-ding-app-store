/**
 * Public-safe design parity inventory and validator.
 *
 * This is a contract scaffold, not a visual-proof claim. Every capture and
 * digest is deliberately pending until a sanctioned packaged runtime route
 * produces the corresponding evidence.
 */

export type DesignParityKind = 'base' | 'overlay' | 'catalog-variant';
export type DesignParityTheme = 'light' | 'dark';
export type DesignParityLocale = 'bilingual';

export type EvidencePointer = { path: string; sha256: null };

export type NormalizedTuple = {
  screen: string;
  state: string;
  theme: DesignParityTheme;
  viewport: string;
  scale: 1;
  locale: DesignParityLocale;
};

export type CapturePolicy = {
  fixture: 'fixture-default';
  time: 'fixed';
  motion: 'reduced';
  random: 'seeded';
  font: 'bundled';
  network: 'offline';
};

export type PrimitiveMd3Audit = {
  primitive: 'surface' | 'navigation' | 'primary-action' | 'field' | 'feedback';
  role: 'surface' | 'surface-container' | 'filled' | 'outlined' | 'tonal' | 'text';
  typography: 'title-large' | 'title-medium' | 'body-large' | 'body-medium' | 'label-large';
  shape: 'small' | 'medium' | 'large';
  elevation: 'level0' | 'level1' | 'level2';
  stateLayer: 'present';
  focusIndicator: 'visible';
};

export type Deviation = { reason: string; approved: true };

export type DesignParityRow = {
  id: string;
  kind: DesignParityKind;
  surface: string;
  variant: string;
  referenceFile: string;
  referenceSha256: null;
  referenceRoute: string;
  builtRoute: string;
  output: string;
  normalizedTuple: NormalizedTuple;
  tuple: readonly [string, string, DesignParityTheme, string, 1, DesignParityLocale];
  capturePolicy: CapturePolicy;
  semanticAssertions: readonly string[];
  geometryAssertions: readonly string[];
  md3Audit: readonly PrimitiveMd3Audit[];
  privacyAssertion: {
    result: 'pass';
    statement: 'Neutral public identifiers only; no runtime payload is included.';
  };
  rawEvidence: {
    reference: EvidencePointer;
    built: EvidencePointer;
    comparison: EvidencePointer;
    diff: EvidencePointer;
  };
  deviations: readonly Deviation[];
  sourceProvenance: { sourceCommit: null; tool: 'public-contract-scaffold' };
  status: 'pending';
  runtimeVerified: false;
  pendingReason: 'Runtime capture and digest verification are pending.';
};

const BASE_ROWS = [
  ['catalog', 'catalog', 'default', 'catalog'],
  ['installed', 'installed', 'default', 'installed'],
  ['updates', 'updates', 'default', 'updates'],
  ['authenticator', 'authenticator', 'default', 'authenticator'],
  ['docs-article', 'docs-article', 'default', 'docs-article'],
  ['activity', 'activity', 'default', 'activity'],
  ['settings-general', 'settings-general', 'default', 'settings-general'],
  ['settings-appearance', 'settings-appearance', 'default', 'settings-appearance'],
  ['settings-schedule', 'settings-schedule', 'default', 'settings-schedule'],
  ['settings-about', 'settings-about', 'default', 'settings-about'],
  ['settings-support', 'settings-support', 'default', 'settings-support'],
] as const;

const OVERLAY_ROWS = [
  ['command-palette', 'command-palette', 'open', 'command-palette'],
  ['regex-builder', 'regex-builder', 'open', 'regex-builder'],
  ['tab-management-context-menu', 'tab-management-context-menu', 'open', 'tab-management-context-menu'],
  ['notification-center', 'notification-center', 'open', 'notification-center'],
  ['anchored-appearance-panel', 'anchored-appearance-panel', 'open', 'anchored-appearance-panel'],
  ['action-progress-dialog', 'action-progress-dialog', 'active', 'action-progress-dialog'],
  ['destructive-super-confirm', 'destructive-super-confirm', 'open', 'destructive-super-confirm'],
  ['source-terminal', 'source-terminal', 'active', 'source-terminal'],
  ['changelog', 'changelog', 'open', 'changelog'],
  ['dim-sum-surprise', 'dim-sum-surprise', 'open', 'dim-sum-surprise'],
] as const;

const CATALOG_ROWS = [
  ['catalog-dark', 'catalog', 'dark', 'catalog-dark', '1440x920'],
  ['catalog-compact', 'catalog', 'compact', 'catalog-compact', '820x920'],
  ['catalog-narrow', 'catalog', 'narrow', 'catalog-narrow', '360x640'],
] as const;

export const DESIGN_PARITY_EXPECTED_IDS = [
  ...BASE_ROWS.map(([id]) => id),
  ...OVERLAY_ROWS.map(([id]) => id),
  ...CATALOG_ROWS.map(([id]) => id),
] as const;

export const DESIGN_PARITY_COUNTS = { total: 24, base: 11, overlay: 10, catalogVariant: 3 } as const;

const SAFE_IDENTIFIER = /^[a-z][a-z0-9-]*$/;
const FORBIDDEN_PUBLIC_TEXT = /https?:\/\/|[A-Za-z]:\\|\\\\|@/i;
const EXPECTED_PRIVACY_STATEMENT = 'Neutral public identifiers only; no runtime payload is included.' as const;

function violation(message: string): never {
  throw new Error(`Design parity contract violation: ${message}`);
}

function assertIdentifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !SAFE_IDENTIFIER.test(value)) violation(`${label} must be a neutral public identifier.`);
}

function assertRoute(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.includes(' ') || !/^(?:#\/|\/)[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/i.test(value)) violation(`${label} must be a non-empty public route.`);
}

function pointer(path: string): EvidencePointer {
  return { path, sha256: null };
}

const MD3_AUDIT: readonly PrimitiveMd3Audit[] = [
  { primitive: 'surface', role: 'surface', typography: 'body-large', shape: 'large', elevation: 'level0', stateLayer: 'present', focusIndicator: 'visible' },
  { primitive: 'navigation', role: 'surface-container', typography: 'title-medium', shape: 'medium', elevation: 'level1', stateLayer: 'present', focusIndicator: 'visible' },
  { primitive: 'primary-action', role: 'filled', typography: 'label-large', shape: 'small', elevation: 'level1', stateLayer: 'present', focusIndicator: 'visible' },
  { primitive: 'field', role: 'outlined', typography: 'body-medium', shape: 'small', elevation: 'level0', stateLayer: 'present', focusIndicator: 'visible' },
  { primitive: 'feedback', role: 'tonal', typography: 'body-medium', shape: 'medium', elevation: 'level0', stateLayer: 'present', focusIndicator: 'visible' },
];

const CAPTURE_POLICY: CapturePolicy = { fixture: 'fixture-default', time: 'fixed', motion: 'reduced', random: 'seeded', font: 'bundled', network: 'offline' };

function row(
  kind: DesignParityKind,
  [id, surface, variant, route]: readonly [string, string, string, string],
  viewport = '1440x920',
  theme: DesignParityTheme = 'light',
): DesignParityRow {
  const output = `pending-${id}`;
  const state = variant;
  const tuple: readonly [string, string, DesignParityTheme, string, 1, DesignParityLocale] = [surface, state, theme, viewport, 1, 'bilingual'];
  return {
    id,
    kind,
    surface,
    variant,
    referenceFile: `pending-reference-${id}`,
    referenceSha256: null,
    referenceRoute: `#/${route}`,
    builtRoute: `#/${route}`,
    output,
    normalizedTuple: { screen: surface, state, theme, viewport, scale: 1, locale: 'bilingual' },
    tuple,
    capturePolicy: CAPTURE_POLICY,
    semanticAssertions: ['route-resolves', 'landmark-present', 'primary-action-labelled'],
    geometryAssertions: ['frame-inside-viewport', 'safe-area-reserved', 'narrow-layout-covered'],
    md3Audit: MD3_AUDIT,
    privacyAssertion: { result: 'pass', statement: EXPECTED_PRIVACY_STATEMENT },
    rawEvidence: {
      reference: pointer(`pending-raw-reference-${id}`),
      built: pointer(`pending-raw-built-${id}`),
      comparison: pointer(`pending-comparison-${id}`),
      diff: pointer(`pending-diff-${id}`),
    },
    deviations: [],
    sourceProvenance: { sourceCommit: null, tool: 'public-contract-scaffold' },
    status: 'pending',
    runtimeVerified: false,
    pendingReason: 'Runtime capture and digest verification are pending.',
  };
}

export const DESIGN_PARITY_INVENTORY: readonly DesignParityRow[] = [
  ...BASE_ROWS.map((entry) => row('base', entry)),
  ...OVERLAY_ROWS.map((entry) => row('overlay', entry)),
  ...CATALOG_ROWS.map(([id, surface, variant, route, viewport]) => row('catalog-variant', [id, surface, variant, route], viewport, variant === 'dark' ? 'dark' : 'light')),
];

export function assertExactMembership(rows: readonly DesignParityRow[], expected = DESIGN_PARITY_EXPECTED_IDS): void {
  const actual = rows.map((entry) => entry.id).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((id, index) => id !== required[index])) violation(`row membership must exactly equal the ${required.length} expected identifiers.`);
}

export function assertUniqueOutputs(rows: readonly DesignParityRow[]): void {
  const outputs = rows.map((entry) => entry.output);
  if (new Set(outputs).size !== outputs.length) violation('each row must have a unique output identifier.');
}

export function assertTuple(rows: readonly DesignParityRow[]): void {
  for (const entry of rows) {
    if (!Array.isArray(entry.tuple) || entry.tuple.length !== 6) violation(`${entry.id} normalized tuple must have six members.`);
    if (entry.tuple[0] !== entry.normalizedTuple.screen || entry.tuple[1] !== entry.normalizedTuple.state || entry.tuple[2] !== entry.normalizedTuple.theme || entry.tuple[3] !== entry.normalizedTuple.viewport || entry.tuple[4] !== entry.normalizedTuple.scale || entry.tuple[5] !== entry.normalizedTuple.locale) violation(`${entry.id} tuple does not match its normalized fields.`);
  }
}

export function assertPrivacy(rows: readonly DesignParityRow[]): void {
  for (const entry of rows) {
    assertIdentifier(entry.id, 'row id');
    assertIdentifier(entry.surface, `${entry.id} surface`);
    assertIdentifier(entry.variant, `${entry.id} variant`);
    assertIdentifier(entry.output, `${entry.id} output`);
    if (FORBIDDEN_PUBLIC_TEXT.test(JSON.stringify(entry))) violation(`${entry.id} contains an unsafe public value.`);
    if (entry.privacyAssertion.result !== 'pass' || entry.privacyAssertion.statement !== EXPECTED_PRIVACY_STATEMENT) violation(`${entry.id} privacy assertion is missing.`);
  }
}

export function assertRoutes(rows: readonly DesignParityRow[]): void {
  for (const entry of rows) {
    assertRoute(entry.referenceRoute, `${entry.id} reference route`);
    assertRoute(entry.builtRoute, `${entry.id} built route`);
  }
}

export function assertCapturePolicy(rows: readonly DesignParityRow[]): void {
  for (const entry of rows) {
    if (entry.capturePolicy.fixture !== 'fixture-default' || entry.capturePolicy.time !== 'fixed' || entry.capturePolicy.motion !== 'reduced' || entry.capturePolicy.random !== 'seeded' || entry.capturePolicy.font !== 'bundled' || entry.capturePolicy.network !== 'offline') violation(`${entry.id} capture policy is incomplete.`);
  }
}

export function assertSemanticAssertions(rows: readonly DesignParityRow[]): void {
  for (const entry of rows) {
    if (entry.semanticAssertions.length < 3 || entry.semanticAssertions.some((assertion) => !SAFE_IDENTIFIER.test(assertion))) violation(`${entry.id} semantic assertions are incomplete.`);
  }
}

export function assertGeometry(rows: readonly DesignParityRow[]): void {
  for (const entry of rows) {
    if (entry.geometryAssertions.length < 3 || entry.geometryAssertions.some((assertion) => !SAFE_IDENTIFIER.test(assertion))) violation(`${entry.id} geometry assertions are incomplete.`);
    const [width, height] = entry.tuple[3].split('x').map(Number);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 320 || height < 240) violation(`${entry.id} viewport geometry is invalid.`);
  }
}

export function assertMd3Audit(rows: readonly DesignParityRow[]): void {
  const primitives = new Set(['surface', 'navigation', 'primary-action', 'field', 'feedback']);
  for (const entry of rows) {
    if (entry.md3Audit.length !== primitives.size || new Set(entry.md3Audit.map((audit) => audit.primitive)).size !== primitives.size || entry.md3Audit.some((audit) => !primitives.has(audit.primitive) || audit.stateLayer !== 'present' || audit.focusIndicator !== 'visible')) violation(`${entry.id} per-primitive MD3 audit is incomplete.`);
  }
}

export function assertEvidenceFields(rows: readonly DesignParityRow[]): void {
  for (const entry of rows) {
    if (entry.referenceSha256 !== null || entry.sourceProvenance.sourceCommit !== null || entry.sourceProvenance.tool !== 'public-contract-scaffold') violation(`${entry.id} source placeholders are invalid.`);
    for (const [kind, evidence] of Object.entries(entry.rawEvidence)) {
      if (!SAFE_IDENTIFIER.test(evidence.path) || evidence.sha256 !== null) violation(`${entry.id} ${kind} raw evidence placeholder is invalid.`);
    }
    if (entry.status !== 'pending' || entry.runtimeVerified !== false || entry.pendingReason !== 'Runtime capture and digest verification are pending.') violation(`${entry.id} pending status overclaims runtime evidence.`);
  }
}

export function assertDeviations(rows: readonly DesignParityRow[]): void {
  for (const entry of rows) {
    for (const deviation of entry.deviations) {
      if (typeof deviation.reason !== 'string' || deviation.reason.trim().length === 0 || deviation.approved !== true) violation(`${entry.id} deviation requires a reason and approval.`);
    }
  }
}

export type DesignParityValidation = { total: number; byKind: Record<DesignParityKind, number>; outputs: readonly string[] };

export function validateDesignParityInventory(rows: readonly DesignParityRow[] = DESIGN_PARITY_INVENTORY): DesignParityValidation {
  assertExactMembership(rows);
  assertUniqueOutputs(rows);
  assertRoutes(rows);
  assertTuple(rows);
  assertPrivacy(rows);
  assertCapturePolicy(rows);
  assertSemanticAssertions(rows);
  assertGeometry(rows);
  assertMd3Audit(rows);
  assertEvidenceFields(rows);
  assertDeviations(rows);
  const byKind: Record<DesignParityKind, number> = { base: 0, overlay: 0, 'catalog-variant': 0 };
  for (const entry of rows) byKind[entry.kind] += 1;
  if (rows.length !== DESIGN_PARITY_COUNTS.total || byKind.base !== DESIGN_PARITY_COUNTS.base || byKind.overlay !== DESIGN_PARITY_COUNTS.overlay || byKind['catalog-variant'] !== DESIGN_PARITY_COUNTS.catalogVariant) violation('row kind counts must be 11 base, 10 overlay, and 3 catalog variants.');
  return { total: rows.length, byKind, outputs: rows.map((entry) => entry.output) };
}

export const DESIGN_PARITY_VALIDATION = validateDesignParityInventory();
