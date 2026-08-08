import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { app } from 'electron';

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/;
const PROOF_SCHEMA = 'ding-ding-app-store.install-proof.v1';
const CLOUD_PROOF_APP_ID = 'dim-sum-atlas';
const CLOUD_PROOF_ADAPTER_ID = 'dim-sum-atlas-portable-zip';

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}

const appId = option('--app-id');
const output = option('--output', path.resolve('install-proof.json'));
const dataRoot = option('--data-root', path.resolve('install-proof-data'));

if (!appId || !APP_ID_PATTERN.test(appId)) fail('The proof requires one valid catalog application ID.');
else if (appId !== CLOUD_PROOF_APP_ID) fail(`The cloud proof is intentionally limited to ${CLOUD_PROOF_APP_ID}.`);

if (process.exitCode) process.exit();

await mkdir(path.dirname(path.resolve(output)), { recursive: true });
await mkdir(path.resolve(dataRoot), { recursive: true });
app.setPath('userData', path.resolve(dataRoot));
app.disableHardwareAcceleration();

const startedAt = new Date().toISOString();
const events = [];
let proof;
let exitCode = 1;

try {
  await app.whenReady();
  const { CatalogService } = await import('../dist/main/catalog-service.js');
  const { HistoryService } = await import('../dist/main/history-service.js');
  const { InstalledService } = await import('../dist/main/installed-service.js');
  const { OperationService } = await import('../dist/main/operation-service.js');
  const { adapterFor } = await import('../dist/main/install-adapters.js');

  const catalog = new CatalogService();
  const installed = new InstalledService(catalog);
  catalog.setInstalledProvider(() => installed.list(true));
  const history = new HistoryService();
  const operation = new OperationService(catalog, history, installed, (event) => events.push({
    operationId: event.operationId,
    appId: event.appId,
    phase: event.phase,
    progress: event.progress,
    bytesReceived: event.bytesReceived,
    bytesTotal: event.bytesTotal,
    cancellable: event.cancellable,
    locked: event.locked,
    final: event.final,
  }));
  const adapter = adapterFor(appId);
  if (!adapter.supported || adapter.id !== CLOUD_PROOF_ADAPTER_ID || adapter.family !== 'portable-zip') {
    throw new Error(`Cloud proof adapter boundary mismatch for ${appId}.`);
  }
  const before = (await installed.list(true)).filter((record) => record.appId === appId).map((record) => ({
    appId: record.appId, version: record.version, source: record.source, hasUninstall: Boolean(record.uninstall),
  }));
  const result = await operation.install({ appId, decision: 'install' });
  const afterInstall = (await installed.list(true)).filter((record) => record.appId === appId).map((record) => ({
    appId: record.appId, version: record.version, source: record.source, hasUninstall: Boolean(record.uninstall),
  }));
  const matchedAfterInstall = afterInstall.length === 1 && afterInstall[0].hasUninstall;
  let cleanup = { attempted: false, ok: true, message: null };
  if (result.ok && matchedAfterInstall) {
    cleanup = { attempted: true, ok: false, message: null };
    const removed = await operation.uninstall({ appId, decision: 'uninstall' });
    cleanup = { attempted: true, ok: removed.ok, message: removed.message };
  }
  const afterCleanup = (await installed.list(true)).filter((record) => record.appId === appId).map((record) => ({
    appId: record.appId, version: record.version, source: record.source, hasUninstall: Boolean(record.uninstall),
  }));
  const supportedSuccess = adapter.supported && result.ok && matchedAfterInstall && cleanup.attempted && cleanup.ok && afterCleanup.length === 0;
  proof = {
    schemaVersion: PROOF_SCHEMA,
    appId,
    adapterId: adapter.id,
    supported: adapter.supported,
    family: adapter.family,
    runner: { os: process.platform, architecture: process.arch, image: 'windows-2022' },
    sourceRuntimeInvoked: false,
    startedAt,
    completedAt: new Date().toISOString(),
    before,
    result: { ok: result.ok, message: result.message },
    afterInstall,
    matchedAfterInstall,
    cleanup,
    afterCleanup,
    progress: events,
    verdict: supportedSuccess,
  };
  exitCode = proof.verdict ? 0 : 1;
} catch (error) {
  proof = {
    schemaVersion: PROOF_SCHEMA,
    appId,
    runner: { os: process.platform, architecture: process.arch, image: 'windows-2022' },
    sourceRuntimeInvoked: false,
    startedAt,
    completedAt: new Date().toISOString(),
    progress: events,
    verdict: false,
    error: error instanceof Error ? error.message : String(error),
  };
  exitCode = 1;
} finally {
  await writeFile(path.resolve(output), `${JSON.stringify(proof, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  if (app.isReady()) app.quit();
}

process.exitCode = exitCode;
