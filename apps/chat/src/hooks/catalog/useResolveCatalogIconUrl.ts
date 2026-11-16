import { useCallback } from 'react';
import { useAppConfig } from '../../context/AppConfigContext';
import { resolveCatalogIconUrl } from '../../utils/icon-path';

/** Returns `resolveCatalogIconUrl` bound to the configured themes base URL, so one icon resolves to one URL whichever form DIAL lists it in. */
export const useResolveCatalogIconUrl = (): ((
  iconUrl: string | undefined,
) => string | undefined) => {
  const themesBaseUrl = useAppConfig().config.themesBaseUrl;

  return useCallback(
    (iconUrl: string | undefined) =>
      resolveCatalogIconUrl(iconUrl, themesBaseUrl),
    [themesBaseUrl],
  );
};
