import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_SETTINGS } from './settings';
import type { Settings } from './settings';

const SettingsContext = createContext<Settings>(DEFAULT_SETTINGS);

export function SettingsProvider({
  settings,
  children,
}: {
  settings: Settings;
  children: ReactNode;
}) {
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  return useContext(SettingsContext);
}
