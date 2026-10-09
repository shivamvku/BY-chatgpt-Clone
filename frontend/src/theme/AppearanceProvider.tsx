import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import type { Appearance, Contrast } from '../shared/types';
import { buildTheme } from './tokens';

interface Preferences {
  appearance: Appearance;
  contrast: Contrast;
}
interface AppearanceState extends Preferences {
  setPreferences: (value: Preferences) => void;
}
const Context = createContext<AppearanceState | null>(null);
function initial(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem('yc-appearance') || '{}');
    return {
      appearance: ['light', 'dark', 'system'].includes(value.appearance)
        ? value.appearance
        : 'system',
      contrast: value.contrast === 'high' ? 'high' : 'standard',
    };
  } catch {
    return { appearance: 'system', contrast: 'standard' };
  }
}
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preferences, setState] = useState(initial);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const mode =
    preferences.appearance === 'system' ? (systemDark ? 'dark' : 'light') : preferences.appearance;
  const theme = useMemo(() => buildTheme(mode, preferences.contrast), [mode, preferences.contrast]);
  const setPreferences = (value: Preferences) => {
    setState(value);
    try {
      localStorage.setItem('yc-appearance', JSON.stringify(value));
    } catch {
      /* Storage may be blocked. */
    }
  };
  return (
    <Context.Provider value={{ ...preferences, setPreferences }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </Context.Provider>
  );
}
export function useAppearance() {
  const context = useContext(Context);
  if (!context) throw new Error('Appearance provider is missing');
  return context;
}
