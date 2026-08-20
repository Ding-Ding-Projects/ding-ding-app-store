/**
 * Public-safe design parity inventory.
 *
 * This is a contract scaffold, not a visual-proof claim.  The evidence field
 * deliberately records that a sanctioned runtime capture is still pending.
 * Identifiers and values are neutral so this file can be published safely.
 */

export type DesignParityKind = 'base' | 'overlay' | 'catalog';
export type DesignParityEvidenceStatus = 'pending';

export type DesignParityGeometry = {
  viewport: readonly [number, number];
  frame: readonly [number, number, number, number];
  safeArea: readonly [number, number, number, number];
  narrowLayout: boolean;
};

export type DesignParityMd3Audit = {
  surfaceRole: 'surface' | 'surface-container' | 'surface-container-high';
  actionRole: 'filled' | 'tonal' | 'outlined' | 'text';
  typographyScale: 'title-large' | 'title-medium' | 'body-large' | 'body-medium' | 'label-large';
  shapeScale: 'small' | 'medium' | 'large';
  elevation: 'level0' | 'level1' | 'level2';
  stateLayer: 'present';
  focusIndicator: 'visible';
  reducedMotion: 'supported';
};

export type DesignParityEvidence = {
  source: 'public-contract';
  status: DesignParityEvidenceStatus;
  artifactId: string;
  verifiedAt: null;
  note: 'Runtime capture is pending; this row proves contract shape only.';
};

export type DesignParityPrivacy = {
  publicSafe: true;
  identifierClass: 'neutral-public';
  redactions: readonly ['credential-data', 'machine-location', 'network-target', 'unreviewed-content'];
};

export type DesignParityRow = {
  id: string;
  kind: DesignParityKind;
  surface: string;
  variant: string;
  output: string;
  tuple: readonly [string, DesignParityKind, string, string];
  geometry: DesignParityGeometry;
  md3: DesignParityMd3Audit;
  evidence: DesignParityEvidence;
  privacy: DesignParityPrivacy;
};

const BASE_ROWS = [
  ['base-catalog', 'catalog', 'default'],
  ['base-installed', 'installed', 'default'],
  ['base-updates', 'updates', 'default'],
  ['base-authenticator', 'authenticator', 'default'],
  ['base-documents', 'documents', 'default'],
  ['base-activity', 'activity', 'default'],
  ['base-settings', 'settings', 'default'],
  ['base-support', 'support', 'default'],
  ['base-history', 'history', 'default'],
  ['base-appearance', 'appearance', 'default'],
  ['base-search', 'search', 'default'],
] as const;

const OVERLAY_ROWS = [
  ['overlay-command-palette', 'command-palette', 'open'],
  ['overlay-search-builder', 'search-builder', 'open'],
  ['overlay-regex-builder', 'regex-builder', 'open'],
  ['overlay-item-details', 'item-details', 'open'],
  ['overlay-install-progress', 'install-progress', 'active'],
  ['overlay-update-progress', 'update-progress', 'active'],
  ['overlay-notification-center', 'notification-center', 'open'],
  ['overlay-confirmation', 'confirmation', 'open'],
  ['overlay-export-dialog', 'export-dialog', 'open'],
  ['overlay-import-dialog', 'import-dialog', 'open'],
] as const;

const CATALOG_ROWS = [
  ['catalog-available', 'catalog-card', 'available'],
  ['catalog-limited', 'catalog-card', 'limited'],
  ['catalog-unavailable', 'catalog-card', 'unavailable'],
] as const;

export const DESIGN_PARITY_EXPECTED_IDS = [
  ...BASE_ROWS.map(([id]) => id),
  ...OVERLAY_ROWS.map(([id]) => id),
  ...CATALOG_ROWS.map(([id]) => id),
] as const;

export const DESIGN_PARITY_COUNTS = {
  total: 24,
  base: 11,
  overlay: 10,
  catalog: 3,
} as const;

const geometry: DesignParityGeometry = {
  viewport: [1280, 800],
  frame: [0, 0, 1280, 800],
  safeArea: [72, 48, 24, 24],
  narrowLayout: true,
};

const md3: DesignParityMd3Audit = {
  surfaceRole: 'surface',
  actionRole: 'filled',
  typographyScale: 'body-medium',
  shapeScale: 'medium',
  elevation: 'level1',
  stateLayer: 'present',
  focusIndicator: 'visible',
  reducedMotion: 'supported',
};

const privacy: DesignParityPrivacy = {
  publicSafe: true,
  identifierClass: 'neutral-public',
  redactions: ['credential-data', 'machine-location', 'network-target', 'unreviewed-content'],
};

function row(
  kind: DesignParityKind,
  [id, surface, variant]: readonly [string, string, string],
): DesignParityRow {
  const output = `pending-${id}`;
  return {
    id,
    kind,
    surface,
    variant,
    output,
    tuple: [id, kind, surface, output],
    geometry,
    md3,
    evidence: {
      source: 'public-contract',
      status: 'pending',
      artifactId: output,
      verifiedAt: null,
      note: 'Runtime capture is pending; this row proves contract shape only.',
    },
    privacy,
  };
}

export const DESIGN_PARITY_INVENTORY: readonly DesignParityRow[] = [
  ...BASE_ROWS.map((entry) => row('base', entry)),
  ...OVERLAY_ROWS.map((entry) => row('overlay', entry)),
  ...CATALOG_ROWS.map((entry) => row('catalog', entry)),
];

const SAFE_IDENTIFIER = /^[a-z][a-z0-9-]*$/;
const FORBIDDEN_PUBLIC_TEXT = /https?:\/\/|[A-Za-z]:\\|\\\\|@|password|token|secret|private|unreviewed-source/i;

function violation(message: string): never {
  throw new Error(`Design parity contract violation: ${message}`);
}

function assertIdentifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !SAFE_IDENTIFIER.test(value)) violation(`${label} must be a neutral public identifier.`);
}

export function assertExactMembership(rows: readonly DesignParityRow[], expected = DESIGN_PARITY_EXPECTED_IDS): void {
  const actual = rows.map((entry) => entry.id).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((id, index) => id !== required[index])) {
    violation(`row membership must exactly equal the ${required.length} expected identifiers.`);
  }
}

export function assertUniqueOutputs(rows: readonly DesignParityRow[]): void {
  const outputs = rows.map((entry) => entry.output);
  if (new Set(outputs).size !== outputs.length) violation('each row must have a unique output identifier.');
}

export function assertTuple(rows: readonly DesignParityRow[]): void {
  for (const entry of rows) {
    if (!Array.isArray(entry.tuple) || entry.tuple.length !== 4) violation(`${entry.id} tuple must have four members.`);
    if (entry.tuple[0] !== entry.id || entry.tuple[1] !== entry.kind || entry.tuple[2] !== entry.surface || entry.tuple[3] !== entry.output) {
      violation(`${entry.id} tuple does not match its row fields.`);
    }
  }
}

export function assertPrivacy(rows: readonly DesignParityRow[]): void {
  for (const entry of rows) {
    assertIdentifier(entry.id, 'row id');
    assertIdentifier(entry.surface, `${entry.id} surface`);
    assertIdentifier(entry.variant, `${entry.id} variant`);
    assertIdentifier(entry.output, `${entry.id} output`);
    const text = JSON.stringify(entry);
    if (FORBIDDEN_PUBLIC_TEXT.test(text)) violation(`${entry.id} contains a private or unsafe public value.`);
    if (entry.privacy.publicSafe !== true || entry.privacy.identifierClass !== 'neutral-public') violation(`${entry.id} is not marked public-safe.`);
    if (entry.privacy.redactions.join('|') !== 'credential-data|machine-location|network-target|unreviewed-content') violation(`${entry.id} redaction contract changed.`);
  }
}

export function assertGeometry(rows: readonly DesignParityRow[]): void {
  for (const entry of rows) {
    const [viewportWidth, viewportHeight] = entry.geometry.viewport;
    const [x, y, width, height] = entry.geometry.frame;
    const [left, top, right, bottom] = entry.geometry.safeArea;
    if (![viewportWidth, viewportHeight, x, y, width, height, left, top, right, bottom].every(Number.isInteger)) violation(`${entry.id} geometry must use integer tuples.`);
    if (viewportWidth < 320 || viewportHeight < 240 || width <= 0 || height <= 0 || x < 0 || y < 0 || x + width > viewportWidth || y + height > viewportHeight) violation(`${entry.id} frame is outside its viewport.`);
    if (left < 0 || top < 0 || right < 0 || bottom < 0 || left + right >= width || top + bottom >= height) violation(`${entry.id} safe area is invalid.`);
    if (entry.geometry.narrowLayout !== true) violation(`${entry.id} must declare narrow-layout coverage.`);
  }
}

export function assertMd3Audit(rows: readonly DesignParityRow[]): void {
  for (const entry of rows) {
    if (!['surface', 'surface-container', 'surface-container-high'].includes(entry.md3.surfaceRole)) violation(`${entry.id} has an invalid MD3 surface role.`);
    if (!['filled', 'tonal', 'outlined', 'text'].includes(entry.md3.actionRole)) violation(`${entry.id} has an invalid MD3 action role.`);
    if (!['title-large', 'title-medium', 'body-large', 'body-medium', 'label-large'].includes(entry.md3.typographyScale)) violation(`${entry.id} has an invalid MD3 typography scale.`);
    if (!['small', 'medium', 'large'].includes(entry.md3.shapeScale)) violation(`${entry.id} has an invalid MD3 shape scale.`);
    if (!['level0', 'level1', 'level2'].includes(entry.md3.elevation)) violation(`${entry.id} has an invalid MD3 elevation.`);
    if (entry.md3.stateLayer !== 'present' || entry.md3.focusIndicator !== 'visible' || entry.md3.reducedMotion !== 'supported') violation(`${entry.id} is missing required MD3 state, focus, or motion support.`);
  }
}

export function assertEvidenceFields(rows: readonly DesignParityRow[]): void {
  for (const entry of rows) {
    if (entry.evidence.source !== 'public-contract' || entry.evidence.status !== 'pending' || !SAFE_IDENTIFIER.test(entry.evidence.artifactId) || entry.evidence.verifiedAt !== null || entry.evidence.note !== 'Runtime capture is pending; this row proves contract shape only.') {
      violation(`${entry.id} evidence fields are incomplete or overclaiming.`);
    }
    if (entry.evidence.artifactId !== entry.output) violation(`${entry.id} evidence artifact must match its output identifier.`);
  }
}

export type DesignParityValidation = {
  total: number;
  byKind: Record<DesignParityKind, number>;
  outputs: readonly string[];
};

export function validateDesignParityInventory(rows: readonly DesignParityRow[] = DESIGN_PARITY_INVENTORY): DesignParityValidation {
  assertExactMembership(rows);
  assertUniqueOutputs(rows);
  assertTuple(rows);
  assertPrivacy(rows);
  assertGeometry(rows);
  assertMd3Audit(rows);
  assertEvidenceFields(rows);
  const byKind: Record<DesignParityKind, number> = { base: 0, overlay: 0, catalog: 0 };
  for (const entry of rows) byKind[entry.kind] += 1;
  if (rows.length !== DESIGN_PARITY_COUNTS.total || byKind.base !== DESIGN_PARITY_COUNTS.base || byKind.overlay !== DESIGN_PARITY_COUNTS.overlay || byKind.catalog !== DESIGN_PARITY_COUNTS.catalog) {
    violation('row kind counts must be 11 base, 10 overlay, and 3 catalog.');
  }
  return { total: rows.length, byKind, outputs: rows.map((entry) => entry.output) };
}

export const DESIGN_PARITY_VALIDATION = validateDesignParityInventory();
