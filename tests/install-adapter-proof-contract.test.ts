import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { LIFECYCLE_PRODUCTS, LIFECYCLE_PROOF_SCHEMA, LIFECYCLE_STAGES } from '../scripts/lifecycle-proof-matrix.mjs';

describe('lifecycle proof replacement', () => {
  it('retires the side-effect install-adapter workflow', async () => {
    await expect(readFile('.github/workflows/install-adapter-proof.yml', 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('keeps the receipt contract exact and source-runtime integration explicit', () => {
    expect(LIFECYCLE_PROOF_SCHEMA).toBe('ding-ding-app-store.lifecycle-proof.v2');
    expect(LIFECYCLE_PRODUCTS).toHaveLength(13);
    expect(LIFECYCLE_STAGES).toContain('source-run-readiness');
    expect(LIFECYCLE_STAGES).toContain('installed-window-readiness');
    expect(LIFECYCLE_STAGES).toContain('guest-disposal');
  });
});
