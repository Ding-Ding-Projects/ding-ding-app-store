import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_USER_SETTINGS } from '../../shared/contracts';
import type { SettingsProvenance, UserSettings } from '../../shared/contracts';
import type { Notify } from '../notify';

export const defaultSettings: UserSettings = { ...DEFAULT_USER_SETTINGS };

export interface SettingsApi {
  settings: UserSettings;
  provenance: SettingsProvenance;
  reload(): Promise<void>;
  save(next: UserSettings): Promise<void>;
  patch<K extends keyof UserSettings>(key: K, value: UserSettings[K]): Promise<void>;
}

export function useSettings(notify: Notify): SettingsApi {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [provenance, setProvenance] = useState<SettingsProvenance>({ source: 'fallback', fallback: { ...defaultSettings } });

  const reload = useCallback(async () => {
    try {
      const next = await window.dingDingStore.settings.load();
      setSettings(next);
      setProvenance(await window.dingDingStore.settings.provenance());
    } catch (error) {
      setSettings({ ...defaultSettings });
      setProvenance({ source: 'fallback', fallback: { ...defaultSettings } });
      notify({ ok: false, message: `Settings could not be reloaded after the local history change: ${(error as Error).message}` });
    }
  }, [notify]);

  useEffect(() => { void reload(); }, [reload]);

  const save = useCallback(async (next: UserSettings) => {
    try {
      setSettings(await window.dingDingStore.settings.save(next));
      setProvenance((current) => ({ ...current, source: 'persisted' }));
      notify({ ok: true, message: 'Settings saved and applied.' });
    } catch (error) {
      notify({ ok: false, message: (error as Error).message });
    }
  }, [notify]);

  const patch = useCallback(async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    await save({ ...settings, [key]: value });
  }, [save, settings]);

  return { settings, provenance, reload, save, patch };
}
