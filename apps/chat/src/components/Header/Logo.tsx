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
  const { currentThemeLogo, currentThemeFavicon } = useTheme();

  if (!currentThemeLogo && !currentThemeFavicon) return null;

  return (
    <a href="/" aria-label={t(ChatI18nKeys.Logo)} className="flex items-center">
      {currentThemeFavicon && (
        <span
          style={{
            backgroundImage: `url(${getIconPath(currentThemeFavicon)})`,
          }}
          className="h-[32px] w-[32px] bg-contain bg-center bg-no-repeat tablet:hidden"
        />
      )}
      {currentThemeLogo && (
        <span
          style={{ backgroundImage: `url(${getIconPath(currentThemeLogo)})` }}
          className="hidden h-[48px] min-w-[125px] bg-contain bg-right bg-no-repeat tablet:block"
        />
      )}
    </a>
  );
};

export default memo(Logo);
