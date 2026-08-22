import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(root, 'tools', 'design-reference', 'scenes.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const expectedIds = [
  'catalog', 'installed', 'updates', 'authenticator', 'docs-article', 'activity',
  'settings-general', 'settings-appearance', 'settings-schedule', 'settings-about', 'settings-support',
  'command-palette', 'regex-builder', 'tab-management', 'tab-context-menu', 'notification-center',
  'anchored-appearance-panel', 'action-progress-dialog', 'destructive-super-confirm', 'source-terminal',
  'changelog', 'dim-sum-surprise', 'catalog-dark', 'catalog-compact', 'catalog-narrow',
  'catalog-english', 'catalog-cantonese',
];
const allowedPages = new Set(['catalog', 'installed', 'updates', 'authenticator', 'docs', 'activity', 'settings']);
const allowedSettings = new Set(['general', 'appearance', 'schedule', 'about', 'support']);
const allowedOverlays = new Set(['command-palette', 'regex-builder', 'tab-management', 'context-menu', 'notification-center', 'appearance-panel', 'action-progress', 'destructive-super-confirm', 'source-terminal', 'changelog', 'dim-sum-surprise']);
const allowedActions = new Set(['click', 'contextmenu', 'select', 'launch']);

function fail(message) { throw new Error(`Design parity plan violation: ${message}`); }

export function validateRegistry(candidate = registry) {
  if (candidate.schemaVersion !== 1) fail('schemaVersion must be 1.');
  if (!/^[a-f0-9]{40}$/.test(candidate.referenceSourceCommit)) fail('referenceSourceCommit must be exact.');
  if (!Array.isArray(candidate.scenes)) fail('scenes must be an array.');
  const ids = candidate.scenes.map((scene) => scene.id);
  if (ids.length !== expectedIds.length || [...ids].sort().some((id, index) => id !== [...expectedIds].sort()[index])) fail(`scene membership must exactly equal ${expectedIds.length} hand-written identifiers.`);
  if (new Set(ids).size !== ids.length) fail('scene identifiers must be unique.');
  for (const scene of candidate.scenes) {
    if (!/^[a-z][a-z0-9-]*$/.test(scene.id)) fail('scene id is invalid.');
    if (!['base', 'overlay', 'variant'].includes(scene.kind)) fail(`${scene.id} kind is invalid.`);
    if (!allowedPages.has(scene.page)) fail(`${scene.id} page is invalid.`);
    if (scene.settings && (!allowedSettings.has(scene.settings) || scene.page !== 'settings')) fail(`${scene.id} settings route is invalid.`);
    if (scene.overlay && !allowedOverlays.has(scene.overlay)) fail(`${scene.id} overlay alias is invalid.`);
    if (!['light', 'dark'].includes(scene.theme) || !['en', 'yue', 'bilingual'].includes(scene.locale)) fail(`${scene.id} theme or locale is invalid.`);
    if (!Array.isArray(scene.viewport) || scene.viewport.length !== 2 || !scene.viewport.every(Number.isInteger) || scene.viewport[0] < 320 || scene.viewport[1] < 240 || scene.scale !== 1) fail(`${scene.id} capture tuple is invalid.`);
    if (!Array.isArray(scene.builtActions) || scene.builtActions.length === 0 || scene.builtActions.some((step) => !allowedActions.has(step.action) || typeof step.selector !== 'string' || step.selector.length === 0)) fail(`${scene.id} packaged-runtime plan is invalid.`);
    if (typeof scene.readySelector !== 'string' || scene.readySelector.length === 0) fail(`${scene.id} ready selector is missing.`);
  }
  const requirements = [
    ['dark', (scene) => scene.theme === 'dark'], ['compact', (scene) => scene.id.endsWith('-compact')], ['narrow', (scene) => scene.viewport[0] === 360],
    ['English', (scene) => scene.locale === 'en'], ['Cantonese', (scene) => scene.locale === 'yue'],
    ['tab management', (scene) => scene.overlay === 'tab-management'], ['tab context menu', (scene) => scene.overlay === 'context-menu'],
  ];
  for (const [name, predicate] of requirements) if (!candidate.scenes.some(predicate)) fail(`${name} coverage is missing.`);
  return { total: ids.length, ids };
}

function queryFor(scene) {
  const query = new URLSearchParams({ page: scene.page, lang: scene.locale, theme: scene.theme, mode: 'reference', row: scene.id });
  if (scene.settings) query.set('settings', scene.settings);
  if (scene.overlay) query.set('overlay', scene.overlay);
  return `design/reference.html?${query.toString()}`;
}

export function planFor(scene) {
  const directory = `.codex/verification/design-parity/${scene.id}`;
  return {
    schemaVersion: 1,
    scene: scene.id,
    referenceRoute: queryFor(scene),
    builtRoute: `npm run design:plan -- --scene=${scene.id}`,
    tuple: { screen: scene.page, state: scene.state, theme: scene.theme, locale: scene.locale, viewport: { width: scene.viewport[0], height: scene.viewport[1] }, scale: scene.scale },
    capturePolicy: registry.capturePolicy,
    builtActions: scene.builtActions,
    readySelector: scene.readySelector,
    evidence: {
      reference: `${directory}/reference.png`, built: `${directory}/built.png`, comparison: `${directory}/comparison.png`, diff: `${directory}/diff.png`, receipt: `${directory}/receipt.json`,
    },
  };
}

function selfTest() {
  validateRegistry(registry);
  const missing = structuredClone(registry); missing.scenes.pop();
  const badTuple = structuredClone(registry); badTuple.scenes[0].viewport = [100, 100];
  const badAlias = structuredClone(registry); badAlias.scenes.find((scene) => scene.id === 'tab-context-menu').overlay = 'tabs-context';
  for (const [name, candidate] of [['missing-scene', missing], ['bad-tuple', badTuple], ['bad-alias', badAlias]]) {
    try { validateRegistry(candidate); fail(`negative probe ${name} stayed green.`); }
    catch (error) {
      if (!String(error.message).startsWith('Design parity plan violation:')) throw error;
      process.stdout.write(`RED_PROBE=${name}\n`);
    }
  }
  validateRegistry(registry);
  process.stdout.write(`GREEN_RESTORE=${registry.scenes.length}\n`);
}

validateRegistry(registry);
const args = new Map(process.argv.slice(2).map((arg) => { const [key, ...parts] = arg.replace(/^--/, '').split('='); return [key, parts.join('=') || true]; }));
if (args.has('self-test')) selfTest();
else {
  const sceneId = args.get('scene') === true ? null : args.get('scene') ?? 'catalog';
  const scene = registry.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) fail(`unknown scene ${sceneId}.`);
  process.stdout.write(`${JSON.stringify(planFor(scene), null, 2)}\n`);
}
