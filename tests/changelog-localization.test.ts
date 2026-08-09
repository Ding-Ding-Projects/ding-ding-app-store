import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_SETTINGS, type LanguageMode, type UserSettings } from '../src/shared/contracts';
import {
  changelogCommitResultMessage,
  changelogEditorResultMessage,
  changelogMessage,
  formatChangelogDate,
  localizeChangelogIssue,
  unexpectedFailureMessage,
} from '../src/renderer/pages/ChangelogViewer';

const settings = (language: LanguageMode, englishFunnyLevel = 1, cantoneseFunnyLevel = 1): UserSettings => ({
  ...DEFAULT_USER_SETTINGS,
  language,
  englishFunnyLevel,
  cantoneseFunnyLevel,
});

describe('ChangelogViewer localization', () => {
  it('uses five distinct voices in each language without changing the supplied fact', () => {
    const english = [1, 2, 3, 4, 5].map((level) => changelogMessage(settings('en', level), 'success', 'Copied 2 entries.', '已複製 2 條記錄。'));
    const cantonese = [1, 2, 3, 4, 5].map((level) => changelogMessage(settings('yue', 1, level), 'error', 'Copy failed.', '複製失敗。'));
    expect(new Set(english)).toHaveLength(5);
    expect(new Set(cantonese)).toHaveLength(5);
    for (const value of english) expect(value).toContain('Copied 2 entries.');
    for (const value of cantonese) expect(value).toContain('複製失敗。');
    expect(changelogMessage(settings('bilingual', 3, 4), 'success', 'Copied.', '已複製。')).toContain(' · ');
  });

  it('formats dates from the app language instead of the operating-system locale', () => {
    const releasedAt = '2026-08-09T12:00:00.000Z';
    const english = formatChangelogDate(settings('en'), releasedAt);
    const cantonese = formatChangelogDate(settings('yue'), releasedAt);
    expect(english).not.toBe(cantonese);
    expect(formatChangelogDate(settings('bilingual'), releasedAt)).toBe(`${english} · ${cantonese}`);
    expect(formatChangelogDate(settings('yue'), 'not-a-date')).toBe('not-a-date');
  });

  it('localizes known validation predicates while rendering the release fact once', () => {
    const version = 'v0.1.0-832-1';
    const localized = localizeChangelogIssue(settings('bilingual', 2, 4), `${version} is missing a full commit SHA.`);
    expect(localized.fact).toBe(version);
    expect(localized.message).not.toContain(version);
    expect(`${localized.fact} ${localized.message}`.split(version)).toHaveLength(2);
    expect(localizeChangelogIssue(settings('yue'), 'Provider validation fact.')).toEqual({ fact: null, message: 'Provider validation fact.' });
  });

  it('maps typed editor failures to Cantonese and keeps downloads recoverable', () => {
    const reasons = ['bridge-unavailable', 'not-installed', 'write-failed', 'launch-failed', 'launch-timeout'] as const;
    for (const reason of reasons) {
      const message = changelogEditorResultMessage(settings('yue'), { ok: false, reason, message: 'English bridge detail.' }, 3);
      expect(message).not.toContain('English bridge detail.');
      expect(message).toContain('Markdown');
    }
    expect(changelogEditorResultMessage(settings('en'), { ok: true, editor: 'vscode' }, 3)).toContain('3 changelog entries');
  });

  it('uses the bridge Cantonese fact and never falls back to English in Cantonese mode', () => {
    const localized = changelogCommitResultMessage(settings('yue'), {
      ok: false,
      appId: 'ding-ding-app-store',
      message: 'Opening commit links is unavailable.',
      messageYue: '未能開啟 commit 連結。',
    });
    expect(localized).toContain('未能開啟 commit 連結。');
    expect(localized).not.toContain('Opening commit links is unavailable.');

    const generic = changelogCommitResultMessage(settings('yue'), {
      ok: false,
      appId: 'ding-ding-app-store',
      message: 'Provider detail in English.',
    });
    expect(generic).toContain('未能開啟 commit 連結。');
    expect(generic).not.toContain('Provider detail in English.');
  });

  it('keeps unexpected exception details private and appends one bounded failure fact', () => {
    const code = 'commit-navigation-bridge-failed';
    const english = unexpectedFailureMessage(settings('en'), code, 'The commit link could not be opened.', '未能開啟 commit 連結。');
    const cantonese = unexpectedFailureMessage(settings('yue'), code, 'The commit link could not be opened.', '未能開啟 commit 連結。');
    const bilingual = unexpectedFailureMessage(settings('bilingual'), code, 'The commit link could not be opened.', '未能開啟 commit 連結。');
    expect(english).toContain('The commit link could not be opened.');
    expect(cantonese).toContain('未能開啟 commit 連結。');
    expect(cantonese).not.toContain('The commit link could not be opened.');
    expect(bilingual.split(`[${code}]`)).toHaveLength(2);
    expect(`${english}${cantonese}${bilingual}`).not.toContain('Error.message');
  });

  it('keeps the visible and accessible ChangelogViewer copy on localized paths', async () => {
    const [viewer, navigation] = await Promise.all([
      readFile(new URL('../src/renderer/pages/ChangelogViewer.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/renderer/external-navigation.ts', import.meta.url), 'utf8'),
    ]);
    expect(viewer).toContain('formatChangelogDate(settings, entry.releasedAt)');
    expect(viewer).toContain('localizeChangelogIssue(settings, issue)');
    expect(viewer).toContain('changelogEditorResultMessage(settings, result, exportEntries.length)');
    expect(viewer).toContain("unexpectedFailureMessage(settings, 'external-editor-bridge-failed', 'The changelog export could not be opened in Visual Studio Code.'");
    expect(viewer).toContain("unexpectedFailureMessage(settings, 'commit-navigation-bridge-failed', 'The commit link could not be opened.'");
    expect(viewer).not.toContain('error.message.trim()');
    expect(viewer).toContain("label(settings, 'Select release', '揀選版本')");
    expect(viewer).not.toContain('new Date(entry.releasedAt).toLocaleDateString()');
    expect(viewer).not.toContain('aria-label="Changelog bulk actions"');
    expect(viewer).not.toContain('>No matching releases</h3>');
    expect(viewer).not.toContain('message: result.message });');
    expect(viewer).not.toContain('entry.commit.slice(0, 12)');
    expect(navigation).toContain("messageYue: '呢個版本未能開啟 commit 連結；請改為複製 commit URL。'");
  });
});
