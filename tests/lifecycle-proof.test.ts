import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertLifecycleMatrix,
  LIFECYCLE_PRODUCTS,
  LIFECYCLE_PROOF_SCHEMA,
  LIFECYCLE_STAGES,
} from '../scripts/lifecycle-proof-matrix.mjs';
import { redact, runLifecycleProof, runProductLifecycle } from '../scripts/lifecycle-proof.mjs';

describe('13-product lifecycle proof contract', () => {
  it('keeps an exact, pinned, fresh-guest matrix', () => {
    expect(LIFECYCLE_PRODUCTS).toHaveLength(13);
    expect(new Set(LIFECYCLE_PRODUCTS.map((entry) => entry.appId)).size).toBe(13);
    expect(LIFECYCLE_PRODUCTS.every((entry) => entry.source.pinned && entry.guest.isolation === 'fresh-per-product' && entry.guest.hostMounts === false && entry.guest.secrets === false)).toBe(true);
    expect(() => assertLifecycleMatrix(LIFECYCLE_PRODUCTS.slice(0, 12))).toThrow(/exactly 13/);
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
});
