import { useCallback, useMemo } from 'react';
import { useAppConfig } from '../../context/AppConfigContext';
import { matchesAllowedOrigin } from '../../utils/overlay-origin';

/** Loads external PDFs with browser credentials only for configured connection origins. */
export const usePdfPreviewLoader = (): ((url: string) => Promise<Blob>) => {
  const { config } = useAppConfig();
  const allowedOrigins = useMemo(
    () =>
      (config.allowedConnectOrigins ?? []).flatMap((origin) => {
        try {
          /*
           * Some browsers serialize a wildcard hostname's * as %2A. Normalize
           * only the base origin, then restore the pattern for the matcher.
           */
          const isWildcard = /^https?:\/\/\*\./.test(origin);
          const normalized = new URL(
            isWildcard ? origin.replace('://*.', '://') : origin,
          );
          return [
            isWildcard
              ? `${normalized.protocol}//*.${normalized.host}`
              : normalized.origin,
          ];
        } catch {
          return [];
        }
      }),
    [config.allowedConnectOrigins],
  );

  return useCallback(
    async (url: string) => {
      const target = new URL(url, window.location.href);
      const useExternalCredentials =
        (target.protocol === 'https:' || target.protocol === 'http:') &&
        target.origin !== window.location.origin &&
        matchesAllowedOrigin(target.origin, allowedOrigins);

      /*
       * Fetch cannot validate each redirect destination before sending cookies.
       * Credentialed cross-origin requests must return the document directly.
       */
      const response = await fetch(
        url,
        useExternalCredentials
          ? { credentials: 'include', redirect: 'error' }
          : { credentials: 'same-origin' },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.blob();
    },
    [allowedOrigins],
  );
};
