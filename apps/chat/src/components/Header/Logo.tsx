import { DialLoader } from '@epam/ai-dial-ui-kit';
import { FC, memo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { getIconPath } from '../../utils/icon-path';

/**
 * Logo component that displays the theme-specific logo image or fallback text.
 * Shows loading skeleton while theme is being loaded.
 */
const Logo: FC = () => {
  const { currentThemeLogo, isLoading } = useTheme();

  // Show loading skeleton while theme is loading
  if (isLoading) {
    return <DialLoader size={14} ariaLabel="logo loading" />;
  }

  return currentThemeLogo ? (
    <a
      href="/"
      aria-label="logo"
      style={{ backgroundImage: `url(${getIconPath(currentThemeLogo)})` }}
      className="h-[48px] min-w-[125px] bg-contain bg-right bg-no-repeat"
    />
  ) : null;
};

export default memo(Logo);
