/**
 * The lifecycle proof matrix is deliberately independent from the catalog and
 * adapter registries.  It is a review-owned list of the products that this
 * disposable proof lane is allowed to exercise.  Adapter/source-runner work
 * can import this contract without making the proof silently grow with the
 * catalog.
 */

export const LIFECYCLE_PROOF_SCHEMA = 'ding-ding-app-store.lifecycle-proof.v2';

export const LIFECYCLE_STAGES = Object.freeze([
  'source-archive',
  'source-digest',
  'source-build',
  'source-output',
  'source-run-readiness',
  'release-install',
  'exact-ownership-rediscovery',
  'installed-process-readiness',
  'installed-window-readiness',
  'exact-uninstall',
  'absence',
  'guest-disposal',
]);

export const LIFECYCLE_RECEIPT_STAGES = Object.freeze([
  'guest-creation',
  ...LIFECYCLE_STAGES,
]);

export const LIFECYCLE_STAGE_STATUSES = Object.freeze([
  'verified',
  'failed',
  'blocked',
  'skipped',
]);

const product = (appId, displayName, adapterId, installerFamily, sourceManifest, revision, archiveSha256, recipeStatus, proofTargetId) => Object.freeze({
  appId,
  displayName,
  adapterId,
  installerFamily,
  proofStatus: 'blocked-until-proof',
  proofTargetId,
  recipeStatus,
  source: Object.freeze({ manifest: sourceManifest, refKind: 'commit', pinned: true, revision, archiveSha256 }),
  guest: Object.freeze({ isolation: 'fresh-per-recipe', hostMounts: false, secrets: false }),
});

/** Exactly thirteen rows. Keep this list hand-written and review-owned. */
export const LIFECYCLE_PRODUCTS = Object.freeze([
  product('farming-game', 'Sprout Hollow', 'farming-game-squirrel', 'squirrel', 'package.json', 'b05fcf6335d2d06d8050d1c9cdf29d54077e367c', '09e0223bae80af785d830566c6b1f5524fa8c999a6e8444e08bc4f77c908d653', 'ready', 'farming-game-clean-windows'),
  product('material-cookie-clicker', 'Material Cookie Clicker', 'material-cookie-clicker-squirrel', 'squirrel', 'package.json', 'fca96e530628061f7ca536ab36381140fa6b5cf6', 'ea884690508b271d7508f88b020eac016129ed01cf421759d121d0b9ce3d05d8', 'ready', 'material-cookie-clicker-clean-windows'),
  product('material-encryption', 'Material Encryption', 'material-encryption-squirrel', 'squirrel', 'package.json', '99f4ce2676cd274db53af60153ea561451c1f0f0', 'a394ff4c966cb67404139d4a4b1dd1619368ee0103228e8ee745feea076aa951', 'blocked', 'material-encryption-clean-windows'),
  product('material-ollama', 'Material Ollama', 'material-ollama-inno', 'inno', 'CMakeLists.txt', '3b33fc66c42c82b3d9fe0bfb012f85e68fc6ea6f', '403e3831304aa54a02b2bf0bbb828f1a374d1458cb9013bd3b0124661e6d6288', 'blocked', 'material-ollama-clean-windows'),
  product('material-sandbox', 'Material Sandbox', 'material-sandbox-inno', 'inno', 'Installer/Sandboxie-Plus.iss', '00e262034853c4fd06a3157deca163880fa8b584', 'af4921ba4e7157a23b98bca37adfd6930ab2e264697a8a2b217e214f67b9c48e', 'blocked', 'material-sandbox-clean-windows'),
  product('material-tools', 'Material Tools', 'material-tools-squirrel', 'squirrel', 'package.json', '9c407a81e9e4e30dc922cf955e83232dd5aeb754', 'e4fee7f4d5964671c7695e85a507e930848a48ddf99015b7279e69a20a0ee40e', 'ready', 'material-tools-clean-windows'),
  product('material-virtualbox', 'Material VirtualBox', 'material-virtualbox-nsis', 'nsis', 'configure.ac', 'e1ed3933ae1deb51a3a0ef1dac13c0ccd8199765', '14040d8574664a90cdbe3a0c5fabdeb3318859021db29f241f6dd10cecb78fdb', 'blocked', 'material-virtualbox-clean-windows'),
  product('material-winforge', 'Material WinForge', 'material-winforge-squirrel', 'squirrel', 'main-app-design/package.json', 'e7f9f35c011790d2afafa728767cd61f4672fe5f', 'c49008d5dd5d61bfc3bc6c0ede0d9108c85f667bd5c1bf7253b4fc2ed9196d02', 'ready', 'material-winforge-clean-windows'),
  product('material-winutil', 'Material System Utility', 'material-winutil-squirrel', 'squirrel', 'package.json', '864b65d7e439bd8768faaab69e9ebd5770916e86', '467bffcf0da2e2c34ea858f5aea76ca839a3f53dc0101ca2e0838d7a90beb3f7', 'ready', 'material-winutil-clean-windows'),
  product('meadowmark', 'Meadowmark', 'meadowmark-squirrel', 'squirrel', 'electron-builder.yml', 'a296fe73ca28b87942f01463893fcfbe4c98b593', '7312c8333b8b0c874817a3442f3e273be037eac0703632266980603aabb50f10', 'ready', 'meadowmark-clean-windows'),
  product('minecraft-server-command-center', 'Minecraft Server Command Center', 'minecraft-server-command-center-squirrel', 'squirrel', 'electron-builder.yml', '1bf81cfe0f7cd8d6ce9262e14140cded75d142b5', '27d9b6bb68fe6125868638d965281841792412a9412c8d68a0252b96ff33cb57', 'ready', 'minecraft-server-command-center-clean-windows'),
  product('minecraft-server-studio', 'Minecraft Server Studio', 'minecraft-server-studio-squirrel', 'squirrel', 'package.json', 'e29406d3094eb2d5d077351ba33110a16ccf967e', 'acd5fb00e917c5dfb0d6a58a4d05d5b52a6391a0be7a7ea0fe044ce2c199e2c3', 'ready', 'minecraft-server-studio-clean-windows'),
  product('sprout-hollow-valley', 'Sprout Hollow Valley', 'sprout-hollow-valley-squirrel', 'squirrel', 'package.json', 'da7236ba45af102447e650889374a1be9df9ff6e', '64460f406d7c7ea91fe356c34934f28863c068c561c7c599056999f825a8284a', 'ready', 'sprout-hollow-valley-clean-windows'),
]);

const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,127}$/;

export const LIFECYCLE_PRODUCT_IDS = Object.freeze(LIFECYCLE_PRODUCTS.map(({ appId }) => appId));

export function lifecycleProductFor(appId) {
  return LIFECYCLE_PRODUCTS.find((entry) => entry.appId === appId) ?? null;
}

export function assertLifecycleMatrix(matrix = LIFECYCLE_PRODUCTS) {
  if (!Array.isArray(matrix) || matrix.length !== 13) throw new Error('Lifecycle proof matrix must contain exactly 13 products.');
  const ids = matrix.map((entry) => entry?.appId);
  if (ids.some((id) => typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,127}$/.test(id))) {
    throw new Error('Lifecycle proof matrix contains an invalid application identifier.');
  }
  if (new Set(ids).size !== ids.length) throw new Error('Lifecycle proof matrix contains duplicate application identifiers.');
  for (const entry of matrix) {
    if (entry.source?.pinned !== true || !/^[a-f0-9]{40}$/.test(entry.source?.revision ?? '') || !/^[a-f0-9]{64}$/.test(entry.source?.archiveSha256 ?? '') || entry.guest?.isolation !== 'fresh-per-recipe' || entry.guest.hostMounts !== false || entry.guest.secrets !== false || entry.proofStatus !== 'blocked-until-proof' || !SAFE_ID.test(entry.proofTargetId ?? '') || !['ready', 'blocked'].includes(entry.recipeStatus)) {
      throw new Error(`Lifecycle proof matrix row ${entry.appId} is not pinned to a fresh, secret-free guest.`);
    }
  }
  return matrix;
}

export function assertLifecycleReceipt(receipt, matrix = LIFECYCLE_PRODUCTS) {
  assertLifecycleMatrix(matrix);
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) throw new Error('Lifecycle receipt must be an object.');
  if (receipt.schemaVersion !== LIFECYCLE_PROOF_SCHEMA) throw new Error('Lifecycle receipt schema version is not lifecycle-proof.v2.');
  const appId = receipt.product?.appId;
  const matrixRow = matrix.find((entry) => entry.appId === appId);
  if (!matrixRow) throw new Error(`Lifecycle receipt has an unknown application identifier: ${appId ?? 'missing'}.`);
  if (receipt.product.displayName !== lifecycleProductFor(appId)?.displayName || receipt.product.proofStatus !== matrixRow.proofStatus || receipt.product.proofTargetId !== matrixRow.proofTargetId || receipt.product.recipeStatus !== matrixRow.recipeStatus) throw new Error(`Lifecycle receipt metadata does not match matrix row ${appId}.`);
  if (!Array.isArray(receipt.stages) || receipt.stages.length !== LIFECYCLE_RECEIPT_STAGES.length) throw new Error(`Lifecycle receipt ${appId} must contain exactly ${LIFECYCLE_RECEIPT_STAGES.length} stages.`);
  const names = receipt.stages.map((stage) => stage?.name);
  if (names.some((name) => typeof name !== 'string') || new Set(names).size !== names.length || names.some((name, index) => name !== LIFECYCLE_RECEIPT_STAGES[index])) {
    throw new Error(`Lifecycle receipt ${appId} stages do not match the exact ordered lifecycle contract.`);
  }
  if (receipt.stages.some((stage) => !LIFECYCLE_STAGE_STATUSES.includes(stage.status))) throw new Error(`Lifecycle receipt ${appId} contains an invalid stage status.`);
  if (typeof receipt.verdict !== 'boolean') throw new Error(`Lifecycle receipt ${appId} must carry a boolean verdict.`);
  const expectedVerdict = receipt.stages.every((stage) => stage.status === 'verified');
  if (receipt.verdict !== expectedVerdict) throw new Error(`Lifecycle receipt ${appId} verdict disagrees with its stage statuses.`);
  if (typeof receipt.sourceRuntimeInvoked !== 'boolean') throw new Error(`Lifecycle receipt ${appId} must record sourceRuntimeInvoked.`);
  return receipt;
}

assertLifecycleMatrix();
