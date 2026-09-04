import type { CatalogReleaseEvidence } from './contracts.js';

/**
 * Immutable evidence captured from the reviewed public release used by the
 * Amulet Map Editor catalog adapter.  This is metadata for validation and
 * documentation only; it is not a renderer-controlled download manifest.
 */
const AMULET_SOURCE_EVIDENCE = Object.freeze([
  'pyproject.toml',
  'package.json',
  'electron/electron-builder.yml',
  '.github/workflows/build-electron-windows.yml',
] as const);

const AMULET_WORKFLOW = Object.freeze({
  started: '2026-08-13T16:51:21Z',
  completed: '2026-08-13T16:53:38Z',
  duration: '00:02:17',
} as const);

const AMULET_ASSETS = Object.freeze([
  Object.freeze({ name: 'Setup.exe', bytes: 128645120, sha256: '45a7e3ca3cca7b584b7aa4a0df77a6b68896090aced2a38773fc73ab7541c780', role: 'installer' as const }),
  Object.freeze({ name: 'RELEASES', bytes: 106, sha256: '084f33bd7bcb7b988e3a0d48395d2671d252214e16d93afa51df1d2d24451933', role: 'update-index' as const }),
  Object.freeze({ name: 'material-minecraft-map-editor-0.11.100025-full.nupkg', bytes: 127785869, sha256: 'a383ba08fb4f3786ed6231949176ecc02d93ef8dca6e44be61a75a151d976e4a', role: 'package' as const }),
] as const);

const AMULET_TESTS = Object.freeze({
  status: 'unknown' as const,
  summary: 'The release workflow built and published the unsigned Electron Squirrel package without running tests.',
  disclosure: 'This release carries no workflow test verdict; the catalog does not claim green tests, clean-machine installation, or packaged UI proof.',
} as const);

export const AMULET_RELEASE_EVIDENCE = Object.freeze({
  appId: 'material-minecraft-map-editor',
  repository: 'material-minecraft-map-editor',
  tag: '0.11.0-dev.25',
  targetCommit: '60eb2e3e0d07bb3aa0ec8e493b40790faa3522c4',
  sourceManifest: 'pyproject.toml',
  sourceEvidence: AMULET_SOURCE_EVIDENCE,
  workflow: AMULET_WORKFLOW,
  assets: AMULET_ASSETS,
  tests: AMULET_TESTS,
} as const satisfies CatalogReleaseEvidence);

const TAX_REPORTING_SOURCE_EVIDENCE = Object.freeze([
  'package.json',
  'build.bat',
  'build-installer.bat',
  'apps/desktop/electron-builder.yml',
  'scripts/release/invoke-build.ps1',
  '.github/workflows/release.yml',
] as const);

const TAX_REPORTING_WORKFLOW = Object.freeze({
  started: '2026-08-15T22:37:41Z',
  completed: '2026-08-15T22:43:26Z',
  duration: '00:05:45',
} as const);

const TAX_REPORTING_ASSETS = Object.freeze([
  Object.freeze({ name: 'MaterialTaxReporting-0.1.36001-Setup.exe', bytes: 205370880, sha256: '5d6a5a701a00696da8870d6127888bcc5231d8754a50f21fb1d03f2e51b56f5f', role: 'installer' as const }),
  Object.freeze({ name: 'RELEASES', bytes: 95, sha256: '9b5384ccba33e472373a185676fac89e7cde1146da22eb1db1f0d1382ce915e0', role: 'update-index' as const }),
  Object.freeze({ name: 'MaterialTaxReporting-0.1.36001-full.nupkg', bytes: 204607728, sha256: '6c7eacd7180877fc3436c6545e4d950890711f85710168d8114ab70b5f51f5e5', role: 'package' as const }),
] as const);

const TAX_REPORTING_TESTS = Object.freeze({
  status: 'unknown' as const,
  summary: 'The release workflow built and published the unsigned Squirrel package without running tests, lint, type checks, security scans, accessibility checks, or screenshots.',
  disclosure: 'The catalog records immutable packaging evidence only and does not reinterpret this release as a test or UI verdict.',
} as const);

export const TAX_REPORTING_RELEASE_EVIDENCE = Object.freeze({
  appId: 'material-tax-reporting',
  repository: 'material-tax-reporting',
  tag: 'v0.1.36001',
  targetCommit: '7f509f9713dec6e98abc43ac3ea3b1c13260e495',
  sourceManifest: 'package.json',
  sourceEvidence: TAX_REPORTING_SOURCE_EVIDENCE,
  workflow: TAX_REPORTING_WORKFLOW,
  assets: TAX_REPORTING_ASSETS,
  tests: TAX_REPORTING_TESTS,
} as const satisfies CatalogReleaseEvidence);
