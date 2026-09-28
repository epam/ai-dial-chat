import { useCelebration } from '@epam/ai-dial-celebrations';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  NavigationPanel,
  NavigationSheet,
  UserMenu,
  type NavigationPanelItem,
} from '@epam/ai-dial-navigation-panel';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import {
  AuthI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
  NavigationI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useTheme } from '../../context/ThemeContext';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useLogout } from '../../hooks/logout/useLogout';
import { useNavigationItems } from '../../hooks/navigation/useNavigationItems';
import { useNavigationMenuGroups } from '../../hooks/navigation/useNavigationMenuGroups';
import { useNavigationUserProfile } from '../../hooks/navigation/useNavigationUserProfile';
import { useUiFeature } from '../../hooks/useUiFeature';
import { AuthStatus } from '../../types/auth-status';
import { ROUTES } from '../../types/routes';
import { getIconPath } from '../../utils/icon-path';
import FooterMessage from '../FooterMessage/FooterMessage';
import LogoutConfirmationModal from '../LogoutConfirmation/LogoutConfirmationModal';

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
}

/**
 * Application shell for primary navigation: the desktop rail on wide viewports,
 * the bottom sheet on narrow ones, and the shared log-out confirmation. Feature
 * gating, routing, and translation all resolve here so the navigation lib stays
 * presentational.
 */
const Navigation: FC<Props> = ({ isOpen = false, onClose }) => {
  const { t } = useTranslation();
  const { event } = useCelebration();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { status, user } = useUser();
  const { isLogoutOpen, openLogout, closeLogout } = useLogout();
  const { currentThemeFavicon } = useTheme();
  const isUserMenuHidden = useUiFeature(OverlayFeature.HideUserMenu);
  const isNavigationMenuHidden = useUiFeature(
    OverlayFeature.HideNavigationMenu,
  );
  const isSettingsPageHidden = useUiFeature(OverlayFeature.HideSettingsPage);
  const items = useNavigationItems();
  const profile = useNavigationUserProfile();
  const { languageGroup, keyboardGroup } = useNavigationMenuGroups();

  const isAuthenticated = status === AuthStatus.Authenticated && !!user;
  const isUserMenuShown = isAuthenticated && !isUserMenuHidden;

  const handleSelectItem = (item: NavigationPanelItem) => navigate(item.id);
  const handleOpenSettings = isSettingsPageHidden
    ? undefined
    : () => navigate(ROUTES.Settings);

  return (
    <>
      {!isMobile && (
        <NavigationPanel
          items={items}
          labels={{ ariaLabel: t(NavigationI18nKeys.AriaLabel) }}
          logo={
            currentThemeFavicon
              ? {
                  iconUrl: event?.iconUrl ?? getIconPath(currentThemeFavicon),
                  ariaLabel: t(ChatI18nKeys.Logo),
                }
              : undefined
          }
          renderLink={(item, children) => (
            <Link to={item.id} className="contents">
              {children}
            </Link>
          )}
          footer={
            isUserMenuShown && (
              <UserMenu
                profile={profile}
                groups={languageGroup ? [languageGroup] : undefined}
                labels={{
                  trigger: t(AuthI18nKeys.SignedInAs, { email: profile.email }),
                  avatarAlt: t(AuthI18nKeys.UserAvatar),
                  logOut: t(ButtonsI18nKeys.LogOut),
                  settings: t(BasicI18nKeys.Settings),
                }}
                onLogout={openLogout}
                onSettings={handleOpenSettings}
              />
            )
          }
        />
      )}

      {/* Unmounted rather than kept closed: the sheet holds focusable rows,
          and its only trigger is the header hamburger this key also removes. */}
      {!isNavigationMenuHidden && (
        <NavigationSheet
          isOpen={isOpen}
          onClose={onClose ?? (() => undefined)}
          items={items}
          onSelectItem={handleSelectItem}
          profile={profile}
          groups={keyboardGroup ? [keyboardGroup] : undefined}
          onLogout={openLogout}
          onSettings={handleOpenSettings}
          footer={<FooterMessage />}
          labels={{
            title: t(NavigationI18nKeys.Menu),
            close: t(ButtonsI18nKeys.Close),
            back: t(NavigationI18nKeys.Back),
            profile: t(NavigationI18nKeys.Profile),
            logOut: t(ButtonsI18nKeys.LogOut),
            settings: t(BasicI18nKeys.Settings),
          }}
        />
      )}

      <LogoutConfirmationModal isOpen={isLogoutOpen} onClose={closeLogout} />
    </>
  );
};

export default memo(Navigation);
