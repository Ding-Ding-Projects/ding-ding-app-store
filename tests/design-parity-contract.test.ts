import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DESIGN_PARITY_COUNTS,
  DESIGN_PARITY_EXPECTED_IDS,
  DESIGN_PARITY_INVENTORY,
  assertCoverage,
  assertEvidenceFields,
  assertExactMembership,
  assertMd3Audit,
  assertRoutes,
  assertTuple,
  assertUniqueOutputs,
  validateDesignParityInventory,
  type DesignParityRow,
} from '../.codex/verification/design-parity-inventory';

const copyRows = () => structuredClone(DESIGN_PARITY_INVENTORY) as DesignParityRow[];
const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

describe('design parity scene and evidence contract', () => {
  it('keeps exact hand-written 11/11/5 membership including separate tab states and locale variants', () => {
    expect(validateDesignParityInventory()).toEqual({ total: 27, byKind: { base: 11, overlay: 11, variant: 5 } });
    expect(DESIGN_PARITY_COUNTS.total).toBe(27);
    expect(DESIGN_PARITY_INVENTORY.map(({ id }) => id).sort()).toEqual([...DESIGN_PARITY_EXPECTED_IDS].sort());
    expect(DESIGN_PARITY_INVENTORY.find(({ id }) => id === 'tab-management')?.referenceRoute).toContain('overlay=tab-management');
    expect(DESIGN_PARITY_INVENTORY.find(({ id }) => id === 'tab-context-menu')?.referenceRoute).toContain('overlay=context-menu');
  });

  it('uses real query-addressed reference routes and semantic packaged-runtime drive plans', () => {
    assertRoutes(DESIGN_PARITY_INVENTORY);
    expect(DESIGN_PARITY_INVENTORY.every(({ referenceRoute }) => referenceRoute.startsWith('design/reference.html?'))).toBe(true);
    expect(DESIGN_PARITY_INVENTORY.every(({ builtActions, readySelector }) => builtActions.length > 0 && readySelector.length > 0)).toBe(true);
    expect(DESIGN_PARITY_INVENTORY.some(({ referenceRoute }) => referenceRoute.includes('#/'))).toBe(false);
  });

  it('pins the three real reference files to exact digests and the commit that introduced them', () => {
    assertEvidenceFields(DESIGN_PARITY_INVENTORY);
    const expected = DESIGN_PARITY_INVENTORY[0].referenceFiles;
    expect(expected.map(({ path, sha256: digest }) => [path, sha256(path), digest])).toEqual(expected.map(({ path, sha256: digest }) => [path, digest, digest]));
    expect(DESIGN_PARITY_INVENTORY.every(({ sourceProvenance }) => sourceProvenance.referenceSourceCommit === 'fb584dc9d1f2a36de85ee1ef331fdaa29fcf0a5e')).toBe(true);
  });

  it('keeps every exact tuple, evidence path, and screen-specific Material Design 3 audit unique', () => {
    assertTuple(DESIGN_PARITY_INVENTORY);
    assertUniqueOutputs(DESIGN_PARITY_INVENTORY);
    assertMd3Audit(DESIGN_PARITY_INVENTORY);
    expect(DESIGN_PARITY_INVENTORY.every(({ md3Audit }) => md3Audit.every(({ selector, component }) => selector.length > 0 && component.length > 0))).toBe(true);
  });

  it('covers dark, compact, narrow, English, Cantonese, and bilingual states', () => {
    assertCoverage(DESIGN_PARITY_INVENTORY);
    const tuples = DESIGN_PARITY_INVENTORY.map(({ normalizedTuple }) => normalizedTuple);
    expect(new Set(tuples.map(({ locale }) => locale))).toEqual(new Set(['en', 'yue', 'bilingual']));
    expect(tuples.some(({ theme }) => theme === 'dark')).toBe(true);
    expect(tuples.some(({ viewport }) => viewport === '820x920')).toBe(true);
    expect(tuples.some(({ viewport }) => viewport === '360x640')).toBe(true);
  });

  it('fails closed while the final reconciled packaged-artifact receipts are absent', () => {
    expect(DESIGN_PARITY_INVENTORY.every(({ status, runtimeVerified, sourceProvenance }) => status === 'awaiting-final-reconciled-capture' && !runtimeVerified && sourceProvenance.builtSourceCommit === null && sourceProvenance.artifactSha256 === null)).toBe(true);
    expect(DESIGN_PARITY_INVENTORY.every(({ rawEvidence }) => Object.values(rawEvidence).every(({ sha256 }) => sha256 === null))).toBe(true);
  });

  it('proves missing scene, route, tuple, audit, comparison, and locale coverage mutations turn red', () => {
    const probes: Array<() => void> = [];
    const missing = copyRows(); missing.pop(); probes.push(() => assertExactMembership(missing));
    const route = copyRows(); route[0].referenceRoute = '#/catalog'; probes.push(() => assertRoutes(route));
    const tuple = copyRows(); tuple[0].tuple = ['wrong', ...tuple[0].tuple.slice(1)] as DesignParityRow['tuple']; probes.push(() => assertTuple(tuple));
    const audit = copyRows(); audit[0].md3Audit = audit[0].md3Audit.slice(0, 4); probes.push(() => assertMd3Audit(audit));
    const evidence = copyRows(); evidence[0].rawEvidence.comparison.path = evidence[1].rawEvidence.comparison.path; probes.push(() => assertUniqueOutputs(evidence));
    const locale = copyRows().filter(({ normalizedTuple }) => normalizedTuple.locale !== 'yue'); probes.push(() => assertCoverage(locale));
    for (const probe of probes) expect(probe).toThrow(/Design parity contract violation/);
    expect(() => validateDesignParityInventory()).not.toThrow();
  });

  it('makes compare mode load the fixed comparison image and fail closed when it is missing', () => {
    const source = readFileSync('tools/design-reference/main.mjs', 'utf8');
    expect(source).toContain("viewer.loadFile(comparisonFile)");
    expect(source).toContain("!fs.existsSync(resolved)");
    expect(source).not.toContain('compare-banner');
    expect(source).not.toContain('allowedRows');
  });
});
