import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_SETTINGS } from '../src/shared/contracts';
import { dialogCopy } from '../src/renderer/dialog-emoji';
import { readFile } from 'node:fs/promises';

describe('dialog emoji preference', () => {
  it('defaults on and decorates only the visible copy', () => {
    expect(DEFAULT_USER_SETTINGS.showEmojisInDialogs).toBe(true);
    expect(dialogCopy(DEFAULT_USER_SETTINGS, 'Delete selected records?', '⚠️')).toBe('⚠️ Delete selected records?');
    expect(dialogCopy({ ...DEFAULT_USER_SETTINGS, showEmojisInDialogs: false }, 'Delete selected records?', '⚠️')).toBe('Delete selected records?');
  });

  it('keeps action controls and accessible names free of emoji decoration', async () => {
    const action = await readFile('src/renderer/components/ActionDialog.tsx', 'utf8');
    const destructive = await readFile('src/renderer/components/DestructiveConfirmDialog.tsx', 'utf8');
    expect(action).toContain("dialogCopy(settings");
    expect(destructive).toContain("dialogCopy(settings");
    expect(action).toContain('aria-label="Emergency exit"');
    expect(destructive).toContain('aria-label="Emergency exit"');
    expect(action).not.toMatch(/aria-label=\{?dialogCopy/);
    expect(destructive).not.toMatch(/aria-label=\{?dialogCopy/);
  });
});
