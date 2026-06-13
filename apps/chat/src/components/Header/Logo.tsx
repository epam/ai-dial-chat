import { FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatI18nKeys } from '../../constants/translation-keys';
import { useTheme } from '../../context/ThemeContext';
import { getIconPath } from '../../utils/icon-path';

/**
 * Logo component that displays the theme-specific logo image or fallback text.
 */
const Logo: FC = () => {
  const { t } = useTranslation();
  const { currentThemeLogo } = useTheme();

  return currentThemeLogo ? (
    <a
      href="/"
      aria-label={t(ChatI18nKeys.Logo)}
      style={{ backgroundImage: `url(${getIconPath(currentThemeLogo)})` }}
      className="h-[48px] min-w-[125px] bg-contain bg-right bg-no-repeat"
    />
  ) : null;
};

export default memo(Logo);
