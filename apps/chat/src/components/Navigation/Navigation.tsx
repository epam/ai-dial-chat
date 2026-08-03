import { OverlayFeature } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, IconButton, mergeClasses } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { NAVIGATION_CONFIG } from '../../constants/navigation';
import {
  ChatI18nKeys,
  NavigationI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useTheme } from '../../context/ThemeContext';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useLogout } from '../../hooks/logout/useLogout';
import { useUiFeature } from '../../hooks/useUiFeature';
import { ROUTES } from '../../types/routes';
import { UserConfigStatus } from '../../types/user-config-status';
import { getIconPath } from '../../utils/icon-path';
import LogoutConfirmationModal from '../LogoutConfirmation/LogoutConfirmationModal';
import NavPageContent from '../MobileNavBottomSheet/NavPageContent';
import NavigableBottomSheet from '../NavigableBottomSheet/NavigableBottomSheet';
import UserMenu from './UserMenu';

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
}

const Navigation: FC<Props> = ({ isOpen = false, onClose }) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const { isLogoutOpen, openLogout, closeLogout } = useLogout();
  const { currentThemeFavicon } = useTheme();
  const { status, features } = useAppConfig();
  const isCatalogEnabled = useUiFeature(OverlayFeature.Catalog);
  const isUserMenuHidden = useUiFeature(OverlayFeature.HideUserMenu);

  const navItems = NAVIGATION_CONFIG.filter(
    ({ path, featureFlag }) =>
      (path !== ROUTES.Catalog || isCatalogEnabled) &&
      (featureFlag == null ||
        (status === UserConfigStatus.Ready && features[featureFlag] === true)),
  ).map(({ path, matchPaths, icon: Icon, labelKey }) => {
    const isActive =
      (path === '/' ? pathname === '/' : pathname.startsWith(path)) ||
      (matchPaths?.some((p) => pathname.startsWith(p)) ?? false);
    return (
      <Link key={path} to={path} className="contents">
        <IconButton
          icon={<Icon size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
          aria-label={t(labelKey)}
          aria-current={isActive ? 'page' : undefined}
          tooltipProps={{ tooltip: t(labelKey) }}
          tabIndex={-1}
          className={mergeClasses(
            'rounded hover:bg-control-accent-alpha-hover active:bg-control-accent-alpha-active',
            isActive ? 'text-accent' : undefined,
          )}
        />
      </Link>
    );
  });

  return (
    <>
      {/* Desktop sidebar — always mounted, hidden on mobile */}
      {!isMobile && (
        <nav
          aria-label={t(NavigationI18nKeys.AriaLabel)}
          className="relative z-10 flex h-full w-[60px] flex-col justify-between bg-layer-raised shadow-sm"
        >
          <div className="flex flex-col items-center">
            {currentThemeFavicon && (
              <a
                href="/"
                aria-label={t(ChatI18nKeys.Logo)}
                className="flex h-16 w-full shrink-0 items-center justify-center"
              >
                <span
                  style={{
                    backgroundImage: `url(${getIconPath(currentThemeFavicon)})`,
                  }}
                  className="h-6 w-6 bg-contain bg-center bg-no-repeat"
                />
              </a>
            )}
            <div className="flex flex-col items-center gap-2 p-2">
              {navItems}
            </div>
          </div>
          {!isUserMenuHidden && <UserMenu />}
        </nav>
      )}

      <NavigableBottomSheet
        isOpen={isOpen}
        onClose={onClose ?? (() => undefined)}
        title={t(NavigationI18nKeys.Menu)}
      >
        <NavPageContent onLogoutRequest={openLogout} />
      </NavigableBottomSheet>

      <LogoutConfirmationModal isOpen={isLogoutOpen} onClose={closeLogout} />
    </>
  );
};

export default memo(Navigation);
