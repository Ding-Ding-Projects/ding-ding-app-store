import { useCallback, useEffect, useState } from 'react';
import type { UserSettings } from '../../shared/contracts';
import type { Notify } from '../notify';

export const defaultSettings: UserSettings = {
  language: 'bilingual',
  englishFunnyLevel: 2,
  cantoneseFunnyLevel: 4,
  theme: 'system',
  density: 'comfortable',
  accent: '#6750A4',
  displayName: 'Ding Ding App Store',
};

export interface SettingsApi {
  settings: UserSettings;
  save(next: UserSettings): Promise<void>;
  patch<K extends keyof UserSettings>(key: K, value: UserSettings[K]): Promise<void>;
}

export function useSettings(notify: Notify): SettingsApi {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);

  useEffect(() => { void window.dingDingStore.settings.load().then(setSettings); }, []);

  const save = useCallback(async (next: UserSettings) => {
    try {
      setSettings(await window.dingDingStore.settings.save(next));
      notify({ ok: true, message: 'Settings saved and applied.' });
    } catch (error) {
      notify({ ok: false, message: (error as Error).message });
    }
  }, [notify]);

  const patch = useCallback(async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    await save({ ...settings, [key]: value });
  }, [save, settings]);

  return { settings, save, patch };
}
