import { useCallback, useEffect, useState } from 'react';
import { applyTheme } from '../styles/theme';
import type { ThemeName } from '../types/models';

export const useTheme = (initialTheme: ThemeName = 'dark') => {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    applyTheme(initialTheme);
    return initialTheme;
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback(async (next: ThemeName) => {
    setThemeState(next);
    try {
      await window.merezhyvo?.ui?.set?.({ theme: next });
    } catch {
      // ignore persistence errors
    }
  }, []);

  return { theme, setTheme };
};
