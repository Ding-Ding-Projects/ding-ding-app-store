import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { app } from 'electron';

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/;
const PROOF_SCHEMA = 'ding-ding-app-store.install-proof.v1';
const DEFAULT_TIMEOUT_MS = 20 * 60_000;
const CLOUD_PROOF_TARGETS = Object.freeze({
  'dim-sum-atlas': Object.freeze({ adapterId: 'dim-sum-atlas-portable-zip', family: 'portable-zip' }),
  winforge: Object.freeze({ adapterId: 'winforge-portable-zip', family: 'portable-zip' }),
  wimforge: Object.freeze({ adapterId: 'wimforge-portable-zip', family: 'portable-zip' }),
});

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
const configuredTimeout = Number(process.env.DING_DING_INSTALL_PROOF_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
const proofTimeoutMs = Number.isFinite(configuredTimeout) ? Math.min(Math.max(configuredTimeout, 60_000), 30 * 60_000) : DEFAULT_TIMEOUT_MS;

if (!appId || !APP_ID_PATTERN.test(appId)) fail('The proof requires one valid catalog application ID.');
else if (!Object.hasOwn(CLOUD_PROOF_TARGETS, appId)) fail('The cloud proof accepts only the reviewed portable ZIP targets.');

if (process.exitCode) process.exit();

await mkdir(path.dirname(path.resolve(output)), { recursive: true });
await mkdir(path.resolve(dataRoot), { recursive: true });
app.setPath('userData', path.resolve(dataRoot));
// Cloud runners have no interactive desktop. Configure the renderer-less Electron
// process before readiness so GPU/sandbox startup cannot turn into an unbounded wait.
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');
app.disableHardwareAcceleration();

const startedAt = new Date().toISOString();
const events = [];
const milestones = [];
const deadline = Date.now() + proofTimeoutMs;
let lastPhase = 'initializing';
let lastProgress = null;
let lastBytes = null;
let operationService = null;
let timedOut = false;
let proof;
let exitCode = 1;

function logMilestone(label, details = '') {
  const line = `[install-proof] ${label}${details ? ` ${details}` : ''}`;
  milestones.push({ at: new Date().toISOString(), label });
  process.stdout.write(`${line}\n`);
}

function progressEvent(event) {
  events.push({
    operationId: event.operationId,
    appId: event.appId,
    phase: event.phase,
    progress: event.progress,
    bytesReceived: event.bytesReceived,
    bytesTotal: event.bytesTotal,
    cancellable: event.cancellable,
    locked: event.locked,
    final: event.final,
  });
  lastProgress = event.progress ?? null;
  lastBytes = event.bytesTotal ? `${event.bytesReceived ?? 0}/${event.bytesTotal}` : null;
  if (event.phase !== lastPhase) {
    lastPhase = event.phase;
    logMilestone('phase', `name=${event.phase} progress=${lastProgress ?? 'n/a'} bytes=${lastBytes ?? 'n/a'}`);
  }
}

function withProofTimeout(work, label) {
  const remaining = Math.max(1, deadline - Date.now());
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      logMilestone('timeout', `label=${label} phase=${lastPhase}`);
      const cancellation = operationService?.cancel({ appId });
      if (cancellation) void cancellation.catch(() => undefined);
      reject(new Error(`Install proof exceeded its ${Math.round(proofTimeoutMs / 60_000)}-minute safety limit during ${label}.`));
    }, remaining);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

const heartbeat = setInterval(() => {
  const elapsed = Math.round((Date.now() - Date.parse(startedAt)) / 1000);
  logMilestone('heartbeat', `elapsedSeconds=${elapsed} phase=${lastPhase} progress=${lastProgress ?? 'n/a'} bytes=${lastBytes ?? 'n/a'}`);
}, 30_000);
heartbeat.unref?.();
logMilestone('started', `appId=${appId} timeoutMinutes=${Math.round(proofTimeoutMs / 60_000)}`);

try {
  // The proof is renderer-less and only needs Electron's path/process shims.
  // Waiting for native UI readiness can hang forever on a cloud runner with no
  // interactive desktop, so do not make service verification depend on it.
  logMilestone('electron-readiness-skipped');
  const { CatalogService } = await import('../dist/main/catalog-service.js');
  const { HistoryService } = await import('../dist/main/history-service.js');
  const { InstalledService } = await import('../dist/main/installed-service.js');
  const { OperationService } = await import('../dist/main/operation-service.js');
  const { adapterFor } = await import('../dist/main/install-adapters.js');

  const catalog = new CatalogService();
  const installed = new InstalledService(catalog);
  catalog.setInstalledProvider(() => installed.list(true));
  const history = new HistoryService();
  operationService = new OperationService(catalog, history, installed, progressEvent);
  logMilestone('services-loaded');
  const adapter = adapterFor(appId);
  const target = CLOUD_PROOF_TARGETS[appId];
  if (!target || !adapter.supported || adapter.id !== target.adapterId || adapter.family !== target.family) {
    throw new Error(`Cloud proof adapter boundary mismatch for ${appId}.`);
  }
  const before = (await withProofTimeout(installed.list(true), 'initial discovery')).filter((record) => record.appId === appId).map((record) => ({
    appId: record.appId, version: record.version, source: record.source, hasUninstall: Boolean(record.uninstall),
  }));
  logMilestone('before-discovery', `records=${before.length}`);
  const result = await withProofTimeout(operationService.install({ appId, decision: 'install' }), 'install');
  logMilestone('install-finished', `ok=${result.ok}`);
  const afterInstall = (await withProofTimeout(installed.list(true), 'post-install discovery')).filter((record) => record.appId === appId).map((record) => ({
    appId: record.appId, version: record.version, source: record.source, hasUninstall: Boolean(record.uninstall),
  }));
  const matchedAfterInstall = afterInstall.length === 1 && afterInstall[0].hasUninstall;
  let cleanup = { attempted: false, ok: true, message: null };
  if (result.ok && matchedAfterInstall) {
    cleanup = { attempted: true, ok: false, message: null };
    logMilestone('uninstall-started');
    const removed = await withProofTimeout(operationService.uninstall({ appId, decision: 'uninstall' }), 'uninstall');
    cleanup = { attempted: true, ok: removed.ok, message: removed.message };
  }
  const afterCleanup = (await withProofTimeout(installed.list(true), 'post-cleanup discovery')).filter((record) => record.appId === appId).map((record) => ({
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
    timedOut,
    milestones,
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
    timedOut,
    milestones,
    progress: events,
    verdict: false,
    error: error instanceof Error ? error.message : String(error),
  };
  exitCode = 1;
} finally {
  clearInterval(heartbeat);
  if (!proof) {
    proof = {
      schemaVersion: PROOF_SCHEMA,
      appId,
      runner: { os: process.platform, architecture: process.arch, image: 'windows-2022' },
      sourceRuntimeInvoked: false,
      startedAt,
      completedAt: new Date().toISOString(),
      timedOut,
      milestones,
      progress: events,
      verdict: false,
      error: 'The proof exited before it could produce a result.',
    };
  }
  await writeFile(path.resolve(output), `${JSON.stringify(proof, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  logMilestone('evidence-written');
  if (app.isReady()) app.exit(exitCode);
  else process.exit(exitCode);
}

process.exitCode = exitCode;
