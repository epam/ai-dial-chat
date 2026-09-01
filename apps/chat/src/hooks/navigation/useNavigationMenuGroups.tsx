import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { SendOnEnter } from '@epam/ai-dial-conversation-input';
import type { NavigationMenuGroup } from '@epam/ai-dial-navigation-panel';
import { DIAL_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconKeyboard, IconLanguage } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { SettingsI18nKeys } from '../../constants/translation-keys';
import {
  metaKey,
  useKeyboardShortcutPreference,
} from '../keyboard-shortcut/useKeyboardShortcutPreference';
import { SUPPORTED_LANGUAGES, useLanguage } from '../language/useLanguage';
import { useUiFeature } from '../useUiFeature';

/*
 * TODO: a theme group belongs here too, but only the light theme ships today.
 * Reinstate it by building a `NavigationMenuGroup` from `useThemeOptions`.
 */

/** Single-select settings groups offered by the navigation menus. */
export interface NavigationMenuGroups {
  /** Locale picker; omitted when user settings are hidden or only one locale ships. */
  languageGroup?: NavigationMenuGroup;
  /** Send-on-Enter picker; omitted when user settings or shortcuts are hidden. */
  keyboardGroup?: NavigationMenuGroup;
}

/**
 * Builds the settings groups the navigation lib renders — as dropdown submenus
 * on the desktop rail and as pushed pages in the mobile sheet.
 */
export const useNavigationMenuGroups = (): NavigationMenuGroups => {
  const { t } = useTranslation();
  const { language, changeLanguage } = useLanguage();
  const { preference, setPreference } = useKeyboardShortcutPreference();
  const isUserSettingsHidden = useUiFeature(OverlayFeature.HideUserSettings);
  const isKeyboardShortcutsHidden = useUiFeature(
    OverlayFeature.HideKeyboardShortcuts,
  );

  const isLanguageGroupShown =
    !isUserSettingsHidden && SUPPORTED_LANGUAGES.length > 1;
  const isKeyboardGroupShown =
    !isUserSettingsHidden && !isKeyboardShortcutsHidden;

  return {
    languageGroup: isLanguageGroupShown
      ? {
          id: 'language',
          label: t(SettingsI18nKeys.Language),
          icon: (
            <IconLanguage
              size={DIAL_ICON_SIZE.SM}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          ),
          options: SUPPORTED_LANGUAGES.map(({ code, nativeName }) => ({
            id: `language-${code}`,
            label: nativeName,
            isActive: language.startsWith(code),
            onSelect: () => changeLanguage(code),
          })),
        }
      : undefined,
    keyboardGroup: isKeyboardGroupShown
      ? {
          id: 'keyboard-shortcuts',
          label: t(SettingsI18nKeys.KeyboardShortcuts),
          icon: (
            <IconKeyboard
              size={DIAL_ICON_SIZE.SM}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          ),
          options: [
            {
              id: 'shortcut-enter',
              label: t(SettingsI18nKeys.ShortcutEnter),
              isActive: preference === SendOnEnter.Enter,
              onSelect: () => setPreference(SendOnEnter.Enter),
            },
            {
              id: 'shortcut-meta-enter',
              label: t(SettingsI18nKeys.ShortcutMetaEnter, {
                modifier: metaKey,
              }),
              isActive: preference === SendOnEnter.MetaEnter,
              onSelect: () => setPreference(SendOnEnter.MetaEnter),
            },
          ],
        }
      : undefined,
  };
};
