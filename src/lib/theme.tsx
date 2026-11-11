import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { applyScheme, colors, type Scheme } from '../theme';
import { useSettings } from './settings';

const ThemeContext = createContext<Scheme>('light');

// Resolves System / Light / Dark into the active scheme and swaps the color tokens before children render.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const { settings } = useSettings();
  const scheme: Scheme = settings.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : settings.theme;
  applyScheme(scheme);
  // The native window behind the screens follows the app's choice too, so "always dark" on a light phone
  // shows no white flashes during screen transitions.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.paper).catch(() => {});
  }, [scheme]);
  return <ThemeContext.Provider value={scheme}>{children}</ThemeContext.Provider>;
}

// Screens call this so they re-render (and pick up new colors) when the theme changes.
export function useTheme(): Scheme {
  return useContext(ThemeContext);
}
