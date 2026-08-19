import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { assertLifecycleMatrix, LIFECYCLE_PRODUCTS } from './lifecycle-proof-matrix.mjs';

export const SOURCE_LIFECYCLE_SCHEMA = 'ding-ding-app-store.source-lifecycle-proof.v1';
export const SOURCE_LIFECYCLE_STAGES = Object.freeze([
  'build-from-source',
  'run-from-source',
  'install',
  'launch',
  'uninstall',
  'disposal',
]);
export const SOURCE_RECIPE_COUNT = 13;
const STAGE_METHODS = Object.freeze({
  'build-from-source': 'buildFromSource',
  'run-from-source': 'runFromSource',
  install: 'install',
  launch: 'launch',
  uninstall: 'uninstall',
  disposal: 'disposeGuest',
});
const STATUS_VALUES = Object.freeze(['verified', 'failed', 'blocked', 'skipped']);
const SAFE_DIGEST = /^[a-f0-9]{64}$/i;
const SAFE_REVISION = /^[a-f0-9]{40}$/i;
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,127}$/;
const SECRET_KEY = /(?:token|secret|password|credential|private.?key|command|args?|url|uri|path|environment|env)/i;

function nowIso(clock) { return new Date(clock()).toISOString(); }

export function redact(value, key = '') {
  if (SECRET_KEY.test(key)) return '[REDACTED]';
  if (typeof value === 'string') {
    if (/^(?:https?:|file:|[A-Za-z]:\\|\\\\)/i.test(value)) return '[REDACTED]';
    return value.length > 512 ? `${value.slice(0, 512)}…` : value;
  }
  if (Array.isArray(value)) return value.slice(0, 64).map((item) => redact(item, key));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 64).map(([entryKey, entryValue]) => [entryKey, redact(entryValue, entryKey)]));
  return value;
}

function safeDetails(value) {
  const details = redact(value);
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {};
  const allowed = ['reasonCode', 'message', 'revision', 'digest', 'bytes', 'outputCount', 'processReady', 'windowReady', 'absenceVerified', 'ownershipMatch', 'disposed', 'sourceRuntimeInvoked'];
  return Object.fromEntries(allowed.filter((key) => Object.hasOwn(details, key)).map((key) => [key, details[key]]));
}

function fail(message) { throw new Error(`Source lifecycle recipe catalog invalid: ${message}`); }

export function assertSourceRecipeCatalog(catalog) {
  if (!catalog || typeof catalog !== 'object' || catalog.schemaVersion !== 1 || !Array.isArray(catalog.recipes)) fail('schemaVersion 1 and a recipes array are required.');
  if (catalog.recipes.length !== SOURCE_RECIPE_COUNT) fail(`exactly ${SOURCE_RECIPE_COUNT} recipes are required.`);
  const ids = catalog.recipes.map((recipe) => recipe?.appId);
  if (ids.some((id) => typeof id !== 'string' || !SAFE_ID.test(id))) fail('recipe IDs must be bounded lowercase identifiers.');
  if (new Set(ids).size !== ids.length) fail('recipe IDs must be unique.');
  for (const recipe of catalog.recipes) {
    if (typeof recipe.repository !== 'string' || !/^Ding-Ding-Projects\/[A-Za-z0-9_.-]+$/.test(recipe.repository)) fail(`${recipe.appId} has no reviewed public repository.`);
    if (!SAFE_REVISION.test(recipe.revision) || !SAFE_DIGEST.test(recipe.sourceArchiveSha256)) fail(`${recipe.appId} has an invalid pinned revision or archive digest.`);
    if (!['ready', 'blocked'].includes(recipe.status)) fail(`${recipe.appId} has an invalid status.`);
    const steps = [...(recipe.prepare ?? []), ...(recipe.validate ?? []), ...(recipe.build ?? []), ...(recipe.test ?? []), ...(recipe.run ?? [])];
    if (recipe.status === 'blocked') {
      if (!recipe.blocker || steps.length !== 0) fail(`${recipe.appId} is blocked but does not carry only an explicit blocker.`);
    } else if (recipe.validate?.length < 1 || recipe.build?.length < 1 || recipe.dependencies?.length < 1) {
      fail(`${recipe.appId} is ready without a validation step, build step, and dependency inventory.`);
    }
  }
  assertLifecycleMatrix();
  const matrixIds = LIFECYCLE_PRODUCTS.map((entry) => entry.appId);
  if (ids.length !== matrixIds.length || ids.some((id) => !matrixIds.includes(id))) fail('recipe IDs must remain exactly set-equal with the hand-written lifecycle matrix.');
  for (const row of LIFECYCLE_PRODUCTS) {
    const recipe = catalog.recipes.find((entry) => entry.appId === row.appId);
    if (!recipe || recipe.revision !== row.source.revision || recipe.sourceArchiveSha256 !== row.source.archiveSha256 || recipe.status !== row.recipeStatus) fail(`${row.appId} recipe metadata drifted from the hand-written lifecycle matrix.`);
  }
  return catalog;
}

export async function loadSourceRecipeCatalog(recipeFile = path.resolve('data/source-recipes.v1.json')) {
  return assertSourceRecipeCatalog(JSON.parse(await readFile(recipeFile, 'utf8')));
}

function blocked(reasonCode, message) { return { status: 'blocked', details: { reasonCode, message } }; }

export function createUnavailableDriver(reasonCode = 'guest-transport-not-connected') {
  return Object.freeze({ proofBoundary: 'unavailable', async createGuest() { return blocked(reasonCode); } });
}

async function loadDriver(modulePath) {
  if (!modulePath) return createUnavailableDriver();
  const loaded = await import(pathToFileURL(path.resolve(modulePath)).href);
  const driver = loaded.default ?? loaded.sourceLifecycleDriver ?? loaded;
  if (!driver || typeof driver !== 'object') throw new Error('Source lifecycle driver did not export an object.');
  if (driver.proofBoundary !== 'windows-sandbox-attested') return createUnavailableDriver('driver-boundary-unverified');
  return driver;
}

function normalize(result) {
  if (result === true || result?.ok === true || result?.status === 'verified') return { status: 'verified', details: safeDetails(result?.details ?? {}) };
  if (result?.status === 'blocked') return { status: 'blocked', details: safeDetails(result.details ?? result) };
  if (result?.status === 'skipped') return { status: 'skipped', details: safeDetails(result.details ?? result) };
  if (result?.status === 'failed') return { status: 'failed', details: safeDetails(result.details ?? result) };
  return { status: 'failed', details: { reasonCode: 'driver-returned-no-result' } };
}

async function bounded(work, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} exceeded its ${timeoutMs}ms bound.`)), timeoutMs); });
  try { return await Promise.race([Promise.resolve().then(work), timeout]); }
  finally { clearTimeout(timer); }
}

function recipeDetails(recipe) {
  return {
    appId: recipe.appId,
    repository: recipe.repository,
    revision: recipe.revision,
    sourceArchiveSha256: recipe.sourceArchiveSha256,
    status: recipe.status,
    blocker: recipe.blocker ?? null,
    dependencyIds: (recipe.dependencies ?? []).map((dependency) => `${dependency.id}@${dependency.version}`),
  };
}

export function assertSourceLifecycleReceipt(receipt) {
  if (!receipt || receipt.schemaVersion !== SOURCE_LIFECYCLE_SCHEMA) fail('receipt schema is not source-lifecycle-proof.v1.');
  if (!SAFE_ID.test(receipt.recipe?.appId) || !Array.isArray(receipt.stages) || receipt.stages.length !== SOURCE_LIFECYCLE_STAGES.length) fail(`receipt ${receipt.recipe?.appId ?? 'unknown'} has the wrong stage count.`);
  if (receipt.stages.some((stage, index) => stage.name !== SOURCE_LIFECYCLE_STAGES[index] || !STATUS_VALUES.includes(stage.status))) fail(`receipt ${receipt.recipe.appId} has an invalid ordered stage set.`);
  const expected = receipt.stages.every((stage) => stage.status === 'verified');
  if (receipt.verdict !== expected) fail(`receipt ${receipt.recipe.appId} verdict disagrees with stage statuses.`);
  if (typeof receipt.sourceRuntimeInvoked !== 'boolean') fail(`receipt ${receipt.recipe.appId} must record sourceRuntimeInvoked.`);
  return receipt;
}

export async function runSourceRecipeLifecycle(recipe, driver, { clock = Date.now, timeoutMs = 20 * 60_000 } = {}) {
  const startedAt = nowIso(clock);
  const stages = [];
  let guest = null;
  let guestStatus = 'blocked';
  let guestDetails = recipe.status === 'blocked' ? { reasonCode: 'recipe-blocked', message: recipe.blocker } : { reasonCode: 'guest-transport-not-connected', message: 'No attested Windows Sandbox driver was supplied; source execution was not attempted.' };
  if (recipe.status === 'ready') {
    try {
      const rawCreated = await bounded(() => driver.createGuest?.({ recipe }), timeoutMs, `${recipe.appId} guest creation`);
      const created = normalize(rawCreated);
      guestStatus = created.status;
      guestDetails = created.details;
      if (created.status === 'verified') guest = rawCreated?.guest ?? { id: `guest-${recipe.appId}` };
    } catch (error) {
      guestStatus = 'failed';
      guestDetails = { reasonCode: 'guest-creation-failed', message: error instanceof Error ? error.message : String(error) };
    }
  }
  for (const stageName of SOURCE_LIFECYCLE_STAGES.slice(0, -1)) {
    const stageStarted = nowIso(clock);
    if (!guest || guestStatus !== 'verified') {
      stages.push({ name: stageName, status: recipe.status === 'blocked' ? 'blocked' : guestStatus === 'failed' ? 'failed' : 'blocked', startedAt: stageStarted, completedAt: nowIso(clock), details: safeDetails(guestDetails) });
      continue;
    }
    try {
      const method = driver[STAGE_METHODS[stageName]];
      const result = ['install', 'launch', 'uninstall'].includes(stageName) && driver.guestLifecycleAgent !== true
        ? blocked('guest-lifecycle-agent-unavailable', 'The integrated protocol peer transfers source outputs but does not expose a guest-side install, launch, process/window, or uninstall agent. A wrapper window is not inner-app evidence, and host install paths are forbidden.')
        : typeof method === 'function' ? await bounded(() => method({ recipe, guest }), timeoutMs, `${recipe.appId} ${stageName}`) : blocked('driver-method-unavailable', `No attested driver method is registered for ${stageName}.`);
      const normalized = normalize(result);
      stages.push({ name: stageName, status: normalized.status, startedAt: stageStarted, completedAt: nowIso(clock), details: normalized.details });
    } catch (error) {
      stages.push({ name: stageName, status: 'failed', startedAt: stageStarted, completedAt: nowIso(clock), details: { reasonCode: 'stage-failed', message: error instanceof Error ? error.message : String(error) } });
    }
  }
  const disposalStarted = nowIso(clock);
  let disposal = blocked('guest-not-created');
  if (guest) {
    try { disposal = normalize(await bounded(() => driver.disposeGuest?.({ recipe, guest }), timeoutMs, `${recipe.appId} disposal`)); }
    catch (error) { disposal = { status: 'failed', details: { reasonCode: 'disposal-failed', message: error instanceof Error ? error.message : String(error) } }; }
  }
  stages.push({ name: 'disposal', status: disposal.status, startedAt: disposalStarted, completedAt: nowIso(clock), details: disposal.details });
  const receipt = {
    schemaVersion: SOURCE_LIFECYCLE_SCHEMA,
    recipe: recipeDetails(recipe),
    startedAt,
    completedAt: nowIso(clock),
    sourceRuntimeInvoked: stages.some((stage) => ['build-from-source', 'run-from-source'].includes(stage.name) && stage.status === 'verified'),
    stages,
    verdict: stages.every((stage) => stage.status === 'verified'),
  };
  return assertSourceLifecycleReceipt(receipt);
}

export async function runSourceLifecycleProof({ catalog = null, recipeFile = path.resolve('data/source-recipes.v1.json'), driver = createUnavailableDriver(), outputDir = path.resolve('lifecycle-proof-source'), appId = null, clock = Date.now, timeoutMs = 20 * 60_000 } = {}) {
  const loaded = catalog ?? await loadSourceRecipeCatalog(recipeFile);
  const selected = appId ? loaded.recipes.filter((recipe) => recipe.appId === appId) : loaded.recipes;
  if (appId && selected.length !== 1) throw new Error(`Source lifecycle application ${appId} is not one of the exact thirteen recipes.`);
  await mkdir(outputDir, { recursive: true });
  const receipts = [];
  for (const recipe of selected) {
    const receipt = await runSourceRecipeLifecycle(recipe, driver, { clock, timeoutMs });
    receipts.push(receipt);
    await writeFile(path.join(outputDir, `${recipe.appId}.json`), `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  }
  const aggregate = {
    schemaVersion: SOURCE_LIFECYCLE_SCHEMA,
    matrixVersion: '13-source-recipes-v1',
    productCount: receipts.length,
    expectedProductCount: SOURCE_RECIPE_COUNT,
    receipts,
    verdict: receipts.length === SOURCE_RECIPE_COUNT && receipts.every((receipt) => receipt.verdict === true),
    blockedRecipes: receipts.filter((receipt) => !receipt.verdict).map((receipt) => ({ appId: receipt.recipe.appId, statuses: receipt.stages.filter((stage) => stage.status !== 'verified').map((stage) => `${stage.name}:${stage.details.reasonCode ?? 'unverified'}`) })),
  };
  await writeFile(path.join(outputDir, 'source-lifecycle-proof.v1.json'), `${JSON.stringify(aggregate, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return aggregate;
}

function option(name, fallback = null) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] ?? fallback : fallback; }

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const aggregate = await runSourceLifecycleProof({ recipeFile: path.resolve(option('--recipe-file', 'data/source-recipes.v1.json')), outputDir: path.resolve(option('--output-dir', 'lifecycle-proof-source')), appId: option('--app-id'), driver: await loadDriver(option('--driver-module')), timeoutMs: Math.min(Math.max(Number(option('--timeout-ms', 20 * 60_000)) || 20 * 60_000, 1_000), 30 * 60_000) });
    process.stdout.write(`[source-lifecycle-proof] wrote ${aggregate.productCount} receipt(s); verdict=${aggregate.verdict}\n`);
    process.exitCode = aggregate.verdict ? 0 : 1;
  } catch (error) {
    process.stderr.write(`[source-lifecycle-proof] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
