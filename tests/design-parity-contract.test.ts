import { describe, expect, it } from 'vitest';
import {
  DESIGN_PARITY_COUNTS,
  DESIGN_PARITY_EXPECTED_IDS,
  DESIGN_PARITY_INVENTORY,
  assertCapturePolicy,
  assertDeviations,
  assertEvidenceFields,
  assertExactMembership,
  assertGeometry,
  assertMd3Audit,
  assertPrivacy,
  assertRoutes,
  assertSemanticAssertions,
  assertTuple,
  assertUniqueOutputs,
  validateDesignParityInventory,
  type DesignParityRow,
} from '../.codex/verification/design-parity-inventory';

const copyRows = () => structuredClone(DESIGN_PARITY_INVENTORY) as DesignParityRow[];

describe('public design parity inventory', () => {
  it('keeps the approved exact 11/10/3 membership and variant geometry', () => {
    expect(DESIGN_PARITY_INVENTORY).toHaveLength(24);
    expect(validateDesignParityInventory()).toMatchObject({
      total: DESIGN_PARITY_COUNTS.total,
      byKind: { base: DESIGN_PARITY_COUNTS.base, overlay: DESIGN_PARITY_COUNTS.overlay, 'catalog-variant': DESIGN_PARITY_COUNTS.catalogVariant },
    });
    expect(DESIGN_PARITY_INVENTORY.map((row) => row.id).sort()).toEqual([...DESIGN_PARITY_EXPECTED_IDS].sort());
    expect(DESIGN_PARITY_INVENTORY.filter((row) => row.kind === 'base').map((row) => [row.id, row.surface])).toEqual([
      ['catalog', 'catalog'], ['installed', 'installed'], ['updates', 'updates'], ['authenticator', 'authenticator'], ['docs-article', 'docs-article'], ['activity', 'activity'],
      ['settings-general', 'settings-general'], ['settings-appearance', 'settings-appearance'], ['settings-schedule', 'settings-schedule'], ['settings-about', 'settings-about'], ['settings-support', 'settings-support'],
    ]);
    expect(DESIGN_PARITY_INVENTORY.filter((row) => row.kind !== 'catalog-variant').every((row) => row.tuple[2] === 'light' && row.tuple[3] === '1440x920' && row.tuple[4] === 1 && row.tuple[5] === 'bilingual')).toBe(true);
    expect(DESIGN_PARITY_INVENTORY.filter((row) => row.kind === 'catalog-variant').map((row) => row.tuple.slice(2, 4))).toEqual([['dark', '1440x920'], ['light', '820x920'], ['light', '360x640']]);
  });

  it('keeps every route, output, and normalized tuple tied to one row', () => {
    assertRoutes(DESIGN_PARITY_INVENTORY);
    assertUniqueOutputs(DESIGN_PARITY_INVENTORY);
    assertTuple(DESIGN_PARITY_INVENTORY);
    expect(new Set(DESIGN_PARITY_INVENTORY.map((row) => row.output)).size).toBe(24);
    expect(DESIGN_PARITY_INVENTORY.every((row) => row.referenceRoute === row.builtRoute)).toBe(true);
  });

  it('audits fixture policy, semantic assertions, geometry, MD3 primitives, and privacy', () => {
    assertCapturePolicy(DESIGN_PARITY_INVENTORY);
    assertSemanticAssertions(DESIGN_PARITY_INVENTORY);
    assertGeometry(DESIGN_PARITY_INVENTORY);
    assertMd3Audit(DESIGN_PARITY_INVENTORY);
    assertPrivacy(DESIGN_PARITY_INVENTORY);
    expect(DESIGN_PARITY_INVENTORY.every((row) => row.capturePolicy.network === 'offline')).toBe(true);
    expect(DESIGN_PARITY_INVENTORY.every((row) => row.md3Audit.length === 5)).toBe(true);
    expect(JSON.stringify(DESIGN_PARITY_INVENTORY)).not.toMatch(/https?:\/\/|[A-Za-z]:\\|@/i);
  });

  it('requires pending raw reference, built, comparison, and diff evidence placeholders', () => {
    assertEvidenceFields(DESIGN_PARITY_INVENTORY);
    expect(DESIGN_PARITY_INVENTORY.every((row) => Object.values(row.rawEvidence).every((evidence) => evidence.sha256 === null))).toBe(true);
    expect(DESIGN_PARITY_INVENTORY.every((row) => row.status === 'pending' && row.runtimeVerified === false)).toBe(true);
  });

  it('rejects missing route and each normalized tuple field mutation', () => {
    const missingRoute = copyRows();
    missingRoute[0].builtRoute = '';
    expect(() => assertRoutes(missingRoute)).toThrow(/route/);

    const tupleFields: Array<[number, unknown]> = [[0, 'changed-screen'], [1, 'changed-state'], [2, 'dark'], [3, '360x640'], [4, 2], [5, 'english']];
    for (const [index, value] of tupleFields) {
      const mutated = copyRows();
      (mutated[0].tuple as unknown as unknown[])[index] = value;
      expect(() => assertTuple(mutated), `tuple field ${index} should be checked`).toThrow(/tuple/);
    }
  });

  it('rejects audit, raw-capture, comparison, and diff mutations', () => {
    const auditMutation = copyRows();
    auditMutation[0].md3Audit = auditMutation[0].md3Audit.slice(0, 4);
    expect(() => assertMd3Audit(auditMutation)).toThrow(/MD3/);

    for (const key of ['reference', 'built', 'comparison', 'diff'] as const) {
      const pathMutation = copyRows();
      pathMutation[0].rawEvidence[key].path = 'bad path';
      expect(() => assertEvidenceFields(pathMutation), `${key} path should be checked`).toThrow(/raw evidence/);

      const hashMutation = copyRows();
      (hashMutation[0].rawEvidence[key] as unknown as { sha256: unknown }).sha256 = 'digest-placeholder';
      expect(() => assertEvidenceFields(hashMutation), `${key} hash should be checked`).toThrow(/raw evidence/);
    }
  });

  it('rejects deviation entries without both a reason and approval', () => {
    const missingReason = copyRows();
    missingReason[0].deviations = [{ reason: '', approved: true }];
    expect(() => assertDeviations(missingReason)).toThrow(/deviation/);

    const missingApproval = copyRows();
    missingApproval[0].deviations = [{ reason: 'documented difference', approved: false } as DesignParityRow['deviations'][number]];
    expect(() => assertDeviations(missingApproval)).toThrow(/deviation/);
  });
});
