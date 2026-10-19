import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { applyScheme, type Scheme } from '../theme';
import { useSettings } from './settings';

const ThemeContext = createContext<Scheme>('light');

// Resolves System / Light / Dark into the active scheme and swaps the color tokens before children render.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const { settings } = useSettings();
  const scheme: Scheme = settings.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : settings.theme;
  applyScheme(scheme);
  return <ThemeContext.Provider value={scheme}>{children}</ThemeContext.Provider>;
}

// Screens call this so they re-render (and pick up new colors) when the theme changes.
export function useTheme(): Scheme {
  return useContext(ThemeContext);
}
