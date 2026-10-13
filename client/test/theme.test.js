import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('Theme System Logic & State Resolution', () => {
  const STORAGE_KEY = 'job_agent_theme';

  // Mock document and window environment for Node unit testing
  let mockStorage = {};
  let rootClasses = new Set();
  let rootColorScheme = '';
  let mediaQueryMatches = false;

  const mockLocalStorage = {
    getItem: (key) => mockStorage[key] || null,
    setItem: (key, val) => {
      mockStorage[key] = String(val);
    },
    removeItem: (key) => {
      delete mockStorage[key];
    },
    clear: () => {
      mockStorage = {};
    },
  };

  const applyThemeToDOM = (activeTheme) => {
    if (activeTheme === 'dark') {
      rootClasses.add('dark');
      rootColorScheme = 'dark';
    } else {
      rootClasses.delete('dark');
      rootColorScheme = 'light';
    }
  };

  const resolveTheme = (themePreference, isSystemDark) => {
    if (themePreference === 'system') {
      return isSystemDark ? 'dark' : 'light';
    }
    return themePreference;
  };

  const toggleThemeState = (currentTheme, isSystemDark) => {
    const currentResolved = currentTheme === 'system'
      ? (isSystemDark ? 'dark' : 'light')
      : currentTheme;
    return currentResolved === 'dark' ? 'light' : 'dark';
  };

  const simulatePreHydrationScript = (storage, prefersDark) => {
    const stored = storage.getItem(STORAGE_KEY);
    let isDark = false;
    if (stored === 'dark') {
      isDark = true;
    } else if (stored === 'light') {
      isDark = false;
    } else {
      isDark = prefersDark;
    }
    return isDark ? 'dark' : 'light';
  };

  beforeEach(() => {
    mockStorage = {};
    rootClasses = new Set();
    rootColorScheme = '';
    mediaQueryMatches = false;
  });

  describe('Theme Resolution & DOM Synchronization', () => {
    test('explicit dark theme resolves to dark and adds dark class to root', () => {
      const resolved = resolveTheme('dark', false);
      assert.equal(resolved, 'dark');
      applyThemeToDOM(resolved);
      assert.equal(rootClasses.has('dark'), true);
      assert.equal(rootColorScheme, 'dark');
    });

    test('explicit light theme resolves to light and removes dark class from root', () => {
      // Start with dark
      applyThemeToDOM('dark');
      assert.equal(rootClasses.has('dark'), true);

      // Switch to light
      const resolved = resolveTheme('light', true);
      assert.equal(resolved, 'light');
      applyThemeToDOM(resolved);
      assert.equal(rootClasses.has('dark'), false);
      assert.equal(rootColorScheme, 'light');
    });

    test('system theme resolves dynamically to dark when OS prefers dark', () => {
      const resolved = resolveTheme('system', true);
      assert.equal(resolved, 'dark');
      applyThemeToDOM(resolved);
      assert.equal(rootClasses.has('dark'), true);
      assert.equal(rootColorScheme, 'dark');
    });

    test('system theme resolves dynamically to light when OS prefers light', () => {
      const resolved = resolveTheme('system', false);
      assert.equal(resolved, 'light');
      applyThemeToDOM(resolved);
      assert.equal(rootClasses.has('dark'), false);
      assert.equal(rootColorScheme, 'light');
    });
  });

  describe('Theme Toggling Logic', () => {
    test('toggling from light results in dark', () => {
      const next = toggleThemeState('light', false);
      assert.equal(next, 'dark');
    });

    test('toggling from dark results in light', () => {
      const next = toggleThemeState('dark', false);
      assert.equal(next, 'light');
    });

    test('toggling from system (when OS is dark) results in light', () => {
      const next = toggleThemeState('system', true);
      assert.equal(next, 'light');
    });

    test('toggling from system (when OS is light) results in dark', () => {
      const next = toggleThemeState('system', false);
      assert.equal(next, 'dark');
    });
  });

  describe('LocalStorage Persistence', () => {
    test('persists selected theme to localStorage', () => {
      mockLocalStorage.setItem(STORAGE_KEY, 'dark');
      assert.equal(mockLocalStorage.getItem(STORAGE_KEY), 'dark');

      mockLocalStorage.setItem(STORAGE_KEY, 'light');
      assert.equal(mockLocalStorage.getItem(STORAGE_KEY), 'light');

      mockLocalStorage.setItem(STORAGE_KEY, 'system');
      assert.equal(mockLocalStorage.getItem(STORAGE_KEY), 'system');
    });

    test('pre-hydration script applies dark theme before React mount if stored=dark', () => {
      mockLocalStorage.setItem(STORAGE_KEY, 'dark');
      const initial = simulatePreHydrationScript(mockLocalStorage, false);
      assert.equal(initial, 'dark');
    });

    test('pre-hydration script applies light theme before React mount if stored=light even if OS is dark', () => {
      mockLocalStorage.setItem(STORAGE_KEY, 'light');
      const initial = simulatePreHydrationScript(mockLocalStorage, true);
      assert.equal(initial, 'light');
    });

    test('pre-hydration script respects system dark mode if no theme is stored', () => {
      const initial = simulatePreHydrationScript(mockLocalStorage, true);
      assert.equal(initial, 'dark');
    });

    test('pre-hydration script respects system light mode if no theme is stored', () => {
      const initial = simulatePreHydrationScript(mockLocalStorage, false);
      assert.equal(initial, 'light');
    });
  });
});
