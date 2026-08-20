import { describe, expect, it } from 'vitest';
import {
  DESIGN_PARITY_COUNTS,
  DESIGN_PARITY_EXPECTED_IDS,
  DESIGN_PARITY_INVENTORY,
  assertEvidenceFields,
  assertExactMembership,
  assertGeometry,
  assertMd3Audit,
  assertPrivacy,
  assertTuple,
  assertUniqueOutputs,
  validateDesignParityInventory,
  type DesignParityRow,
} from '../.codex/verification/design-parity-inventory';

const copyRows = () => structuredClone(DESIGN_PARITY_INVENTORY) as DesignParityRow[];

describe('public design parity inventory', () => {
  it('keeps exact membership and the requested 11/10/3 row split', () => {
    expect(DESIGN_PARITY_INVENTORY).toHaveLength(24);
    expect(DESIGN_PARITY_EXPECTED_IDS).toHaveLength(24);
    expect(validateDesignParityInventory()).toMatchObject({ total: DESIGN_PARITY_COUNTS.total, byKind: { base: DESIGN_PARITY_COUNTS.base, overlay: DESIGN_PARITY_COUNTS.overlay, catalog: DESIGN_PARITY_COUNTS.catalog } });
    expect(DESIGN_PARITY_INVENTORY.map((row) => row.id).sort()).toEqual([...DESIGN_PARITY_EXPECTED_IDS].sort());
  });

  it('keeps every output and tuple tied to one row', () => {
    assertUniqueOutputs(DESIGN_PARITY_INVENTORY);
    assertTuple(DESIGN_PARITY_INVENTORY);
    expect(new Set(DESIGN_PARITY_INVENTORY.map((row) => row.output)).size).toBe(24);
  });

  it('audits public privacy boundaries without provider or machine data', () => {
    assertPrivacy(DESIGN_PARITY_INVENTORY);
    expect(DESIGN_PARITY_INVENTORY.every((row) => row.privacy.publicSafe)).toBe(true);
    expect(JSON.stringify(DESIGN_PARITY_INVENTORY)).not.toMatch(/https?:\/\/|[A-Za-z]:\\|@/i);
  });

  it('audits bounded geometry, MD3 coverage, and evidence fields for every row', () => {
    assertGeometry(DESIGN_PARITY_INVENTORY);
    assertMd3Audit(DESIGN_PARITY_INVENTORY);
    assertEvidenceFields(DESIGN_PARITY_INVENTORY);
    expect(DESIGN_PARITY_INVENTORY.every((row) => row.geometry.narrowLayout && row.md3.reducedMotion === 'supported')).toBe(true);
    expect(DESIGN_PARITY_INVENTORY.every((row) => row.evidence.status === 'pending' && row.evidence.verifiedAt === null)).toBe(true);
  });

  it('rejects negative mutations to exact membership and unique outputs', () => {
    const missing = copyRows().slice(1);
    expect(() => assertExactMembership(missing)).toThrow(/membership/);

    const duplicate = copyRows();
    duplicate[1].output = duplicate[0].output;
    expect(() => assertUniqueOutputs(duplicate)).toThrow(/unique output/);
  });

  it('rejects negative mutations to tuple, privacy, geometry, MD3, and evidence contracts', () => {
    const tupleMutation = copyRows();
    tupleMutation[0].tuple[3] = 'pending-mutated-output';
    expect(() => assertTuple(tupleMutation)).toThrow(/tuple/);

    const privacyMutation = copyRows();
    privacyMutation[0].privacy = { ...privacyMutation[0].privacy, publicSafe: false } as DesignParityRow['privacy'];
    expect(() => assertPrivacy(privacyMutation)).toThrow(/public-safe/);

    const geometryMutation = copyRows();
    geometryMutation[0].geometry = { ...geometryMutation[0].geometry, frame: [0, 0, 2000, 800] };
    expect(() => assertGeometry(geometryMutation)).toThrow(/outside/);

    const md3Mutation = copyRows();
    md3Mutation[0].md3 = { ...md3Mutation[0].md3, focusIndicator: 'hidden' } as DesignParityRow['md3'];
    expect(() => assertMd3Audit(md3Mutation)).toThrow(/focus/);

    const evidenceMutation = copyRows();
    evidenceMutation[0].evidence = { ...evidenceMutation[0].evidence, status: 'verified' } as DesignParityRow['evidence'];
    expect(() => assertEvidenceFields(evidenceMutation)).toThrow(/evidence/);
  });
});
