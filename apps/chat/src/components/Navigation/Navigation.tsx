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
import { useFeatureFlag } from '../../context/AppConfigContext';
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
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { status, user } = useUser();
  const { isLogoutOpen, openLogout, closeLogout } = useLogout();
  const { currentThemeFavicon } = useTheme();
  const isUserMenuHidden = useUiFeature(OverlayFeature.HideUserMenu);
  const items = useNavigationItems();
  const profile = useNavigationUserProfile();
  const { languageGroup, keyboardGroup } = useNavigationMenuGroups();

  const isAuthenticated = status === AuthStatus.Authenticated && !!user;
  const isUserMenuShown = isAuthenticated && !isUserMenuHidden;
  const isSettingsPageEnabled = useFeatureFlag('settingsPageEnabled');

  const handleSelectItem = (item: NavigationPanelItem) => navigate(item.id);

  return (
    <>
      {!isMobile && (
        <NavigationPanel
          items={items}
          labels={{ ariaLabel: t(NavigationI18nKeys.AriaLabel) }}
          logo={
            currentThemeFavicon
              ? {
                  iconUrl: getIconPath(currentThemeFavicon),
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
                groups={[languageGroup, keyboardGroup].filter(
                  (group) => group != null,
                )}
                labels={{
                  trigger: t(AuthI18nKeys.SignedInAs, { email: profile.email }),
                  avatarAlt: t(AuthI18nKeys.UserAvatar),
                  logOut: t(ButtonsI18nKeys.LogOut),
                  ...(isSettingsPageEnabled && {
                    settings: t(BasicI18nKeys.Settings),
                  }),
                }}
                onLogout={openLogout}
                onSettings={
                  isSettingsPageEnabled
                    ? () => navigate(ROUTES.Settings)
                    : undefined
                }
              />
            )
          }
        />
      )}

      <NavigationSheet
        isOpen={isOpen}
        onClose={onClose ?? (() => undefined)}
        items={items}
        onSelectItem={handleSelectItem}
        profile={profile}
        /* The sheet deliberately offers only the shortcut group — the locale
           picker stays desktop-only, as it was before the lib extraction. */
        groups={keyboardGroup ? [keyboardGroup] : undefined}
        onLogout={openLogout}
        footer={<FooterMessage />}
        labels={{
          title: t(NavigationI18nKeys.Menu),
          close: t(ButtonsI18nKeys.Close),
          back: t(NavigationI18nKeys.Back),
          profile: t(NavigationI18nKeys.Profile),
          logOut: t(ButtonsI18nKeys.LogOut),
        }}
      />

      <LogoutConfirmationModal isOpen={isLogoutOpen} onClose={closeLogout} />
    </>
  );
};

export default memo(Navigation);
