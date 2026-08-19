import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertSourceLifecycleReceipt,
  assertSourceRecipeCatalog,
  createUnavailableDriver,
  loadSourceRecipeCatalog,
  runSourceLifecycleProof,
  runSourceRecipeLifecycle,
  SOURCE_LIFECYCLE_SCHEMA,
  SOURCE_LIFECYCLE_STAGES,
  SOURCE_RECIPE_COUNT,
} from '../scripts/source-lifecycle-proof.mjs';

const EXPECTED_IDS = [
  'farming-game', 'material-cookie-clicker', 'material-encryption', 'material-ollama', 'material-sandbox',
  'material-tools', 'material-virtualbox', 'material-winforge', 'material-winutil', 'meadowmark',
  'minecraft-server-command-center', 'minecraft-server-studio', 'sprout-hollow-valley',
];

describe('source recipe lifecycle proof', () => {
  it('keeps the exact thirteen recipe inventory and four explicit native blockers', async () => {
    const catalog = await loadSourceRecipeCatalog();
    assertSourceRecipeCatalog(catalog);
    expect(catalog.recipes).toHaveLength(SOURCE_RECIPE_COUNT);
    expect(catalog.recipes.map((recipe) => recipe.appId).sort()).toEqual([...EXPECTED_IDS].sort());
    expect(catalog.recipes.filter((recipe) => recipe.status === 'blocked').map((recipe) => recipe.appId).sort()).toEqual(['material-encryption', 'material-ollama', 'material-sandbox', 'material-virtualbox']);
  });

  it('persists thirteen explicit blocked receipts without an attested guest', async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), 'source-lifecycle-proof-'));
    try {
      const aggregate = await runSourceLifecycleProof({ outputDir, driver: createUnavailableDriver() });
      expect(aggregate.schemaVersion).toBe(SOURCE_LIFECYCLE_SCHEMA);
      expect(aggregate.productCount).toBe(13);
      expect(aggregate.verdict).toBe(false);
      expect(aggregate.receipts.every((receipt) => receipt.sourceRuntimeInvoked === false)).toBe(true);
      expect(aggregate.receipts.every((receipt) => receipt.stages.length === SOURCE_LIFECYCLE_STAGES.length)).toBe(true);
      expect(JSON.parse(await readFile(path.join(outputDir, 'source-lifecycle-proof.v1.json'), 'utf8')).receipts).toHaveLength(13);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it('executes only through an explicitly attested driver and always disposes its guest', async () => {
    const catalog = await loadSourceRecipeCatalog();
    const recipe = catalog.recipes.find((entry) => entry.status === 'ready')!;
    const calls: string[] = [];
    const driver = {
      proofBoundary: 'windows-sandbox-attested',
      async createGuest() { calls.push('create'); return { status: 'verified', guest: { id: 'guest-attested' } }; },
      async buildFromSource() { calls.push('build'); return { status: 'verified', details: { sourceRuntimeInvoked: true } }; },
      async runFromSource() { calls.push('run'); return { status: 'verified', details: { sourceRuntimeInvoked: true } }; },
      async install() { calls.push('install'); return { status: 'verified', details: { ownershipMatch: true } }; },
      async launch() { calls.push('launch'); return { status: 'verified', details: { processReady: true, windowReady: true } }; },
      async uninstall() { calls.push('uninstall'); return { status: 'verified', details: { absenceVerified: true } }; },
      async disposeGuest() { calls.push('dispose'); return { status: 'verified', details: { disposed: true } }; },
    };
    const receipt = await runSourceRecipeLifecycle(recipe, driver, { timeoutMs: 1000 });
    expect(receipt.verdict).toBe(true);
    expect(receipt.sourceRuntimeInvoked).toBe(true);
    expect(calls).toEqual(['create', 'build', 'run', 'install', 'launch', 'uninstall', 'dispose']);
    expect(() => assertSourceLifecycleReceipt({ ...receipt, verdict: false })).toThrow(/verdict/i);
  });

  it('never upgrades a blocked native recipe even when an attested driver is supplied', async () => {
    const catalog = await loadSourceRecipeCatalog();
    const recipe = catalog.recipes.find((entry) => entry.appId === 'material-sandbox')!;
    let created = false;
    const receipt = await runSourceRecipeLifecycle(recipe, { proofBoundary: 'windows-sandbox-attested', async createGuest() { created = true; return { status: 'verified', guest: {} }; } }, { timeoutMs: 1000 });
    expect(created).toBe(false);
    expect(receipt.verdict).toBe(false);
    expect(receipt.stages.every((stage) => stage.status === 'blocked')).toBe(true);
    expect(receipt.stages[0].details.reasonCode).toBe('recipe-blocked');
  });
});
