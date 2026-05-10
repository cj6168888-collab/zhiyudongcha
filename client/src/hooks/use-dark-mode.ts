/**
 * Dark Mode Hook
 *
 * Manages dark/light theme with system preference detection,
 * localStorage persistence, and smooth transitions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('useDarkMode');

export type Theme = 'dark' | 'light' | 'system';

export interface DarkModeConfig {
  defaultTheme?: Theme;
  storageKey?: string;
  className?: string;
  onChange?: (theme: Theme) => void;
  respectSystem?: boolean;
}

export interface UseDarkModeReturn {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  isDark: boolean;
}

const STORAGE_KEY = 'app_theme';
const CLASS_NAME = 'dark';
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function useDarkMode(config: DarkModeConfig = {}): UseDarkModeReturn {
  const { defaultTheme = 'system', storageKey = STORAGE_KEY, className = CLASS_NAME, onChange, respectSystem = true } = config;

  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('light');
  const isFirstRender = useRef(true);

  const getSystemTheme = useCallback((): 'dark' | 'light' => {
    if (typeof window === 'undefined') return 'light';

    try {
      return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }, []);

  const resolveTheme = useCallback(
    (currentTheme: Theme): 'dark' | 'light' => {
      if (currentTheme === 'system' && respectSystem) {
        return getSystemTheme();
      }
      return currentTheme as 'dark' | 'light';
    },
    [respectSystem, getSystemTheme]
  );

  const applyTheme = useCallback(
    (newTheme: 'dark' | 'light') => {
      if (typeof document === 'undefined') return;

      const root = document.documentElement;

      if (newTheme === 'dark') {
        root.classList.add(className);
      } else {
        root.classList.remove(className);
      }

      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute(
          'content',
          newTheme === 'dark' ? '#1a1a2e' : '#ffffff'
        );
      }

      logger.debug(`[useDarkMode] Applied theme: ${newTheme}`);
    },
    [className]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && ['dark', 'light', 'system'].includes(stored)) {
        const parsedTheme = stored as Theme;
        setThemeState(parsedTheme);
        const resolved = resolveTheme(parsedTheme);
        setResolvedTheme(resolved);
        applyTheme(resolved);
        logger.debug(`[useDarkMode] Loaded theme: ${parsedTheme} (resolved: ${resolved})`);
      }
    } catch (error) {
      logger.warn('[useDarkMode] Failed to load theme:', error);
    }
  }, [storageKey, resolveTheme, applyTheme]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    onChange?.(theme);
  }, [theme, onChange]);

  useEffect(() => {
    if (typeof window === 'undefined' || theme !== 'system' || !respectSystem) {
      return;
    }

    const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);

    const handleChange = (event: MediaQueryListEvent): void => {
      const newResolved = event.matches ? 'dark' : 'light';
      setResolvedTheme(newResolved);
      applyTheme(newResolved);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, respectSystem, applyTheme]);

  const setThemeCallback = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);

      try {
        localStorage.setItem(storageKey, newTheme);
      } catch (error) {
        logger.warn('[useDarkMode] Failed to save theme:', error);
      }

      const resolved = resolveTheme(newTheme);
      setResolvedTheme(resolved);
      applyTheme(resolved);
    },
    [storageKey, resolveTheme, applyTheme]
  );

  const toggle = useCallback((): void => {
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setThemeCallback(newTheme);
  }, [resolvedTheme, setThemeCallback]);

  return {
    theme,
    resolvedTheme,
    setTheme: setThemeCallback,
    toggle,
    isDark: resolvedTheme === 'dark',
  };
}

export function getThemeColorVariables(isDark: boolean): Record<string, string> {
  return isDark
    ? {
        '--background': '#1a1a2e',
        '--foreground': '#e0e0e0',
        '--primary': '#667eea',
        '--muted': '#2d2d44',
      }
    : {
        '--background': '#ffffff',
        '--foreground': '#1a1a2e',
        '--primary': '#667eea',
        '--muted': '#f5f5f5',
      };
}

export default useDarkMode;
