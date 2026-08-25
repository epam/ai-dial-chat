import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  NAVIGATION_CONFIG,
  type NavigationItem,
} from '../constants/navigation';
import { useAppConfig } from '../context/AppConfigContext';
import { ROUTES } from '../types/routes';
import { UserConfigStatus } from '../types/user-config-status';
import { useUiFeature } from './useUiFeature';

/**
 * Returns the `NAVIGATION_CONFIG` entries that may currently render, after
 * applying both gating channels: the overlay UI feature owning the entry's
 * route, and the entry's `featureFlag` from the user config.
 */
export const useVisibleNavItems = (): NavigationItem[] => {
  const { status, features } = useAppConfig();
  const isCatalogEnabled = useUiFeature(OverlayFeature.Catalog);
  const isFileManagerEnabled = useUiFeature(OverlayFeature.FileManager);

  /* Routes absent from this map carry no UI-feature gate and always render. */
  const isRouteFeatureEnabled: Record<string, boolean> = {
    [ROUTES.Catalog]: isCatalogEnabled,
    [ROUTES.FileManager]: isFileManagerEnabled,
  };

  return NAVIGATION_CONFIG.filter(
    ({ path, featureFlag }) =>
      (isRouteFeatureEnabled[path] ?? true) &&
      (featureFlag == null ||
        (status === UserConfigStatus.Ready && features[featureFlag] === true)),
  );
};
