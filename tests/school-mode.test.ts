import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SchoolModeService } from '../src/main/school-mode-service';
import { projectChangelogEntries } from '../src/renderer/changelog';
import { buildRegistry } from '../src/renderer/registry';
import { projectSchoolModeObservation, schoolModeSnapshotIsAvailable } from '../src/renderer/state/use-school-mode';
import { DEFAULT_SCHEDULE, DEFAULT_TAB_WORKSPACE, DEFAULT_USER_SETTINGS, type SchoolModeSnapshot } from '../src/shared/contracts';
import { applySchoolModePresentation, schoolModeAllowsHistoryEntry, schoolModeAllowsNotification, schoolModeDisplayText, schoolModeHiddenContent, schoolModeProjectManagedUpdates, schoolModeRestrictedText } from '../src/shared/school-mode';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ding-ding-school-mode-'));
  return { root, file: path.join(root, 'school-mode.v1.json') };
}

function expected(snapshot: SchoolModeSnapshot) {
  if (!snapshot.state) throw new Error('Expected a verified shared state.');
  return { expectedRecordId: snapshot.state.recordId, expectedRevision: snapshot.state.revision };
}

describe('School mode presentation', () => {
  it('temporarily forces English and serious voice while preserving prior settings for restoration', () => {
    const prior = { ...DEFAULT_USER_SETTINGS, language: 'bilingual' as const, englishFunnyLevel: 5, cantoneseFunnyLevel: 4 };
    const locked = applySchoolModePresentation(prior, true);
    expect(locked).toMatchObject({ language: 'en', englishFunnyLevel: 1, cantoneseFunnyLevel: 1 });
    expect(prior).toMatchObject({ language: 'bilingual', englishFunnyLevel: 5, cantoneseFunnyLevel: 4 });
    expect(applySchoolModePresentation(prior, false)).toMatchObject({ language: 'bilingual', englishFunnyLevel: 5, cantoneseFunnyLevel: 4 });
  });

  it('removes language, voice, funny-level, and dim-sum discoverability from the command registry', () => {
    const entries = buildRegistry({ settings: DEFAULT_USER_SETTINGS, workspace: structuredClone(DEFAULT_TAB_WORKSPACE), appearance: {}, schedule: structuredClone(DEFAULT_SCHEDULE), apps: [{ id: 'dim-sum-atlas', name: 'Dim Sum Atlas', repository: 'dim-sum-atlas', description: '', homepageUrl: null, repositoryUrl: '', defaultBranch: 'main', topics: [], stars: 0, updatedAt: '', latestVersion: null, latestReleaseUrl: null, availability: 'documentation-only', packageType: 'unsupported', proofStatus: 'not-required', proofTargetId: null, installedVersion: null, updateState: 'unknown', docsAvailable: true }], schoolModeEnabled: true });
    const text = entries.map((entry) => `${entry.id} ${entry.en} ${entry.yue} ${entry.keywords.join(' ')}`).join('\n');
    expect(text).not.toMatch(/language mode|funny level|粵語 funny|dim sum atlas|點心/i);
    expect(text).not.toMatch(/authenticator|驗證器|RFC 6238|TOTP/i);
    expect(text).toContain('School');
    for (const forbiddenQuery of ['language', 'funny', 'voice']) {
      expect(entries.filter((entry) => `${entry.en}\n${entry.yue}\n${entry.keywords.join('\n')}`.toLowerCase().includes(forbiddenQuery))).toHaveLength(0);
    }
    expect(text).not.toMatch(/dim-sum-surprise|optional-spoken-narrator|catalog-language/i);
  });

  it('uses a custom display name without leaking the shipped name in palette entries', () => {
    const entries = buildRegistry({ settings: DEFAULT_USER_SETTINGS, workspace: structuredClone(DEFAULT_TAB_WORKSPACE), appearance: {}, schedule: structuredClone(DEFAULT_SCHEDULE), apps: [], schoolModeName: 'Classroom' });
    const schoolEntries = entries.filter((entry) => entry.id.includes('school-mode') || entry.en.toLowerCase().includes('classroom'));
    expect(schoolEntries.some((entry) => entry.en === 'Open Classroom settings')).toBe(true);
    expect(schoolEntries.map((entry) => `${entry.en} ${entry.yue}`).join(' ')).not.toContain('School mode');
  });

  it('waits for shared mode state before scheduling the non-optional surprise', async () => {
    const appSource = await readFile(path.resolve('src/renderer/App.tsx'), 'utf8');
    expect(appSource).toContain('if (schoolMode.restricted)');
    expect(appSource).toContain('schoolMode.restricted, updateState.status');
    expect(appSource).toContain('useAuthenticator(!schoolMode.loading && !schoolMode.restricted)');
    expect(appSource).toContain("activeTab === 'authenticator' && !schoolMode.restricted");
  });

  it('projects changelog search, rendering, and exports without hidden references or replacement-token leaks', () => {
    const entries = projectChangelogEntries([
      { version: 'v9.9.9-1', releasedAt: '2026-08-10T00:00:00.000Z', commit: 'a'.repeat(40), changes: ['Language and funny voice controls changed.', 'Shared mode renamed in one place.', 'See optional-spoken-narrator for context.'] },
    ], true, '$& classroom');
    expect(entries).toHaveLength(1);
    expect(entries[0].changes).toEqual(['Shared mode renamed in one place.']);
    expect(schoolModeDisplayText('School mode is enabled.', '$& classroom')).toBe('$& classroom is enabled.');
  });
  it('uses an explicit restricted allowlist for persisted notifications and activity', () => {
    expect(schoolModeAllowsNotification({ message: 'An old custom name is enabled.' }, true)).toBe(false);
    expect(schoolModeAllowsNotification({ schoolModeCode: 'enabled' }, true)).toBe(true);
    expect(schoolModeAllowsNotification({ message: 'An ordinary update completed.' }, false)).toBe(true);
    expect(schoolModeAllowsHistoryEntry(true)).toBe(false);
    expect(schoolModeAllowsHistoryEntry(false)).toBe(true);
    expect(schoolModeHiddenContent('{"language":"yue","narratorEnabled":true,"voice":"both"}')).toBe(true);
    expect(schoolModeHiddenContent('English-only presentation is active.')).toBe(true);
  });

  it('neutralizes provider, release, and operation text when restricted', () => {
    const fallback = 'Details unavailable while restricted.';
    expect(schoolModeRestrictedText('Dim Sum Atlas serves Cantonese voice copy.', 'Classroom', fallback)).toBe(fallback);
    expect(schoolModeRestrictedText('Release package for the ordinary catalog.', 'Classroom', fallback)).toBe('Release package for the ordinary catalog.');
    expect(schoolModeRestrictedText('School mode operation completed.', 'Classroom', fallback)).toBe('Classroom operation completed.');
  });

  it('removes hidden-only managed update state from the restricted Updates projection', () => {
    const updates = { 'dim-sum-atlas': { status: 'ready' }, keepassxc: { status: 'ready' } };
    expect(schoolModeProjectManagedUpdates(updates, new Set(['keepassxc']), true)).toEqual({ keepassxc: { status: 'ready' } });
    expect(schoolModeProjectManagedUpdates(updates, new Set(), true)).toEqual({});
  });

  it('uses fail-closed restricted presentation before or without a verified snapshot', async () => {
    const appSource = await readFile(path.resolve('src/renderer/App.tsx'), 'utf8');
    const hookSource = await readFile(path.resolve('src/renderer/state/use-school-mode.ts'), 'utf8');
    expect(appSource).toContain('applySchoolModePresentation(resolved, schoolMode.restricted)');
    expect(appSource).toContain('if (schoolMode.restricted)');
    expect(appSource).toContain('schoolModeRestrictedText(item.description');
    expect(appSource).toContain("message: projectRuntimeText((error as Error).message, 'Operation details unavailable while restricted.'");
    expect(appSource).toContain("message: projectRuntimeText((error as Error).message, 'Update details unavailable while restricted.'");
    expect(appSource).toContain("message: projectRuntimeText(result.message, 'Update details unavailable while restricted.'");
    expect(appSource).toContain('managedUpdates={visibleManagedUpdates}');
    expect(appSource).toContain('apps.some((app) => app.updateState === \'available\')');
    expect(appSource).toContain('setAction(null);');
    expect(appSource).toContain('action && !schoolMode.restricted && <ActionDialog');
    expect(hookSource).toContain('const restricted = loading || !available || state.enabled');
    expect(hookSource).toContain("displayName: 'Shared mode'");
  });

  it('orders live observations and treats watcher loss as unavailable at the hook seam', () => {
    const base = { snapshot: null, observationSequence: 4, loading: true, bridgeUnavailable: false };
    const ready = { schemaVersion: 2 as const, recordId: 'A'.repeat(22), revision: 1, enabled: false, displayName: 'Shared mode', unlockKind: 'pin' as const };
    const fresh = { schemaVersion: 1 as const, observationSequence: 5, state: ready, configured: true, sync: { status: 'ready' as const, watching: true } };
    const late = { ...fresh, observationSequence: 3 };
    const accepted = projectSchoolModeObservation(base, fresh);
    expect(accepted.snapshot).toBe(fresh);
    expect(projectSchoolModeObservation(accepted, late)).toBe(accepted);
    expect(schoolModeSnapshotIsAvailable(fresh)).toBe(true);
    expect(schoolModeSnapshotIsAvailable({ ...fresh, sync: { status: 'ready', watching: false } })).toBe(false);
    expect(schoolModeSnapshotIsAvailable({ ...fresh, sync: { status: 'unavailable', watching: false, reason: 'watch-failed' } })).toBe(false);
  });
});

describe('School mode revisioned shared record', () => {
  it('persists a revisioned opaque record without credential material in public snapshots', async () => {
    const { root, file } = await fixture();
    const service = new SchoolModeService(file);
    try {
      const initial = await service.load();
      const configured = await service.configure({ ...expected(initial), displayName: 'Quiet classroom', unlockKind: 'pin', credential: '1234' });
      expect(configured.ok).toBe(true);
      expect(configured.snapshot.state).toMatchObject({ schemaVersion: 2, revision: 1, enabled: true, displayName: 'Quiet classroom', unlockKind: 'pin' });
      expect(configured.snapshot.state?.recordId).toMatch(/^[A-Za-z0-9_-]{22,64}$/);
      const raw = await readFile(file, 'utf8');
      expect(raw).not.toContain('1234');
      expect(raw).toContain('verifier');
      expect(JSON.stringify(configured.snapshot)).not.toMatch(/1234|salt|verifier|digest/i);
      expect(await service.verify({ credential: '1234' })).toBe(true);
      expect(await service.verify({ credential: '9999' })).toBe(false);
    } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('requires the latest credential before disabling and preserves state on rejection', async () => {
    const { root, file } = await fixture();
    const service = new SchoolModeService(file);
    try {
      const initial = await service.load();
      const configured = await service.configure({ ...expected(initial), displayName: 'Classroom', unlockKind: 'password', credential: 'correct horse' });
      const rejected = await service.setEnabled({ ...expected(configured.snapshot), enabled: false, credential: 'wrong horse' });
      expect(rejected).toMatchObject({ ok: false, snapshot: { state: { enabled: true, revision: 1 } } });
      const accepted = await service.setEnabled({ ...expected(rejected.snapshot), enabled: false, credential: 'correct horse' });
      expect(accepted).toMatchObject({ ok: true, snapshot: { state: { enabled: false, revision: 2 } } });
      const reloaded = await new SchoolModeService(file).load();
      expect(reloaded.state?.displayName).toBe('Classroom');
    } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('rotates the verifier with current-plus-new credentials and enforces PIN syntax', async () => {
    const { root, file } = await fixture();
    const service = new SchoolModeService(file);
    try {
      const initial = await service.load();
      const configured = await service.configure({ ...expected(initial), displayName: 'Focus', unlockKind: 'password', credential: 'old password' });
      const invalidPin = await service.changeCredential({ ...expected(configured.snapshot), currentCredential: 'old password', nextCredential: '12ab', unlockKind: 'pin' });
      expect(invalidPin.ok).toBe(false);
      expect(invalidPin.snapshot.state?.revision).toBe(1);
      const rotated = await service.changeCredential({ ...expected(configured.snapshot), currentCredential: 'old password', nextCredential: '2468', unlockKind: 'pin' });
      expect(rotated).toMatchObject({ ok: true, snapshot: { state: { revision: 2, unlockKind: 'pin' } } });
      expect(await service.verify({ credential: 'old password' })).toBe(false);
      expect(await service.verify({ credential: '2468' })).toBe(true);
    } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('allows a name before first setup but never creates an enabled unlocked state', async () => {
    const { root, file } = await fixture();
    const service = new SchoolModeService(file);
    try {
      const initial = await service.load();
      const renamed = await service.rename({ ...expected(initial), displayName: 'My class' });
      expect(renamed.snapshot.state).toMatchObject({ enabled: false, unlockKind: null, displayName: 'My class', revision: 1 });
      expect((await service.setEnabled({ ...expected(renamed.snapshot), enabled: true })).ok).toBe(false);
    } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('migrates a valid v1 PIN/password record to a v2 recordId and revision', async () => {
    const { root, file } = await fixture();
    const legacy = { schemaVersion: 1, enabled: false, displayName: 'Legacy class', unlockKind: 'pin', salt: Buffer.alloc(16, 1).toString('base64'), verifier: Buffer.alloc(32, 2).toString('base64') };
    try {
      await writeFile(file, `${JSON.stringify(legacy)}\n`);
      const service = new SchoolModeService(file);
      const snapshot = await service.load();
      expect(snapshot).toMatchObject({ state: { schemaVersion: 2, revision: 1, displayName: 'Legacy class', unlockKind: 'pin' }, sync: { status: 'ready' } });
      const stored = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
      expect(stored).toMatchObject({ schemaVersion: 2, revision: 1, displayName: 'Legacy class' });
      expect(stored.recordId).toMatch(/^[A-Za-z0-9_-]{22,64}$/);
      service.dispose();
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('reports malformed and passkey-tagged records as unavailable instead of assuming off', async () => {
    const { root, file } = await fixture();
    try {
      await writeFile(file, JSON.stringify({ enabled: true, displayName: 'Unknown class' }));
      const malformed = await new SchoolModeService(file).load();
      expect(malformed).toMatchObject({ state: null, configured: false, sync: { status: 'unavailable', reason: 'parse-failed' } });
      expect(malformed.sync).not.toHaveProperty('message');

      await writeFile(file, JSON.stringify({ schemaVersion: 2, recordId: 'abcdefghijklmnopqrstuvwx', revision: 1, enabled: true, displayName: 'Passkey preview', unlockKind: 'passkey', salt: Buffer.alloc(16, 1).toString('base64'), verifier: Buffer.alloc(32, 2).toString('base64') }));
      const passkey = await new SchoolModeService(file).load();
      expect(passkey).toMatchObject({ state: null, sync: { status: 'unavailable', reason: 'parse-failed' } });
      expect(JSON.stringify(passkey)).not.toMatch(/salt|verifier|school-mode\.v1\.json/i);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
