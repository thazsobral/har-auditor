import { create } from 'zustand';

export type Theme = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
}

const STORAGE_KEY = 'har_toolbox_theme';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'dark'; // Dark mode default as required
}

function resolveSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeToDOM(theme: Theme): 'dark' | 'light' {
  if (typeof document === 'undefined') return 'dark';
  const root = document.documentElement;
  const resolved = theme === 'system' ? resolveSystemTheme() : theme;

  if (resolved === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
  }

  return resolved;
}

const initialTheme = getInitialTheme();
const initialResolved = applyThemeToDOM(initialTheme);

export const useTheme = create<ThemeState>((set, get) => {
  // Listen to OS theme changes if system theme is selected
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      const currentTheme = get().theme;
      if (currentTheme === 'system') {
        const resolved = applyThemeToDOM('system');
        set({ resolvedTheme: resolved });
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else {
      mediaQuery.addListener(handleMediaChange);
    }
  }

  return {
    theme: initialTheme,
    resolvedTheme: initialResolved,
    setTheme: (newTheme: Theme) => {
      try {
        localStorage.setItem(STORAGE_KEY, newTheme);
      } catch {
        // ignore
      }
      const resolved = applyThemeToDOM(newTheme);
      set({ theme: newTheme, resolvedTheme: resolved });
    },
    cycleTheme: () => {
      const current = get().theme;
      const next: Theme = current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark';
      get().setTheme(next);
    },
  };
});
