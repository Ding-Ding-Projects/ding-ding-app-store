import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertLifecycleMatrix,
  assertLifecycleReceipt,
  LIFECYCLE_PRODUCTS,
  LIFECYCLE_PRODUCT_IDS,
  LIFECYCLE_PROOF_SCHEMA,
  LIFECYCLE_STAGES,
} from '../scripts/lifecycle-proof-matrix.mjs';
import { redact, runLifecycleProof, runProductLifecycle } from '../scripts/lifecycle-proof.mjs';

const EXPECTED_SOURCE_RECIPE_IDS = [
  'farming-game', 'material-cookie-clicker', 'material-encryption', 'material-ollama', 'material-sandbox',
  'material-tools', 'material-virtualbox', 'material-winforge', 'material-winutil', 'meadowmark',
  'minecraft-server-command-center', 'minecraft-server-studio', 'sprout-hollow-valley',
];

function exactSet(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && new Set(actual).size === expected.length && actual.every((id) => expected.includes(id));
}

describe('13-product lifecycle proof contract', () => {
  it('keeps an exact, pinned, fresh-guest matrix', () => {
    expect(LIFECYCLE_PRODUCTS).toHaveLength(13);
    expect(new Set(LIFECYCLE_PRODUCTS.map((entry) => entry.appId)).size).toBe(13);
    expect(LIFECYCLE_PRODUCTS.every((entry) => entry.source.pinned && entry.guest.isolation === 'fresh-per-recipe' && entry.guest.hostMounts === false && entry.guest.secrets === false && entry.proofStatus === 'blocked-until-proof')).toBe(true);
    expect(() => assertLifecycleMatrix(LIFECYCLE_PRODUCTS.slice(0, 12))).toThrow(/exactly 13/);
  });

  it('keeps the hand-written matrix, recipe catalog, and blocked proof targets exact-set equal', async () => {
    const recipes = JSON.parse(await readFile(path.join(process.cwd(), 'data/source-recipes.v1.json'), 'utf8')).recipes as Array<{ appId: string }>;
    const apps = JSON.parse(await readFile(path.join(process.cwd(), 'data/catalog.v1.json'), 'utf8')).apps as Array<{ id: string; proofStatus?: string; proofTargetId?: string | null }>;
    expect(exactSet(EXPECTED_SOURCE_RECIPE_IDS, LIFECYCLE_PRODUCT_IDS)).toBe(true);
    expect(exactSet(recipes.map((recipe) => recipe.appId), EXPECTED_SOURCE_RECIPE_IDS)).toBe(true);
    expect(exactSet(apps.filter((app) => app.proofStatus === 'blocked-until-proof').map((app) => app.id), EXPECTED_SOURCE_RECIPE_IDS)).toBe(true);
    for (const row of LIFECYCLE_PRODUCTS) {
      const recipe = recipes.find((entry) => entry.appId === row.appId);
      const app = apps.find((entry) => entry.id === row.appId);
      expect(recipe).toBeTruthy();
      expect(app).toMatchObject({ proofStatus: 'blocked-until-proof', proofTargetId: `${row.appId}-clean-windows` });
    }
    const missing = EXPECTED_SOURCE_RECIPE_IDS.filter((id) => id !== 'material-tools');
    expect(exactSet(missing, EXPECTED_SOURCE_RECIPE_IDS)).toBe(false);
    expect(exactSet([...missing, 'material-tools'], EXPECTED_SOURCE_RECIPE_IDS)).toBe(true);
  });

  it('names every source, install, readiness, uninstall, absence, and disposal stage', () => {
    expect(LIFECYCLE_STAGES).toEqual([
      'source-archive', 'source-digest', 'source-build', 'source-output', 'source-run-readiness',
      'release-install', 'exact-ownership-rediscovery', 'installed-process-readiness',
      'installed-window-readiness', 'exact-uninstall', 'absence', 'guest-disposal',
    ]);
  });

  it('redacts paths, URLs, commands, and secret-looking fields without touching digests', () => {
    expect(redact({ command: 'danger.exe', installPath: 'C:\\secret', url: 'https://example.test', digest: 'a'.repeat(64) })).toEqual({ command: '[REDACTED]', installPath: '[REDACTED]', url: '[REDACTED]', digest: 'a'.repeat(64) });
  });

  it('keeps one guest per product and records a complete verified receipt through an injected driver', async () => {
    const calls: string[] = [];
    const driver = {
      async createGuest({ product }: any) { calls.push(`create:${product.appId}`); return { status: 'verified', guest: { id: `guest-${product.appId}` } }; },
      async disposeGuest({ product }: any) { calls.push(`dispose:${product.appId}`); return { status: 'verified', details: { disposed: true } }; },
    } as Record<string, any>;
    for (const stage of LIFECYCLE_STAGES.slice(0, -1)) driver[stage.replaceAll('-', '')] = undefined;
    // The harness uses explicit driver method names; provide each one without
    // importing or modifying the central adapter/source registries.
    const methods = ['sourceArchive', 'sourceDigest', 'sourceBuild', 'sourceOutput', 'sourceRunReadiness', 'releaseInstall', 'rediscoverOwnership', 'installedProcessReadiness', 'installedWindowReadiness', 'exactUninstall', 'absence'];
    for (const method of methods) driver[method] = async ({ product }: any) => { calls.push(`${method}:${product.appId}`); return { status: 'verified' }; };
    const receipt = await runProductLifecycle(LIFECYCLE_PRODUCTS[0], driver, { timeoutMs: 1000, retries: 1 });
    expect(receipt.schemaVersion).toBe(LIFECYCLE_PROOF_SCHEMA);
    expect(receipt.stages).toHaveLength(13);
    expect(receipt.verdict).toBe(true);
    expect(calls[0]).toBe(`create:${LIFECYCLE_PRODUCTS[0].appId}`);
    expect(calls.at(-1)).toBe(`dispose:${LIFECYCLE_PRODUCTS[0].appId}`);
  });

  it('fails closed and names integration dependency points when the driver is absent', async () => {
    const aggregate = await runLifecycleProof({ timeoutMs: 1000, retries: 1 });
    expect(aggregate.schemaVersion).toBe(LIFECYCLE_PROOF_SCHEMA);
    expect(aggregate.productCount).toBe(13);
    expect(aggregate.verdict).toBe(false);
    expect(aggregate.dependencyPoints.length).toBeGreaterThan(0);
    expect(aggregate.receipts.every((receipt) => receipt.verdict === false)).toBe(true);
  });

  it('retains all stage slots after an early failure instead of hiding the tail', async () => {
    const driver = {
      async createGuest() { return { status: 'verified', guest: { id: 'guest' } }; },
      async sourceArchive() { throw new Error('archive failed'); },
      async disposeGuest() { return { status: 'verified' }; },
    } as Record<string, any>;
    const receipt = await runProductLifecycle(LIFECYCLE_PRODUCTS[0], driver, { timeoutMs: 1000, retries: 1 });
    expect(receipt.stages).toHaveLength(13);
    expect(receipt.stages.find((stage) => stage.name === 'source-archive')?.status).toBe('failed');
    expect(receipt.stages.find((stage) => stage.name === 'source-build')?.status).toBe('blocked');
    expect(receipt.stages.at(-1)?.name).toBe('guest-disposal');
  });

  it('writes a bounded aggregate with the standalone CLI contract', async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), 'ding-lifecycle-proof-'));
    try {
      const receipt = await runLifecycleProof({ timeoutMs: 1000, retries: 1 });
      await writeFile(path.join(temp, 'one.json'), `${JSON.stringify(receipt)}\n`, 'utf8');
      expect(JSON.parse(await readFile(path.join(temp, 'one.json'), 'utf8')).schemaVersion).toBe(LIFECYCLE_PROOF_SCHEMA);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it('accepts exactly one validated receipt per matrix row and rejects duplicates', async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), 'ding-lifecycle-aggregate-'));
    const output = path.join(os.tmpdir(), `ding-lifecycle-aggregate-${Date.now()}.json`);
    try {
      const driver: Record<string, any> = {
        async createGuest({ product }: any) { return { status: 'verified', guest: { id: `guest-${product.appId}` } }; },
        async disposeGuest() { return { status: 'verified' }; },
      };
      for (const method of ['sourceArchive', 'sourceDigest', 'sourceBuild', 'sourceOutput', 'sourceRunReadiness', 'releaseInstall', 'rediscoverOwnership', 'installedProcessReadiness', 'installedWindowReadiness', 'exactUninstall', 'absence']) {
        driver[method] = async () => ({ status: 'verified' });
      }
      for (const appId of LIFECYCLE_PRODUCT_IDS) {
        const one = await runLifecycleProof({ appId, driver, timeoutMs: 1000, retries: 1 });
        expect(one.productCount).toBe(1);
        assertLifecycleReceipt(one.receipts[0]);
        await writeFile(path.join(temp, `${appId}.json`), `${JSON.stringify(one)}\n`, 'utf8');
      }
      execFileSync(process.execPath, ['scripts/aggregate-lifecycle-proof.mjs', '--input-dir', temp, '--output', output], { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8' });
      const aggregate = JSON.parse(await readFile(output, 'utf8'));
      expect(aggregate.productCount).toBe(13);
      expect(aggregate.verdict).toBe(true);
      expect(aggregate.receipts.map((receipt: any) => receipt.product.appId)).toEqual(LIFECYCLE_PRODUCT_IDS);

      await writeFile(path.join(temp, 'duplicate.json'), await readFile(path.join(temp, `${LIFECYCLE_PRODUCT_IDS[0]}.json`), 'utf8'), 'utf8');
      expect(() => execFileSync(process.execPath, ['scripts/aggregate-lifecycle-proof.mjs', '--input-dir', temp, '--output', output], { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8', stdio: 'pipe' })).toThrow(/exactly 13 unique matrix receipts/);
    } finally {
      await rm(temp, { recursive: true, force: true });
      await rm(output, { force: true });
    }
  });
});
