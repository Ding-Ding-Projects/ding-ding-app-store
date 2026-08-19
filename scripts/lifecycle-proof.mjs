import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import {
  assertLifecycleMatrix,
  lifecycleProductFor,
  LIFECYCLE_PRODUCTS,
  LIFECYCLE_PROOF_SCHEMA,
  LIFECYCLE_STAGES,
} from './lifecycle-proof-matrix.mjs';

export const DEFAULT_TIMEOUT_MS = 20 * 60_000;
export const DEFAULT_RETRIES = 2;
const SAFE_DIGEST = /^[0-9a-f]{64}$/i;
const SAFE_VERSION = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,127}$/;
const DRIVER_METHODS = Object.freeze({
  'source-archive': 'sourceArchive',
  'source-digest': 'sourceDigest',
  'source-build': 'sourceBuild',
  'source-output': 'sourceOutput',
  'source-run-readiness': 'sourceRunReadiness',
  'release-install': 'releaseInstall',
  'exact-ownership-rediscovery': 'rediscoverOwnership',
  'installed-process-readiness': 'installedProcessReadiness',
  'installed-window-readiness': 'installedWindowReadiness',
  'exact-uninstall': 'exactUninstall',
  absence: 'absence',
  'guest-disposal': 'disposeGuest',
});

const REDACTED = '[REDACTED]';
const SECRET_KEY = /(?:token|secret|password|credential|private.?key|registry.?path|install.?path|command|args?|url|uri|environment|env)/i;

function nowIso(clock) { return new Date(clock()).toISOString(); }

export function redact(value, key = '') {
  if (SECRET_KEY.test(key)) return REDACTED;
  if (typeof value === 'string') {
    if (/^(?:https?:|file:|[A-Za-z]:\\|\\\\)/i.test(value)) return REDACTED;
    return value.length > 512 ? `${value.slice(0, 512)}…` : value;
  }
  if (Array.isArray(value)) return value.slice(0, 64).map((item) => redact(item, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 64).map(([entryKey, entryValue]) => [entryKey, redact(entryValue, entryKey)]));
  }
  return value;
}

function safeDetails(value) {
  const details = redact(value);
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {};
  const allowed = ['reasonCode', 'message', 'digest', 'bytes', 'version', 'ownershipMatch', 'processReady', 'windowReady', 'absenceVerified', 'disposed', 'sourceRuntimeInvoked', 'outputCount', 'releaseTag', 'assetName'];
  return Object.fromEntries(allowed.filter((key) => Object.hasOwn(details, key)).map((key) => [key, details[key]]));
}

function normalizeResult(result, fallbackStatus = 'verified') {
  if (result === true) return { status: fallbackStatus, details: {} };
  if (result === false || result == null) return { status: 'failed', details: { reasonCode: 'driver-returned-no-result' } };
  if (typeof result === 'object') {
    const status = result.status === 'verified' || result.ok === true ? 'verified'
      : result.status === 'blocked' ? 'blocked'
        : result.status === 'skipped' ? 'skipped' : 'failed';
    return { status, details: safeDetails(result.details ?? result) };
  }
  return { status: 'failed', details: { reasonCode: 'driver-returned-invalid-result' } };
}

export function withTimeout(work, timeoutMs, label, setTimer = setTimeout, clearTimer = clearTimeout) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimer(() => reject(new Error(`${label} exceeded its ${timeoutMs}ms bound.`)), timeoutMs);
  });
  return Promise.race([Promise.resolve().then(work), timeout]).finally(() => clearTimer(timer));
}

export async function withRetry(work, { attempts = DEFAULT_RETRIES, timeoutMs = DEFAULT_TIMEOUT_MS, label = 'lifecycle stage' } = {}) {
  const boundedAttempts = Math.min(Math.max(Number(attempts) || 1, 1), 3);
  let lastError;
  for (let attempt = 1; attempt <= boundedAttempts; attempt += 1) {
    try {
      return await withTimeout(() => work(attempt), timeoutMs, label);
    } catch (error) {
      lastError = error;
      if (attempt === boundedAttempts) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function blocked(reasonCode = 'driver-integration-pending') {
  return { status: 'blocked', details: { reasonCode } };
}

export function createUnavailableDriver() {
  return {
    async createGuest() { return { status: 'blocked', details: { reasonCode: 'disposable-guest-driver-pending' } }; },
  };
}

async function loadDriver(modulePath) {
  if (!modulePath) return createUnavailableDriver();
  const module = await import(pathToFileURL(path.resolve(modulePath)).href);
  const driver = module.default ?? module.lifecycleProofDriver ?? module;
  if (!driver || typeof driver !== 'object') throw new Error('Lifecycle driver module did not export an object.');
  return driver;
}

function phaseRecord(name, status, startedAt, clock, details = {}) {
  return { name, status, startedAt, completedAt: nowIso(clock), details: safeDetails(details) };
}

export async function runProductLifecycle(product, driver, {
  clock = Date.now,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
} = {}) {
  const startedAt = nowIso(clock);
  const stages = [];
  let guest = null;
  let guestStatus = 'blocked';
  let guestDetails = { reasonCode: 'disposable-guest-driver-pending' };
  const context = { product, timeoutMs };
  try {
    const guestStart = nowIso(clock);
    try {
      const created = await withRetry((attempt) => driver.createGuest?.({ product, attempt }), { attempts: retries, timeoutMs, label: `${product.appId} guest creation` });
      if (created?.status === 'verified' || created?.ok === true || created?.guest) {
        guest = created.guest ?? created;
        guestStatus = 'verified';
        guestDetails = { reasonCode: 'fresh-guest-created' };
      } else {
        guestStatus = created?.status === 'skipped' ? 'skipped' : 'blocked';
        guestDetails = safeDetails(created?.details ?? created);
      }
    } catch (error) {
      guestStatus = 'failed';
      guestDetails = { reasonCode: 'guest-creation-failed', message: error instanceof Error ? error.message : String(error) };
    }
    stages.push(phaseRecord('guest-creation', guestStatus, guestStart, clock, guestDetails));
    if (guestStatus !== 'verified') {
      for (const stage of LIFECYCLE_STAGES.slice(0, -1)) stages.push(phaseRecord(stage, guestStatus === 'failed' ? 'failed' : 'blocked', startedAt, clock, guestDetails));
    } else {
      context.guest = guest;
      for (const stage of LIFECYCLE_STAGES.slice(0, -1)) {
        const stageStart = nowIso(clock);
        const method = DRIVER_METHODS[stage];
        try {
          const result = await withRetry((attempt) => {
            if (typeof driver[method] !== 'function') return blocked('lifecycle-driver-method-pending');
            return driver[method]({ ...context, attempt });
          }, { attempts: retries, timeoutMs, label: `${product.appId} ${stage}` });
          const normalized = normalizeResult(result);
          stages.push(phaseRecord(stage, normalized.status, stageStart, clock, normalized.details));
        } catch (error) {
          stages.push(phaseRecord(stage, 'failed', stageStart, clock, { reasonCode: 'stage-failed', message: error instanceof Error ? error.message : String(error) }));
          for (const remainingStage of LIFECYCLE_STAGES.slice(stages.filter((entry) => entry.name !== 'guest-creation').length, -1)) {
            stages.push(phaseRecord(remainingStage, 'blocked', stageStart, clock, { reasonCode: 'prior-stage-failed' }));
          }
          break;
        }
      }
    }
  } finally {
    const disposalStart = nowIso(clock);
    let disposal = blocked('guest-not-created');
    if (guest) {
      try {
        const result = await withRetry((attempt) => {
          if (typeof driver.disposeGuest !== 'function') return blocked('lifecycle-driver-method-pending');
          return driver.disposeGuest({ product, guest, attempt });
        }, { attempts: retries, timeoutMs, label: `${product.appId} guest disposal` });
        disposal = normalizeResult(result);
      } catch (error) {
        disposal = { status: 'failed', details: { reasonCode: 'guest-disposal-failed', message: error instanceof Error ? error.message : String(error) } };
      }
    }
    stages.push(phaseRecord('guest-disposal', disposal.status, disposalStart, clock, disposal.details));
  }
  const verdict = stages.length === 13 && stages.every((stage) => stage.status === 'verified');
  return {
    schemaVersion: LIFECYCLE_PROOF_SCHEMA,
    product: { appId: product.appId, displayName: product.displayName, adapterId: product.adapterId, installerFamily: product.installerFamily },
    source: product.source,
    guest: product.guest,
    startedAt,
    completedAt: nowIso(clock),
    retries: Math.min(Math.max(Number(retries) || 1, 1), 3),
    timeoutMs,
    sourceRuntimeInvoked: stages.some((stage) => stage.name.startsWith('source-') && stage.status === 'verified'),
    stages,
    verdict,
  };
}

export async function runLifecycleProof({
  matrix = LIFECYCLE_PRODUCTS,
  driver = createUnavailableDriver(),
  appId = null,
  clock = Date.now,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
} = {}) {
  assertLifecycleMatrix(matrix);
  const selected = appId ? matrix.filter((entry) => entry.appId === appId) : matrix;
  if (appId && selected.length !== 1) throw new Error(`Lifecycle proof application ${appId} is not in the exact 13-product matrix.`);
  const receipts = [];
  for (const product of selected) receipts.push(await runProductLifecycle(product, driver, { clock, timeoutMs, retries }));
  return {
    schemaVersion: LIFECYCLE_PROOF_SCHEMA,
    matrixVersion: '13-products-v1',
    startedAt: receipts[0]?.startedAt ?? nowIso(clock),
    completedAt: nowIso(clock),
    productCount: receipts.length,
    expectedProductCount: 13,
    receipts,
    verdict: receipts.length === 13 && receipts.every((receipt) => receipt.verdict === true),
    dependencyPoints: [...new Set(receipts.flatMap((receipt) => receipt.stages.filter((stage) => stage.status === 'blocked').map((stage) => `${receipt.product.appId}:${stage.name}`)))],
  };
}

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const output = path.resolve(option('--output', 'lifecycle-proof.v2.json'));
  const appId = option('--app-id');
  const modulePath = option('--driver-module');
  const timeoutMs = Math.min(Math.max(Number(option('--timeout-ms', DEFAULT_TIMEOUT_MS)) || DEFAULT_TIMEOUT_MS, 1000), 30 * 60_000);
  const retries = Math.min(Math.max(Number(option('--retries', DEFAULT_RETRIES)) || DEFAULT_RETRIES, 1), 3);
  try {
    const receipt = await runLifecycleProof({ appId, driver: await loadDriver(modulePath), timeoutMs, retries });
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    process.stdout.write(`[lifecycle-proof] wrote ${receipt.productCount} receipt(s); verdict=${receipt.verdict}\n`);
    process.exitCode = receipt.verdict ? 0 : 1;
  } catch (error) {
    process.stderr.write(`[lifecycle-proof] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
