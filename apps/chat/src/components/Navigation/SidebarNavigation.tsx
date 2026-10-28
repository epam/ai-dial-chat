import { useCelebration } from '@epam/ai-dial-celebrations';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  NavigationSidebar,
  NavigationSidebarVariant,
  UserMenu,
  UserMenuTriggerVariant,
  type NavigationMenuGroup,
} from '@epam/ai-dial-navigation-panel';
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { MOBILE_SIDEBAR_ID } from '../../constants/layout';
import {
  AuthI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
  NavigationI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useIsolatedModelView } from '../../context/IsolatedModelViewContext';
import { useTheme } from '../../context/ThemeContext';
import { useUnsavedChanges } from '../../context/UnsavedChangesContext';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useLogout } from '../../hooks/logout/useLogout';
import { useMobileSidebarContent } from '../../hooks/navigation/useMobileSidebarContent';
import { useNavigationItems } from '../../hooks/navigation/useNavigationItems';
import { useNavigationMenuGroups } from '../../hooks/navigation/useNavigationMenuGroups';
import { useNavigationUserProfile } from '../../hooks/navigation/useNavigationUserProfile';
import { useUiFeature } from '../../hooks/useUiFeature';
import { AuthStatus } from '../../types/auth-status';
import { getIconPath } from '../../utils/icon-path';
import LogoutConfirmationModal from '../LogoutConfirmation/LogoutConfirmationModal';
import UsageLink from './UsageLink';

const SettingsModal = lazy(() => import('../SettingsModal/SettingsModal'));

interface Props {
  /** Conversation block rendered inside the sidebar. */
  chats?: ReactNode;
  /** Desktop: whether the sidebar is collapsed to its icon-only width. Defaults to `false`. */
  isCollapsed?: boolean;
  /** Desktop: toggles the sidebar between expanded and collapsed. */
  onToggleCollapse?: () => void;
  /** Mobile: whether the drawer is open. Defaults to `false`. */
  isOpen?: boolean;
  /** Mobile: closes the drawer. */
  onClose?: () => void;
}

/**
 * The application's navigation: one sidebar with the items, the conversation
 * block, a Usage link and the user menu. On desktop it is a persistent column
 * that collapses to icons; on a mobile viewport the same content is a 320px
 * drawer opened from the header, which the sidebar lib slides and focuses itself. Settings opens as a dialog in both.
 */
const SidebarNavigation: FC<Props> = ({
  chats,
  isCollapsed = false,
  onToggleCollapse,
  isOpen = false,
  onClose,
}) => {
  const { t } = useTranslation();
  const { event } = useCelebration();
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const { status, user } = useUser();
  const { isLogoutOpen, openLogout, closeLogout, performLogout } = useLogout();
  const { hasUnsavedChanges, requestDiscard } = useUnsavedChanges();
  const { currentThemeFavicon, currentThemeLogo } = useTheme();
  const isUserMenuHidden = useUiFeature(OverlayFeature.HideUserMenu);
  const isUserMenuIdentityHidden = useUiFeature(
    OverlayFeature.HideUserMenuIdentity,
  );
  const isSettingsPageHidden = useUiFeature(OverlayFeature.HideSettingsPage);
  const isUsagePageHidden = useUiFeature(OverlayFeature.HideUsagePage);
  const isToggleEnabled = useUiFeature(OverlayFeature.ConversationsPanelToggle);
  const { hasNavigation } = useMobileSidebarContent();
  /* TODO: remove in next release, with the isolated view. It shows the chats
     alone: `hide-navigation-menu` is forced on, which empties the mobile
     drawer, and the desktop sidebar drops its navigation here. */
  const { isActive: isIsolatedView } = useIsolatedModelView();
  const allItems = useNavigationItems();
  const profile = useNavigationUserProfile();
  const { languageGroup, keyboardGroup } = useNavigationMenuGroups();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), []);
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), []);

  /* While a builder is dirty, Log out asks about the unsaved edits instead of
     the "Log out?" confirmation, and Discard changes signs out directly: one
     dialog for one click. */
  const handleLogout = useCallback(() => {
    if (hasUnsavedChanges) {
      requestDiscard(performLogout);
      return;
    }
    openLogout();
  }, [hasUnsavedChanges, requestDiscard, performLogout, openLogout]);

  /* A navigation inside the drawer ends it, as the sheet it replaces did. */
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;
    if (isMobile && isOpen) onClose?.();
  }, [pathname, isMobile, isOpen, onClose]);

  /* A link to the page already on screen changes no route, so the effect
     above never fires: the click itself ends the drawer. */
  const handleLinkClick = useCallback(() => {
    if (isMobile && isOpen) onClose?.();
  }, [isMobile, isOpen, onClose]);

  const isNavigationShown = isMobile ? hasNavigation : !isIsolatedView;
  const isUserMenuShown =
    status === AuthStatus.Authenticated &&
    !!user &&
    !isUserMenuHidden &&
    isNavigationShown;
  const items = isNavigationShown ? allItems : [];
  const isUsageShown = !isUsagePageHidden && isNavigationShown;
  const iconUrl = currentThemeFavicon
    ? (event?.iconUrl ?? getIconPath(currentThemeFavicon))
    : undefined;
  const logoUrl = currentThemeLogo ? getIconPath(currentThemeLogo) : undefined;
  const markUrl = iconUrl ?? logoUrl;
  const getUserMenuTriggerVariant = (): UserMenuTriggerVariant =>
    isCollapsed && !isMobile
      ? UserMenuTriggerVariant.Compact
      : UserMenuTriggerVariant.Profile;
  /* The keyboard-shortcut group is offered where a hardware keyboard is the
     exception rather than the rule, so it is kept in the drawer's menu only. */
  const userMenuGroups = [
    languageGroup,
    isMobile ? keyboardGroup : undefined,
  ].filter((group): group is NavigationMenuGroup => group != null);

  const sidebar = (
    <NavigationSidebar
      variant={
        isMobile
          ? NavigationSidebarVariant.Drawer
          : NavigationSidebarVariant.Sidebar
      }
      items={items}
      labels={{
        ariaLabel: t(NavigationI18nKeys.AriaLabel),
        toggle: t(NavigationI18nKeys.Sidebar),
        collapse: t(NavigationI18nKeys.CollapseSidebar),
        expand: t(NavigationI18nKeys.ExpandSidebar),
        close: t(ButtonsI18nKeys.Close),
      }}
      logo={
        markUrl
          ? {
              ariaLabel: t(ChatI18nKeys.Logo),
              logoUrl,
              iconUrl: markUrl,
            }
          : undefined
      }
      id={isMobile ? MOBILE_SIDEBAR_ID : undefined}
      isCollapsed={isCollapsed}
      onToggleCollapse={isToggleEnabled ? onToggleCollapse : undefined}
      isOpen={isOpen}
      onClose={onClose}
      renderLink={(item, children, linkProps) => (
        <Link to={item.id} {...linkProps} onClick={handleLinkClick}>
          {children}
        </Link>
      )}
      userMenu={
        isUserMenuShown && (
          <UserMenu
            profile={profile}
            groups={userMenuGroups.length > 0 ? userMenuGroups : undefined}
            triggerVariant={getUserMenuTriggerVariant()}
            isIdentityHidden={isUserMenuIdentityHidden}
            labels={{
              trigger: t(AuthI18nKeys.SignedInAs, { email: profile.email }),
              avatarAlt: t(AuthI18nKeys.UserAvatar),
              logOut: t(ButtonsI18nKeys.LogOut),
              settings: t(BasicI18nKeys.Settings),
            }}
            onLogout={handleLogout}
            onSettings={isSettingsPageHidden ? undefined : handleOpenSettings}
          />
        )
      }
      footerActions={
        isUsageShown ? <UsageLink onClick={handleLinkClick} /> : undefined
      }
    >
      {chats}
    </NavigationSidebar>
  );

  return (
    <>
      {sidebar}

      {isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal onClose={handleCloseSettings} />
        </Suspense>
      )}

      <LogoutConfirmationModal isOpen={isLogoutOpen} onClose={closeLogout} />
    </>
  );
};

export default memo(SidebarNavigation);
