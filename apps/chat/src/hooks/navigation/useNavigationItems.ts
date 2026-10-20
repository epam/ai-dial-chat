import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import type { NavigationPanelItem } from '@epam/ai-dial-navigation-panel';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import type { NavigationItem } from '../../constants/navigation';
import { ROUTES } from '../../types/routes';
import { useUiFeature } from '../useUiFeature';
import { useVisibleNavItems } from '../useVisibleNavItems';

const isItemActive = (
  { path, matchPaths, isExactMatch }: NavigationItem,
  pathname: string,
): boolean => {
  if (isExactMatch) return pathname === path;

  return (
    pathname.startsWith(path) ||
    (matchPaths?.some((matchPath) => pathname.startsWith(matchPath)) ?? false)
  );
};

/**
 * Maps `NAVIGATION_CONFIG` onto the presentational item shape the navigation
 * lib consumes: translated labels plus the active flag derived from the route.
 * The root entry is dropped under `hide-new-conversation`.
 */
export const useNavigationItems = (): NavigationPanelItem[] => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const visibleNavItems = useVisibleNavItems();
  const isNewConversationHidden = useUiFeature(
    OverlayFeature.HideNewConversation,
  );

  return visibleNavItems
    .filter(({ path }) => !(isNewConversationHidden && path === ROUTES.Root))
    .map((navItem) => ({
      id: navItem.path,
      href: navItem.path,
      icon: navItem.icon,
      activeIcon: navItem.activeIcon,
      label: t(navItem.labelKey),
      isActive: isItemActive(navItem, pathname),
    }));
};
