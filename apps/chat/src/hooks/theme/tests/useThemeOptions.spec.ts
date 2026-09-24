import type { Theme } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsI18nKeys } from '../../../constants/translation-keys';
import * as ThemeContextModule from '../../../context/ThemeContext';
import { ThemeId } from '../../../types/theme-id';
import { useThemeOptions } from '../useThemeOptions';

vi.mock('../../../context/ThemeContext');

const makeTheme = (id: string, displayName?: string): Theme => ({
  id,
  displayName: displayName ?? '',
  colors: {},
  'app-logo': '',
});

describe('useThemeOptions', () => {
  const mockUseTheme = vi.mocked(ThemeContextModule.useTheme);
  const setTheme = vi.fn();

  const renderWithThemes = (themes?: Theme[], selectedTheme = ThemeId.Light) => {
    mockUseTheme.mockReturnValue({
      themes,
      selectedTheme,
      setTheme,
      currentTheme: selectedTheme,
      isLoading: false,
    });
    return renderHook(() => useThemeOptions());
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers Light, Dark and System when both are configured', () => {
    const { result } = renderWithThemes([
      makeTheme(ThemeId.Light, 'Light Theme'),
      makeTheme(ThemeId.Dark, 'Dark Theme'),
    ]);

    expect(result.current.options).toEqual([
      { value: ThemeId.Light, label: SettingsI18nKeys.ThemeLight },
      { value: ThemeId.Dark, label: SettingsI18nKeys.ThemeDark },
      { value: ThemeId.System, label: SettingsI18nKeys.ThemeSystem },
    ]);
  });

  it('offers a custom theme under its display name, in configuration order', () => {
    const { result } = renderWithThemes([
      makeTheme(ThemeId.Light, 'Light Theme'),
      makeTheme(ThemeId.Dark, 'Dark Theme'),
      makeTheme('contoso-night', 'Contoso Night'),
    ]);

    expect(result.current.options).toEqual([
      { value: ThemeId.Light, label: SettingsI18nKeys.ThemeLight },
      { value: ThemeId.Dark, label: SettingsI18nKeys.ThemeDark },
      { value: 'contoso-night', label: 'Contoso Night' },
      { value: ThemeId.System, label: SettingsI18nKeys.ThemeSystem },
    ]);
  });

  it('withholds System when only one of light and dark is configured', () => {
    const { result } = renderWithThemes([
      makeTheme(ThemeId.Light, 'Light Theme'),
      makeTheme('contoso-night', 'Contoso Night'),
    ]);

    expect(result.current.options).toEqual([
      { value: ThemeId.Light, label: SettingsI18nKeys.ThemeLight },
      { value: 'contoso-night', label: 'Contoso Night' },
    ]);
  });

  it('falls back to the theme id when the server sends no display name', () => {
    const { result } = renderWithThemes([makeTheme('contoso-night')]);

    expect(result.current.options).toEqual([
      { value: 'contoso-night', label: 'contoso-night' },
    ]);
  });

  it('returns no options when the configuration has not loaded', () => {
    const { result } = renderWithThemes(undefined);

    expect(result.current.options).toEqual([]);
  });

  it('passes the current selection and setter straight through', () => {
    const { result } = renderWithThemes(
      [makeTheme(ThemeId.Light), makeTheme(ThemeId.Dark)],
      ThemeId.Dark,
    );

    expect(result.current.selectedTheme).toBe(ThemeId.Dark);

    result.current.setTheme('contoso-night');
    expect(setTheme).toHaveBeenCalledWith('contoso-night');
  });
});
