import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { classifyManagedUpdateError, managedUpdateInternals } from '../src/main/managed-update-service.js';

const read = (file: string) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

describe('managed per-app update contracts', () => {
  it('accepts only GitHub HTTPS release origins and rejects credential or unapproved URLs', () => {
    expect(() => managedUpdateInternals.assertReleaseUrl('https://github.com/Ding-Ding-Projects/app/releases/download/v1/Setup.exe')).not.toThrow();
    expect(() => managedUpdateInternals.assertReleaseUrl('https://release-assets.githubusercontent.com/asset')).not.toThrow();
    for (const value of [
      'http://github.com/Ding-Ding-Projects/app/asset',
      'https://user:pass@github.com/Ding-Ding-Projects/app/asset',
      'https://example.com/Ding-Ding-Projects/app/asset',
    ]) expect(() => managedUpdateInternals.assertReleaseUrl(value)).toThrow(/Blocked release asset origin/);
  });

  it('parses only a GitHub sha256 digest and exact companion filename', () => {
    const digest = 'a'.repeat(64);
    expect(managedUpdateInternals.githubDigest({ digest: `sha256:${digest}` })).toBe(digest);
    expect(managedUpdateInternals.githubDigest({ digest: `sha512:${digest}` })).toBeNull();
    expect(managedUpdateInternals.githubDigest({ digest: null })).toBeNull();
    expect(managedUpdateInternals.checksumFromCompanion(`${digest}  Setup.exe\n`, 'Setup.exe')).toBe(digest);
    expect(managedUpdateInternals.checksumFromCompanion(`${digest}  Other.exe\n`, 'Setup.exe')).toBeNull();
  });

  it('keeps renderer requests closed and never accepts paths, URLs, or commands', () => {
    expect(managedUpdateInternals.isManagedUpdateRequest({ appId: 'material-designer', decision: 'download-update' })).toBe(true);
    expect(managedUpdateInternals.isManagedUpdateRequest({ appId: 'material-designer', decision: 'install-update', path: 'C:\\bad.exe' })).toBe(false);
    expect(managedUpdateInternals.isManagedUpdateRequest({ appId: 'material-designer', decision: 'install' })).toBe(false);
    expect(managedUpdateInternals.isManagedUpdateCancelRequest({ appId: 'material-designer', decision: 'cancel-update' })).toBe(true);
  });

  it('classifies update failures into bounded path-free bilingual messages', () => {
    const classified = classifyManagedUpdateError(new Error('Release asset SHA-256 digest mismatch at C:\\Users\\secret\\stage.exe'));
    expect(classified.message).toContain('integrity check');
    expect(classified.message).not.toMatch(/[A-Z]:\\|\\\\Users/);
    expect(classified.messageYue.length).toBeGreaterThan(0);
    expect(classifyManagedUpdateError(new Error('Release download failed: HTTP 503')).message).toContain('downloaded');
  });

  it('has the separate staged state machine, progress, cancellation, and explicit install boundary', async () => {
    const service = await read('src/main/managed-update-service.ts');
    for (const contract of [
      'status: \'downloading\'', 'status: \'ready\'', "status: cancelled ? 'cancelled' : 'failed'",
      'AbortController', 'AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)', 'onProgress', 'updates:app-state',
      'install-update', 'shell: false', 'windowsHide: true', 'MAX_DOWNLOAD_BYTES', 'MAX_REDIRECTS',
      'persistedPath', 'replacePortableDirectory', 'recordHistory(candidate.record, true', 'async checkAll()',
      'checkGenerations', 'stageMatchesCandidate', 'repository: candidate.record.repository', 'adapterId: candidate.adapter.id',
      'currentStates()', 'publishCheck',
    ]) expect(service).toContain(contract);
    expect(service).not.toMatch(/request\.path|request\.url|request\.command/);
    const main = await read('src/main/main.ts');
    const preload = await read('src/preload/index.ts');
    for (const channel of ['updates:app-check', 'updates:app-download', 'updates:app-cancel', 'updates:app-install', 'updates:app-state']) {
      expect(`${main}\n${preload}`).toContain(channel);
    }
  });
});
