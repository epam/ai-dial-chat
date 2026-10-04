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

/*
 * Light and Dark always lead the picker, whatever order the themes host lists
 * them in — `config.json` order is incidental, not a product decision, and a
 * file that happens to list `dark` first must not reorder the picker. Any other
 * theme follows in configuration order.
 */
const PINNED_THEME_IDS: string[] = [ThemeId.Light, ThemeId.Dark];

const getPinnedRank = (id: string) => {
  const index = PINNED_THEME_IDS.indexOf(id);
  return index === -1 ? PINNED_THEME_IDS.length : index;
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
    // `sort` is stable, so unpinned themes keep their configuration order.
    const ordered = [...configured].sort(
      (a, b) => getPinnedRank(a.id) - getPinnedRank(b.id),
    );
    const themeOptions = ordered.map((theme) => {
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
