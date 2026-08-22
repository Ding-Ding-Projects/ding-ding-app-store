import type { CatalogReleaseEvidence } from './contracts.js';

/**
 * Immutable evidence captured from the reviewed public release used by the
 * Amulet Map Editor catalog adapter.  This is metadata for validation and
 * documentation only; it is not a renderer-controlled download manifest.
 */
const AMULET_SOURCE_EVIDENCE = Object.freeze([
  'pyproject.toml',
  '.github/workflows/build-windows.yml',
  'installer/build-squirrel.ps1',
  'installer/PACKAGING.md',
] as const);

const AMULET_WORKFLOW = Object.freeze({
  started: '2026-08-11T05:59:50Z',
  completed: '2026-08-11T06:08:38Z',
  duration: '00:08:48',
} as const);

const AMULET_ASSETS = Object.freeze([
  Object.freeze({ name: 'Setup.exe', bytes: 70412800, sha256: 'bfd30c6ad64cd4c8f6efbd03ffac44e032b334d163074bd089cf52bc0fe6fce1', role: 'installer' as const }),
  Object.freeze({ name: 'RELEASES', bytes: 79, sha256: '039bcef7f8f87f5ea0a4ae010022231bdf389bb94d58dc9070320c9aaf0166c7', role: 'update-index' as const }),
  Object.freeze({ name: 'Amulet-0.10.100567-full.nupkg', bytes: 70259367, sha256: '5b427ae6fe6285333ace91385199cb29a2bae51f0cb7579b7194dbced9c6c606', role: 'package' as const }),
] as const);

const AMULET_TESTS = Object.freeze({
  status: 'failed' as const,
  summary: '1256 passed, 8 skipped, 1 warning, 24 errors, 332 subtests passed in 221.33s',
  disclosure: 'This release shipped without a passing test suite; the catalog does not claim green tests, clean-machine installation, or packaged UI proof.',
} as const);

export const AMULET_RELEASE_EVIDENCE = Object.freeze({
  appId: 'material-minecraft-map-editor',
  repository: 'material-minecraft-map-editor',
  tag: '0.10.0-dev.567',
  targetCommit: '0173704db6bb37f8cdeae75b98bf2e6a25537e46',
  sourceManifest: 'pyproject.toml',
  sourceEvidence: AMULET_SOURCE_EVIDENCE,
  workflow: AMULET_WORKFLOW,
  assets: AMULET_ASSETS,
  tests: AMULET_TESTS,
} as const satisfies CatalogReleaseEvidence);

const KEEPASSXC_SOURCE_EVIDENCE = Object.freeze([
  'CMakeLists.txt',
  'vcpkg.json',
  '.github/workflows/material-release.yml',
  'share/windows/wix/KeePassXC.wxs',
] as const);

const KEEPASSXC_WORKFLOW = Object.freeze({
  started: '2026-08-17T03:22:02Z',
  completed: '2026-08-17T04:03:36Z',
  duration: '00:41:34',
} as const);

const KEEPASSXC_ASSETS = Object.freeze([
  Object.freeze({
    name: 'KeePassXC-2.8.0-snapshot-x64.msi',
    bytes: 73071506,
    sha256: 'bfa4d0a2eb7f2406a4dd894dd770974811e5e1d6f8e016768324c33e564e8ef5',
    role: 'installer' as const,
  }),
] as const);

const KEEPASSXC_TESTS = Object.freeze({
  status: 'passed' as const,
  summary: 'The complete Windows ctest suite passed in workflow run 31990921306 before CPack produced the MSI.',
  disclosure: 'The workflow verdict proves its own build and test run; clean-machine install, launch, exact MSI uninstall, and post-uninstall absence remain separate lifecycle evidence.',
} as const);

/** Immutable public release metadata for the reviewed unsigned KeePassXC MSI. */
export const KEEPASSXC_RELEASE_EVIDENCE = Object.freeze({
  appId: 'keepassxc',
  repository: 'keepassxc',
  tag: 'v0.0.45.1',
  targetCommit: '9f71044fdc38dd4efc360794fb2248707e94d530',
  sourceManifest: 'CMakeLists.txt',
  sourceEvidence: KEEPASSXC_SOURCE_EVIDENCE,
  workflow: KEEPASSXC_WORKFLOW,
  assets: KEEPASSXC_ASSETS,
  tests: KEEPASSXC_TESTS,
} as const satisfies CatalogReleaseEvidence);
