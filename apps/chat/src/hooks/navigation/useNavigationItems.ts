import type { NavigationPanelItem } from '@epam/ai-dial-navigation-panel';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { ROUTES } from '../../types/routes';
import { useVisibleNavItems } from '../useVisibleNavItems';

/**
 * Maps `NAVIGATION_CONFIG` onto the presentational item shape the navigation
 * lib consumes: translated labels plus the active flag derived from the route.
 */
export const useNavigationItems = (): NavigationPanelItem[] => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const visibleNavItems = useVisibleNavItems();

  return visibleNavItems.map(({ path, matchPaths, icon, labelKey }) => ({
    id: path,
    href: path,
    icon,
    label: t(labelKey),
    isActive:
      (path === ROUTES.Root
        ? pathname === ROUTES.Root
        : pathname.startsWith(path)) ||
      (matchPaths?.some((matchPath) => pathname.startsWith(matchPath)) ??
        false),
  }));
};
