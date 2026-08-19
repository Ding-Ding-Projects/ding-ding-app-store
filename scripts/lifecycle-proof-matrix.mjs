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

assertLifecycleMatrix();
