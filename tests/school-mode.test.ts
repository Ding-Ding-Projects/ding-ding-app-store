import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SchoolModeService } from '../src/main/school-mode-service';
import { buildRegistry } from '../src/renderer/registry';
import { DEFAULT_SCHEDULE, DEFAULT_TAB_WORKSPACE, DEFAULT_USER_SETTINGS } from '../src/shared/contracts';
import { applySchoolModePresentation } from '../src/shared/school-mode';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ding-ding-school-mode-'));
  return { root, file: path.join(root, 'school-mode.v1.json') };
}

describe('School mode local shared state', () => {
  it('temporarily forces English and serious voice while preserving prior settings for restoration', () => {
    const prior = { ...DEFAULT_USER_SETTINGS, language: 'bilingual' as const, englishFunnyLevel: 5, cantoneseFunnyLevel: 4 };
    const locked = applySchoolModePresentation(prior, true);
    expect(locked).toMatchObject({ language: 'en', englishFunnyLevel: 1, cantoneseFunnyLevel: 1 });
    expect(prior).toMatchObject({ language: 'bilingual', englishFunnyLevel: 5, cantoneseFunnyLevel: 4 });
    expect(applySchoolModePresentation(prior, false)).toMatchObject({ language: 'bilingual', englishFunnyLevel: 5, cantoneseFunnyLevel: 4 });
  });

  it('removes language, voice, funny-level, and dim-sum discoverability from the command registry', () => {
    const entries = buildRegistry({ settings: DEFAULT_USER_SETTINGS, workspace: structuredClone(DEFAULT_TAB_WORKSPACE), appearance: {}, schedule: structuredClone(DEFAULT_SCHEDULE), apps: [{ id: 'dim-sum-atlas', name: 'Dim Sum Atlas', repository: 'dim-sum-atlas', description: '', homepageUrl: null, repositoryUrl: '', defaultBranch: 'main', topics: [], stars: 0, updatedAt: '', latestVersion: null, latestReleaseUrl: null, availability: 'documentation-only', packageType: 'unsupported', installedVersion: null, updateState: 'unknown', docsAvailable: true }], schoolModeEnabled: true });
    const text = entries.map((entry) => `${entry.id} ${entry.en} ${entry.yue} ${entry.keywords.join(' ')}`).join('\n');
    expect(text).not.toMatch(/language mode|funny level|粵語 funny|dim sum atlas|點心/i);
    expect(text).toContain('School');
  });

  it('uses a custom display name without leaking the shipped name in palette entries', () => {
    const entries = buildRegistry({ settings: DEFAULT_USER_SETTINGS, workspace: structuredClone(DEFAULT_TAB_WORKSPACE), appearance: {}, schedule: structuredClone(DEFAULT_SCHEDULE), apps: [], schoolModeName: 'Classroom' });
    const schoolEntries = entries.filter((entry) => entry.id.includes('school-mode') || entry.en.toLowerCase().includes('classroom'));
    expect(schoolEntries.some((entry) => entry.en === 'Open Classroom settings')).toBe(true);
    expect(schoolEntries.map((entry) => `${entry.en} ${entry.yue}`).join(' ')).not.toContain('School mode');
  });

  it('waits for shared mode state before scheduling the non-optional surprise', async () => {
    const appSource = await readFile(path.resolve('src/renderer/App.tsx'), 'utf8');
    expect(appSource).toContain('schoolMode.loading || schoolMode.state.enabled');
    expect(appSource).toContain('schoolMode.loading, schoolMode.state.enabled');
  });

  it('persists a renamed enabled mode without persisting the raw credential', async () => {
    const { root, file } = await fixture();
    try {
      const service = new SchoolModeService(file);
      const configured = await service.configure({ displayName: 'Quiet classroom', unlockKind: 'pin', credential: '1234' });
      expect(configured.ok).toBe(true);
      expect(configured.state).toMatchObject({ enabled: true, displayName: 'Quiet classroom', unlockKind: 'pin' });
      const raw = await readFile(file, 'utf8');
      expect(raw).not.toContain('1234');
      expect(raw).toContain('verifier');
      // The public mutation result is the only object the renderer can export;
      // it contains the name/state projection, never the credential.
      expect(JSON.stringify(configured.state)).not.toContain('1234');
      expect(await service.verify({ credential: '1234' })).toBe(true);
      expect(await service.verify({ credential: '9999' })).toBe(false);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('requires local verification before disabling and preserves state on failure', async () => {
    const { root, file } = await fixture();
    try {
      const service = new SchoolModeService(file);
      await service.configure({ displayName: 'Classroom', unlockKind: 'password', credential: 'correct horse' });
      const rejected = await service.setEnabled({ enabled: false, credential: 'wrong horse' });
      expect(rejected).toMatchObject({ ok: false, state: { enabled: true } });
      const accepted = await service.setEnabled({ enabled: false, credential: 'correct horse' });
      expect(accepted).toMatchObject({ ok: true, state: { enabled: false } });
      expect((await new SchoolModeService(file).load()).displayName).toBe('Classroom');
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('allows a name before first setup but never creates an enabled unlocked state', async () => {
    const { root, file } = await fixture();
    try {
      const service = new SchoolModeService(file);
      expect((await service.rename({ displayName: 'My class' })).state).toMatchObject({ enabled: false, unlockKind: null, displayName: 'My class' });
      expect((await service.setEnabled({ enabled: true })).ok).toBe(false);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('fails closed on malformed or legacy records; deleting the file is a reset path', async () => {
    const { root, file } = await fixture();
    try {
      await writeFile(file, JSON.stringify({ enabled: true, displayName: 'Legacy mode' }));
      expect(await new SchoolModeService(file).load()).toMatchObject({ enabled: false, displayName: 'School mode', unlockKind: null });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
