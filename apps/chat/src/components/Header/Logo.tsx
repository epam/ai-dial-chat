import { useCelebration } from '@epam/ai-dial-celebrations';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatI18nKeys } from '../../constants/translation-keys';
import { useTheme } from '../../context/ThemeContext';
import { useUiFeature } from '../../hooks/useUiFeature';
import { getIconPath } from '../../utils/icon-path';

/**
 * Logo component that displays the theme-specific logo image or fallback text.
 * Below the desktop breakpoint it shows the favicon, falling back to a
 * smaller full logo when the theme defines no favicon. With
 * `show-mobile-header-full-logo` enabled it shows the full logo there instead,
 * keeping the favicon when the theme defines no logo.
 */
const Logo: FC = () => {
  const { t } = useTranslation();
  const { event } = useCelebration();
  const { currentThemeLogo, currentThemeFavicon } = useTheme();
  const isFullLogoOnMobile =
    useUiFeature(OverlayFeature.ShowMobileHeaderFullLogo) && !!currentThemeLogo;

  if (!currentThemeLogo && !currentThemeFavicon) {
    return null;
  }

  return (
    <a href="/" aria-label={t(ChatI18nKeys.Logo)} className="flex items-center">
      {currentThemeFavicon && !isFullLogoOnMobile && (
        <span
          style={{
            // Quoted: an inlined SVG data URL breaks an unquoted `url()`.
            backgroundImage: `url("${event?.iconUrl ?? getIconPath(currentThemeFavicon)}")`,
          }}
          className="h-[32px] w-[32px] bg-contain bg-center bg-no-repeat desktop:hidden"
        />
      )}
      {currentThemeLogo && (
        <span
          style={{ backgroundImage: `url("${getIconPath(currentThemeLogo)}")` }}
          className={mergeClasses(
            'min-w-[125px] bg-contain bg-center bg-no-repeat desktop:block desktop:h-[48px]',
            currentThemeFavicon && !isFullLogoOnMobile
              ? 'hidden'
              : 'block h-[32px]',
          )}
        />
      )}
    </a>
  );
};

export default memo(Logo);
