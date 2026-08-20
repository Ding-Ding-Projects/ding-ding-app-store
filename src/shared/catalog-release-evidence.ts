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

const UNGATED_RELEASE_TESTS = Object.freeze({
  status: 'unknown' as const,
  summary: 'The release workflow built, packaged, and published the reviewed Windows artifacts without running tests, lint, type checks, static analysis, accessibility checks, or screenshot gates.',
  disclosure: 'Release publication is not a test verdict. Clean-machine installation, application launch, and uninstall remain blocked until their separate disposable-guest proof succeeds.',
} as const);

export const MATERIAL_OLLAMA_RELEASE_EVIDENCE = Object.freeze({
  appId: 'material-ollama',
  repository: 'material-ollama',
  tag: 'v0.0.0-build.18',
  targetCommit: '3b33fc66c42c82b3d9fe0bfb012f85e68fc6ea6f',
  sourceManifest: 'CMakeLists.txt',
  sourceEvidence: Object.freeze([
    'app/ollama.iss',
    'scripts/build_windows.ps1',
    '.github/workflows/release.yaml',
  ] as const),
  workflow: Object.freeze({
    started: '2026-08-19T10:25:33.000Z',
    completed: '2026-08-19T10:49:24.453Z',
    duration: '00:23:51',
  } as const),
  assets: Object.freeze([
    Object.freeze({ name: 'OllamaSetup.exe', bytes: 41883579, sha256: 'fe807823c152c0ca5f67145ada389a583bd1538e4dbe01bb8e70b668f11a09fc', role: 'installer' as const }),
  ] as const),
  tests: UNGATED_RELEASE_TESTS,
} as const satisfies CatalogReleaseEvidence);

export const MATERIAL_SANDBOX_RELEASE_EVIDENCE = Object.freeze({
  appId: 'material-sandbox',
  repository: 'material-sandbox',
  tag: 'v0.0.0-build.35',
  targetCommit: '00e262034853c4fd06a3157deca163880fa8b584',
  sourceManifest: 'Installer/Sandboxie-Plus.iss',
  sourceEvidence: Object.freeze([
    'build.bat',
    'build-installer.bat',
    '.github/workflows/release.yml',
  ] as const),
  workflow: Object.freeze({
    started: '2026-08-19T10:29:44Z',
    completed: '2026-08-19T11:20:40Z',
    duration: '00:50:56',
  } as const),
  assets: Object.freeze([
    Object.freeze({ name: 'Sandboxie-Plus-x64-v1.18.2.exe', bytes: 25022623, sha256: 'dcace3572fe3476d60b9425071401e8dfb49c7afd7355d3778b9da04ed601496', role: 'installer' as const }),
  ] as const),
  tests: UNGATED_RELEASE_TESTS,
} as const satisfies CatalogReleaseEvidence);

export const MATERIAL_TOOLS_RELEASE_EVIDENCE = Object.freeze({
  appId: 'material-tools',
  repository: 'material-tools',
  tag: 'build-0.1.0.19',
  targetCommit: '9c407a81e9e4e30dc922cf955e83232dd5aeb754',
  sourceManifest: 'package.json',
  sourceEvidence: Object.freeze([
    'build.bat',
    'build-installer.bat',
    '.github/workflows/release.yml',
  ] as const),
  workflow: Object.freeze({
    started: '2026-08-12T01:48:47Z',
    completed: '2026-08-12T01:51:29Z',
    duration: '00:02:42',
  } as const),
  assets: Object.freeze([
    Object.freeze({ name: 'MaterialTools-Setup-0.1.0-x64.exe', bytes: 143731712, sha256: '6395210d754ee67025f77031a2f116da4a493522a48f79ab6efd17435515478b', role: 'installer' as const }),
    Object.freeze({ name: 'RELEASES', bytes: 85, sha256: 'ba908df5fbd56508ec8c667b2e0ee90874887bfebe6470d7bf0f10819cfe50af', role: 'update-index' as const }),
    Object.freeze({ name: 'material-tools-0.1.0-full.nupkg', bytes: 143036421, sha256: '30b03085bb2544f23c299663542efe2a98e37ec5195e1757ce0c3acd05a51f03', role: 'package' as const }),
  ] as const),
  tests: UNGATED_RELEASE_TESTS,
} as const satisfies CatalogReleaseEvidence);
