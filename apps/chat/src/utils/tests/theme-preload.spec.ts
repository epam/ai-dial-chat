import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageKey } from '../../types/storage-key';
import { ThemeId } from '../../types/theme-id';
import {
  clearPreloadedThemeColors,
  resolveInitialThemeId,
  THEME_PRELOAD_ATTRIBUTE,
} from '../theme-preload';

const PRELOAD_SCRIPT = readFileSync(
  join(__dirname, '../../../public/theme-init.js'),
  'utf-8',
);

const runPreloadScript = () => new Function(PRELOAD_SCRIPT)();

const THEME_COLORS = {
  light: { 'bg-layer-0': '#ffffff', 'text-primary': '#141a23' },
  dark: { 'bg-layer-0': '#000000', 'text-primary': '#f3f4f6' },
};

const stubPrefersDark = (matches: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches })),
  );

describe('theme-init.js', () => {
  const root = document.documentElement;

  beforeEach(() => {
    window.localStorage.clear();
    root.removeAttribute('style');
    root.removeAttribute(THEME_PRELOAD_ATTRIBUTE);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the same storage keys the app writes', () => {
    expect(PRELOAD_SCRIPT).toContain(`getItem('${StorageKey.Theme}')`);
    expect(PRELOAD_SCRIPT).toContain(`getItem('${StorageKey.ThemeColors}')`);
    expect(PRELOAD_SCRIPT).toContain(`'${THEME_PRELOAD_ATTRIBUTE}'`);
  });

  it('paints the stored theme colours and lists them in the preload attribute', () => {
    window.localStorage.setItem(StorageKey.Theme, ThemeId.Dark);
    window.localStorage.setItem(
      StorageKey.ThemeColors,
      JSON.stringify(THEME_COLORS),
    );

    runPreloadScript();

    expect(root.style.getPropertyValue('--bg-layer-0')).toBe('#000000');
    expect(root.getAttribute(THEME_PRELOAD_ATTRIBUTE)).toBe(
      '--bg-layer-0 --text-primary',
    );
  });

  it('paints light when no theme was ever chosen', () => {
    window.localStorage.setItem(
      StorageKey.ThemeColors,
      JSON.stringify(THEME_COLORS),
    );

    runPreloadScript();

    expect(root.style.getPropertyValue('--bg-layer-0')).toBe('#ffffff');
  });

  it('resolves system against the OS preference', () => {
    stubPrefersDark(true);
    window.localStorage.setItem(StorageKey.Theme, ThemeId.System);
    window.localStorage.setItem(
      StorageKey.ThemeColors,
      JSON.stringify(THEME_COLORS),
    );

    runPreloadScript();

    expect(root.style.getPropertyValue('--bg-layer-0')).toBe('#000000');
  });

  it('leaves the page untouched when the cache is missing or malformed', () => {
    window.localStorage.setItem(StorageKey.Theme, ThemeId.Dark);
    runPreloadScript();
    window.localStorage.setItem(StorageKey.ThemeColors, '{not json');
    runPreloadScript();

    expect(root.getAttribute('style')).toBeNull();
    expect(root.hasAttribute(THEME_PRELOAD_ATTRIBUTE)).toBe(false);
  });
});

describe('clearPreloadedThemeColors', () => {
  it('removes every listed property and the attribute', () => {
    const element = document.createElement('div');
    element.style.setProperty('--a', 'red');
    element.style.setProperty('--b', 'blue');
    element.style.setProperty('--kept', 'green');
    element.setAttribute(THEME_PRELOAD_ATTRIBUTE, '--a --b');

    clearPreloadedThemeColors(element);

    expect(element.style.getPropertyValue('--a')).toBe('');
    expect(element.style.getPropertyValue('--b')).toBe('');
    expect(element.style.getPropertyValue('--kept')).toBe('green');
    expect(element.hasAttribute(THEME_PRELOAD_ATTRIBUTE)).toBe(false);
  });
});

describe('resolveInitialThemeId', () => {
  const getOsTheme = () => ThemeId.Dark;

  it('returns light when nothing is stored', () => {
    expect(resolveInitialThemeId(null, getOsTheme)).toBe(ThemeId.Light);
  });

  it('resolves system against the OS', () => {
    expect(resolveInitialThemeId(ThemeId.System, getOsTheme)).toBe(
      ThemeId.Dark,
    );
  });

  it('returns a stored custom id as is', () => {
    expect(resolveInitialThemeId('contoso-night', getOsTheme)).toBe(
      'contoso-night',
    );
  });
});
