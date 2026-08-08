import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'vite';
import { GENERATED_RELEASE_MANIFEST } from '../src/renderer/generated-changelog';

const root = path.resolve(import.meta.dirname, '..');
let output = '';

beforeAll(async () => {
  output = await mkdtemp(path.join(os.tmpdir(), 'ding-ding-release-build-'));
  await build({ configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent', build: { outDir: output, emptyOutDir: true } });
});

afterAll(async () => {
  if (output.startsWith(os.tmpdir())) await rm(output, { recursive: true, force: true });
});

describe('packaged release manifest', () => {
  it('emits the generated release data into production output without a viewer import', async () => {
    const packaged = JSON.parse(await readFile(path.join(output, 'release-changelog.json'), 'utf8'));
    expect(packaged).toEqual(GENERATED_RELEASE_MANIFEST);
    expect(packaged.schemaVersion).toBe(1);
    expect(packaged.entries.length).toBeGreaterThan(0);
  });
});
