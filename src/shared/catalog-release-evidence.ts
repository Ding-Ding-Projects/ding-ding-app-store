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
