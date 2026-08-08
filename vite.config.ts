import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { GENERATED_RELEASE_MANIFEST } from './src/renderer/generated-changelog';

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
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: false,
  },
});

