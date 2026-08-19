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

const product = (appId, displayName, adapterId, installerFamily, sourceManifest) => Object.freeze({
  appId,
  displayName,
  adapterId,
  installerFamily,
  source: Object.freeze({ manifest: sourceManifest, refKind: 'commit', pinned: true }),
  guest: Object.freeze({ isolation: 'fresh-per-product', hostMounts: false, secrets: false }),
});

/** Exactly thirteen rows. Keep this list hand-written and review-owned. */
export const LIFECYCLE_PRODUCTS = Object.freeze([
  product('lowlevel-computer-use-mcp', 'Lowlevel Computer Use MCP', 'lowlevel-computer-use-mcp-squirrel', 'squirrel', 'pyproject.toml'),
  product('material-download-manager', 'Material Download Manager', 'material-download-manager-squirrel', 'squirrel', 'design/package.json'),
  product('material-designer', 'Material Designer', 'material-designer-squirrel', 'squirrel', 'design/package.json'),
  product('material-bluemap', 'Material BlueMap', 'material-bluemap-squirrel', 'squirrel', 'design/package.json'),
  product('desktop-material', 'Desktop Material', 'desktop-material-squirrel', 'squirrel', 'app/package.json'),
  product('home-assistant-ac-defender', 'Home Assistant AC Defender', 'home-assistant-ac-defender-squirrel', 'squirrel', 'desktop-electron/package.json'),
  product('material-email', 'Material Email', 'material-email-nsis', 'nsis', 'package.json'),
  product('opencodex', 'OpenCodex', 'opencodex-squirrel', 'squirrel', 'electron-builder.yml'),
  product('qbittorrent-material', 'qBittorrent Material', 'qbittorrent-material-squirrel', 'squirrel', 'package.json'),
  product('material-winscp', 'WinSCP Material', 'material-winscp-squirrel', 'squirrel', 'forge.config.js'),
  product('dim-sum-atlas', 'Dim Sum Atlas', 'dim-sum-atlas-portable-zip', 'portable-zip', 'package.json'),
  product('material-office', 'Material Office', 'material-office-nsis', 'nsis', 'package.json'),
  product('minecraft-world-downloader', 'Minecraft World Downloader', 'minecraft-world-downloader-nsis', 'nsis', 'installer/installer.nsi'),
]);

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
    if (entry.source?.pinned !== true || entry.guest?.isolation !== 'fresh-per-product' || entry.guest.hostMounts !== false || entry.guest.secrets !== false) {
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
  if (!matrix.some((entry) => entry.appId === appId)) throw new Error(`Lifecycle receipt has an unknown application identifier: ${appId ?? 'missing'}.`);
  if (receipt.product.displayName !== lifecycleProductFor(appId)?.displayName) throw new Error(`Lifecycle receipt display name does not match matrix row ${appId}.`);
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
