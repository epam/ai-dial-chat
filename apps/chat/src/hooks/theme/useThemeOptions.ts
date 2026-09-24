import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsI18nKeys } from '../../constants/translation-keys';
import { useTheme } from '../../context/ThemeContext';
import { ThemeId } from '../../types/theme-id';

export interface ThemeOption {
  value: string;
  label: string;
}

/*
 * The three ids every DIAL themes host ships are translated, so a shipped
 * theme reads in the user's language. A theme the operator added under some
 * other id has no key to translate and falls back to the `displayName` the
 * server supplies — untranslatable, and the accepted cost of supporting
 * arbitrary ids.
 */
const THEME_LABEL_KEYS: Record<string, SettingsI18nKeys> = {
  [ThemeId.Light]: SettingsI18nKeys.ThemeLight,
  [ThemeId.Dark]: SettingsI18nKeys.ThemeDark,
  [ThemeId.System]: SettingsI18nKeys.ThemeSystem,
};

/**
 * Builds the theme picker's option list from whatever the themes host serves,
 * rather than from a hardcoded light/dark/system triple.
 *
 * `system` is not a configured theme — it is a synthetic option that follows
 * `prefers-color-scheme`, so it is only offered when both themes it resolves
 * to are actually available.
 */
export const useThemeOptions = () => {
  const { themes, selectedTheme, setTheme } = useTheme();
  const { t } = useTranslation();

  const options = useMemo<ThemeOption[]>(() => {
    const configured = themes ?? [];
    const themeOptions = configured.map((theme) => {
      const labelKey = THEME_LABEL_KEYS[theme.id];
      return {
        value: theme.id,
        label: labelKey ? t(labelKey) : theme.displayName || theme.id,
      };
    });

    const hasLight = configured.some((theme) => theme.id === ThemeId.Light);
    const hasDark = configured.some((theme) => theme.id === ThemeId.Dark);
    if (hasLight && hasDark) {
      themeOptions.push({
        value: ThemeId.System,
        label: t(SettingsI18nKeys.ThemeSystem),
      });
    }

    return themeOptions;
  }, [t, themes]);

  return { options, selectedTheme, setTheme };
};
