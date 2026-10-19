import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { getSetting, setSetting, type CollectionSort } from '../db/repo';
import { setHapticsEnabled } from './haptics';

export type Settings = {
  haptics: boolean;
  reminders: boolean;
  reminderHour: number;
  onboarded: boolean;
  collectionSort: CollectionSort;
  // 'fill' crops previews to a fixed shape; 'fit' shapes each card like its image.
  imageFit: 'fill' | 'fit';
  theme: 'system' | 'light' | 'dark';
  offlineText: boolean;
  lastUpdateCheck: number;
  skippedVersion: string | null;
};

const DEFAULTS: Settings = { haptics: true, reminders: false, reminderHour: 19, onboarded: false, collectionSort: 'oldest', imageFit: 'fill', theme: 'system', offlineText: true, lastUpdateCheck: 0, skippedVersion: null };

// Latest settings for non-React code (saving, sync, update checks).
let snapshot: Settings = DEFAULTS;
export function currentSettings(): Settings {
  return snapshot;
}

type Ctx = { settings: Settings; ready: boolean; update: (patch: Partial<Settings>) => Promise<void> };

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getSetting(db, 'settings')
      .then((raw) => {
        const next = { ...DEFAULTS, ...(raw ? (JSON.parse(raw) as Partial<Settings>) : {}) };
        setHapticsEnabled(next.haptics);
        snapshot = next;
        setSettings(next);
      })
      .catch((error) => console.warn('[settings] load failed', error))
      .finally(() => setReady(true));
  }, [db]);

  const update = useCallback(
    async (patch: Partial<Settings>) => {
      // From the snapshot so back-to-back updates from non-React code do not undo each other.
      const next = { ...snapshot, ...patch };
      setHapticsEnabled(next.haptics);
      snapshot = next;
      setSettings(next);
      await setSetting(db, 'settings', JSON.stringify(next));
    },
    [db],
  );

  return <SettingsContext.Provider value={{ settings, ready, update }}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
