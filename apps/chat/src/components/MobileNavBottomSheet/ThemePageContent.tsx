import { BASE_ICON_SIZE, DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import {
  IconCheck,
  IconDeviceDesktop,
  IconMoon,
  IconSun,
} from '@tabler/icons-react';
import { type FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsI18nKeys } from '../../constants/translation-keys';
import { useThemeOptions } from '../../hooks/theme/useThemeOptions';
import { useSheetNavigation } from '../../hooks/useSheetNavigation';
import { ThemeId } from '../../types/theme-id';

const THEME_ROWS = [
  {
    id: ThemeId.Dark,
    labelKey: SettingsI18nKeys.ThemeDark,
    Icon: IconMoon,
    requiresBoth: false,
  },
  {
    id: ThemeId.Light,
    labelKey: SettingsI18nKeys.ThemeLight,
    Icon: IconSun,
    requiresBoth: false,
  },
  {
    id: ThemeId.System,
    labelKey: SettingsI18nKeys.ThemeSystem,
    Icon: IconDeviceDesktop,
    requiresBoth: true,
  },
] as const;

const ThemePageContent: FC = () => {
  const { t } = useTranslation();
  const { hasDark, hasLight, selectedTheme, setTheme } = useThemeOptions();
  const { pop } = useSheetNavigation();

  const handleSelect = (themeId: string) => {
    setTheme(themeId);
    pop();
  };

  return (
    <ul className="flex flex-col py-2 pb-4">
      {THEME_ROWS.map(({ id, labelKey, Icon, requiresBoth }) => {
        let isVisible: boolean;
        if (requiresBoth) {
          isVisible = hasDark && hasLight;
        } else if (id === ThemeId.Dark) {
          isVisible = hasDark;
        } else {
          isVisible = hasLight;
        }
        if (!isVisible) return null;
        const isActive = selectedTheme === id;
        return (
          <li key={id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-[10px] text-start hover:bg-accent-primary-alpha"
              onClick={() => handleSelect(id)}
            >
              <Icon size={BASE_ICON_SIZE} stroke={1.5} aria-hidden />
              <span className="dial-small-text flex-1">{t(labelKey)}</span>
              {isActive && (
                <IconCheck
                  size={DIAL_ICON_SIZE.SM}
                  stroke={2}
                  aria-hidden
                  className="text-accent-primary"
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default memo(ThemePageContent);
