import { access, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { app } from 'electron';

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/;
const PROOF_SCHEMA = 'ding-ding-app-store.install-proof.v1';
const DEFAULT_TIMEOUT_MS = 20 * 60_000;
const MAX_PROGRESS_EVENTS = 256;
const MAX_REGISTRY_DIAGNOSTICS = 16;
const CLEANUP_SETTLE_TIMEOUT_MS = 30_000;
const CLEANUP_SETTLE_INTERVAL_MS = 250;

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
const repositoryRoot = path.resolve('.');
// The proof copies third-party portable archives as ordinary files. Electron's
// ASAR fs wrapper would inspect a partially written resources/app.asar during
// extraction and reject it before the ZIP transaction can finish.
process.noAsar = true;
const configuredTimeout = Number(process.env.DING_DING_INSTALL_PROOF_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
const proofTimeoutMs = Number.isFinite(configuredTimeout) ? Math.min(Math.max(configuredTimeout, 60_000), 30 * 60_000) : DEFAULT_TIMEOUT_MS;

if (!appId || !APP_ID_PATTERN.test(appId)) fail('The proof requires one valid catalog application ID.');

if (process.exitCode) process.exit();

await mkdir(path.dirname(path.resolve(output)), { recursive: true });
await mkdir(path.resolve(dataRoot), { recursive: true });
app.setPath('userData', path.resolve(dataRoot));
// Electron resolves app-owned data from the entry script directory. The proof
// entrypoint lives under scripts/, while the reviewed catalog lives at the
// repository root, so pin this renderer-less harness to the checkout root.
app.getAppPath = () => repositoryRoot;
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
let droppedProgressEvents = 0;
let operationService = null;
const processObservations = [];
let timedOut = false;
let proof;
let exitCode = 1;

function logMilestone(label, details = '') {
  const line = `[install-proof] ${label}${details ? ` ${details}` : ''}`;
  milestones.push({ at: new Date().toISOString(), label });
  process.stdout.write(`${line}\n`);
}

function progressEvent(event) {
  const phaseChanged = event.phase !== lastPhase;
  const progressChanged = event.progress !== lastProgress;
  const boundedEvent = {
    operationId: event.operationId,
    appId: event.appId,
    phase: event.phase,
    progress: event.progress,
    bytesReceived: event.bytesReceived,
    bytesTotal: event.bytesTotal,
    cancellable: event.cancellable,
    locked: event.locked,
    final: event.final,
  };
  if (phaseChanged || progressChanged || event.final) {
    if (events.length < MAX_PROGRESS_EVENTS) events.push(boundedEvent);
    else {
      droppedProgressEvents += 1;
      if (event.final) events[events.length - 1] = boundedEvent;
    }
  }
  lastProgress = event.progress ?? null;
  lastBytes = event.bytesTotal ? `${event.bytesReceived ?? 0}/${event.bytesTotal}` : null;
  if (phaseChanged) {
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

function processObservation(observation) {
  if (processObservations.length >= 8) return;
  processObservations.push({
    operationLabel: observation.operationLabel,
    stage: observation.stage,
    processId: observation.processId,
    exitCode: observation.exitCode,
  });
}

async function pathPresent(target) {
  if (!target) return false;
  try { await access(target); return true; } catch { return false; }
}

async function ownedFileState(record) {
  const installRoot = record?.installRoot ?? null;
  const uninstallExecutable = record?.uninstall?.kind === 'portable' ? null : record?.uninstall?.executable ?? null;
  const executableNames = installRoot && await pathPresent(installRoot)
    ? (await readdir(installRoot, { withFileTypes: true }).catch(() => []))
      .filter((entry) => entry.isFile() && entry.name.toLocaleLowerCase().endsWith('.exe'))
      .map((entry) => entry.name).sort().slice(0, 16)
    : [];
  return {
    installRootPresent: await pathPresent(installRoot),
    uninstallExecutablePresent: await pathPresent(uninstallExecutable),
    executableNames,
  };
}

async function waitForTargetAbsence(installedService, targetAppId) {
  const settleDeadline = Math.min(deadline, Date.now() + CLEANUP_SETTLE_TIMEOUT_MS);
  let records = [];
  do {
    records = (await withProofTimeout(installedService.list(true), 'post-cleanup discovery'))
      .filter((record) => record.appId === targetAppId);
    if (records.length === 0) return records;
    const remaining = settleDeadline - Date.now();
    if (remaining <= 0) return records;
    await new Promise((resolve) => setTimeout(resolve, Math.min(CLEANUP_SETTLE_INTERVAL_MS, remaining)));
  } while (Date.now() < settleDeadline);
  return records;
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
  const { adapterFor, selectInstallerAsset } = await import('../dist/main/install-adapters.js');
  const { cloudInstallProofTargetFor } = await import('../dist/main/install-proof-targets.js');
  const { exactDisplayNameMatch, extractQuotedExecutable, registryEntryFingerprint } = await import('../dist/main/installed-detection.js');

  const catalog = new CatalogService();
  const installed = new InstalledService(catalog);
  catalog.setInstalledProvider(() => installed.list(true));
  const history = new HistoryService();
  operationService = new OperationService(catalog, history, installed, progressEvent, processObservation);
  logMilestone('services-loaded');
  const adapter = adapterFor(appId);
  const target = cloudInstallProofTargetFor(appId);
  if (!target) throw new Error('The cloud proof accepts only explicitly reviewed install targets.');
  if (!adapter.supported || adapter.id !== target.adapterId || adapter.family !== target.family) {
    throw new Error(`Cloud proof adapter boundary mismatch for ${appId}.`);
  }
  const release = await withProofTimeout(catalog.latestRelease((await catalog.recordFor(appId)).repository), 'release integrity');
  if (!release || release.draft || release.prerelease) throw new Error('The proof target has no stable published release.');
  const selectedAsset = selectInstallerAsset(adapter, release.assets);
  const directSha256 = typeof selectedAsset.digest === 'string' && /^sha256:[0-9a-f]{64}$/.test(selectedAsset.digest)
    ? selectedAsset.digest.slice('sha256:'.length)
    : null;
  if (target.requiresDirectSha256 && !directSha256) {
    throw new Error('The proof target requires a direct GitHub SHA-256 digest for the selected installer.');
  }
  const resolvedIntegrity = {
    releaseTag: release.tag_name,
    assetName: selectedAsset.name,
    assetBytes: selectedAsset.size,
    expectedSha256: directSha256,
    downloadVerification: 'operation-service-sha256',
  };
  logMilestone('integrity-resolved', `release=${release.tag_name} asset=${selectedAsset.name} bytes=${selectedAsset.size}`);
  const beforeRegistry = target.ownershipKind === 'registry'
    ? await withProofTimeout(installed.registrySnapshot(), 'initial registry diagnostics')
    : [];
  const before = (await withProofTimeout(installed.list(true), 'initial discovery')).filter((record) => record.appId === appId).map((record) => ({
    appId: record.appId, version: record.version, source: record.source, hasUninstall: Boolean(record.uninstall),
    ownershipKind: record.ownership?.kind ?? null, adapterId: record.ownership?.adapterId ?? null,
  }));
  logMilestone('before-discovery', `records=${before.length}`);
  const cleanStart = before.length === 0;
  if (target.requiresCleanStart && !cleanStart) {
    throw new Error('The non-portable proof target was already present; refusing to adopt or uninstall a pre-existing application.');
  }
  const result = await withProofTimeout(operationService.install({ appId, decision: 'install' }), 'install');
  logMilestone('install-finished', `ok=${result.ok}`);
  const completedDownload = [...events].reverse().find((event) => event.phase === 'downloading' && event.progress === 100) ?? null;
  const downloadCompleted = completedDownload?.bytesReceived === selectedAsset.size
    && completedDownload?.bytesTotal === selectedAsset.size;
  const releaseMatchedResult = result.ok && result.message.includes(` ${release.tag_name} installed successfully.`);
  const integrity = {
    ...resolvedIntegrity,
    downloadCompleted,
    releaseMatchedResult,
    sha256Verified: result.ok && downloadCompleted && releaseMatchedResult,
  };
  const afterInstall = (await withProofTimeout(installed.list(true), 'post-install discovery')).filter((record) => record.appId === appId).map((record) => ({
    appId: record.appId, version: record.version, source: record.source, hasUninstall: Boolean(record.uninstall),
    uninstallKind: record.uninstall?.kind ?? null, ownershipKind: record.ownership?.kind ?? null,
    adapterId: record.ownership?.adapterId ?? null,
  }));
  const afterRegistry = target.ownershipKind === 'registry'
    ? await withProofTimeout(installed.registrySnapshot(), 'post-install registry diagnostics')
    : [];
  const beforeRegistryFingerprints = new Map(beforeRegistry.map((entry) => [entry.key.toLocaleLowerCase(), registryEntryFingerprint(entry)]));
  const changedRegistryEntries = afterRegistry.filter((entry) =>
    beforeRegistryFingerprints.get(entry.key.toLocaleLowerCase()) !== registryEntryFingerprint(entry));
  const sanitizedRegistryEntry = (entry) => {
    const executable = extractQuotedExecutable(entry.uninstallString) ?? '';
    return {
      hive: entry.key.toUpperCase().startsWith('HKEY_CURRENT_USER\\') ? 'HKEY_CURRENT_USER' : 'HKEY_LOCAL_MACHINE',
      displayName: entry.displayName,
      displayVersion: entry.displayVersion,
      uninstallExecutableName: path.win32.basename(executable),
      uninstallArguments: executable ? entry.uninstallString.trim().slice(entry.uninstallString.trim().indexOf(executable) + executable.length).replace(/^"/, '').trim().split(/\s+/).filter(Boolean).slice(0, 8) : [],
    };
  };
  const registryDiagnostics = {
    changedEntryCount: changedRegistryEntries.length,
    truncated: changedRegistryEntries.length > MAX_REGISTRY_DIAGNOSTICS,
    entries: changedRegistryEntries.slice(0, MAX_REGISTRY_DIAGNOSTICS).map(sanitizedRegistryEntry),
  };
  const matchedAfterInstall = afterInstall.length === 1
    && afterInstall[0].source === (target.ownershipKind === 'portable' ? 'portable-managed' : 'store')
    && afterInstall[0].hasUninstall
    && afterInstall[0].uninstallKind === target.uninstallKind
    && afterInstall[0].ownershipKind === target.ownershipKind
    && afterInstall[0].adapterId === target.adapterId;
  let cleanup = { attempted: false, ok: true, message: null };
  const ownedBeforeCleanup = result.ok && matchedAfterInstall ? await installed.get(appId) : null;
  const cleanupDiagnostics = {
    processTreeBoundary: 'direct-child-only',
    uninstallKind: ownedBeforeCleanup?.uninstall?.kind ?? null,
    uninstallArguments: ownedBeforeCleanup?.uninstall?.arguments ?? [],
    before: await ownedFileState(ownedBeforeCleanup),
    after: null,
    registryBefore: changedRegistryEntries.slice(0, MAX_REGISTRY_DIAGNOSTICS).map(sanitizedRegistryEntry),
    registryAfter: [],
  };
  if (result.ok && matchedAfterInstall) {
    cleanup = { attempted: true, ok: false, message: null };
    logMilestone('uninstall-started');
    const removed = await withProofTimeout(operationService.uninstall({ appId, decision: 'uninstall' }), 'uninstall');
    cleanup = { attempted: true, ok: removed.ok, message: removed.message };
  }
  const afterCleanup = (await waitForTargetAbsence(installed, appId)).map((record) => ({
    appId: record.appId, version: record.version, source: record.source, hasUninstall: Boolean(record.uninstall),
  }));
  cleanupDiagnostics.after = await ownedFileState(ownedBeforeCleanup);
  cleanupDiagnostics.registryAfter = (await installed.registrySnapshot())
    .filter((entry) => exactDisplayNameMatch(entry.displayName, adapter.registryDisplayNames))
    .slice(0, MAX_REGISTRY_DIAGNOSTICS).map(sanitizedRegistryEntry);
  const persistedAfterCleanup = (await withProofTimeout(installed.list(false), 'persisted cleanup verification')).filter((record) => record.appId === appId).map((record) => ({
    appId: record.appId, version: record.version, source: record.source,
  }));
  const digestVerified = !target.requiresDirectSha256 || Boolean(directSha256);
  const supportedSuccess = adapter.supported
    && (!target.requiresCleanStart || cleanStart)
    && digestVerified
    && integrity.sha256Verified
    && result.ok
    && matchedAfterInstall
    && cleanup.attempted
    && cleanup.ok
    && afterCleanup.length === 0
    && persistedAfterCleanup.length === 0;
  proof = {
    schemaVersion: PROOF_SCHEMA,
    appId,
    adapterId: adapter.id,
    supported: adapter.supported,
    family: adapter.family,
    target,
    integrity,
    runner: { os: process.platform, architecture: process.arch, image: 'windows-2022' },
    sourceRuntimeInvoked: false,
    startedAt,
    completedAt: new Date().toISOString(),
    timedOut,
    milestones,
    before,
    cleanStart,
    result: { ok: result.ok, message: result.message },
    afterInstall,
    registryDiagnostics,
    matchedAfterInstall,
    cleanup,
    cleanupDiagnostics,
    processObservations,
    afterCleanup,
    persistedAfterCleanup,
    progress: events,
    droppedProgressEvents,
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
    droppedProgressEvents,
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
      droppedProgressEvents,
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
