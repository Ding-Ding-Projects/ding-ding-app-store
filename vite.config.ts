import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { GENERATED_RELEASE_MANIFEST } from './src/renderer/generated-changelog.ts';

const packagedReleaseManifest = {
  name: 'packaged-release-manifest',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'release-changelog.json',
      source: `${JSON.stringify(GENERATED_RELEASE_MANIFEST, null, 2)}\n`,
    });
  },
};

export default defineConfig({
  root: '.',
  plugins: [react(), packagedReleaseManifest],
  base: './',
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Several suites build, hash, or coordinate real subprocesses. Running
    // those files in parallel makes the local verdict depend on host load.
    fileParallelism: false,
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: false,
  },
});

