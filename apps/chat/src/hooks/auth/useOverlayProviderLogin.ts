import { OverlayAuthUiMode } from '@epam/ai-dial-chat-overlay';
import type { ProviderInfoDto } from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useState } from 'react';
import { useOptionalOverlay } from '../../context/overlay/OverlayContext';
import { getProviders } from '../../server-api/auth.api';
import {
  OverlayExternalLoginStatus,
  useOverlayExternalLogin,
} from './useOverlayExternalLogin';

interface OverlayProviderLogin {
  hasProviderConfiguration: boolean;
  providers: ProviderInfoDto[] | null;
  isLoadingProviders: boolean;
  hasProviderError: boolean;
  retryLoadProviders: () => void;
  openProviderLogin: (providerId: string) => void;
  openLogin: () => void;
  externalLoginStatus: OverlayExternalLoginStatus;
}

const buildProviderLoginUrl = (
  providerId: string,
  callbackUrl: string,
): string =>
  `/api/v1/auth/login/${encodeURIComponent(
    providerId,
  )}?callbackUrl=${encodeURIComponent(callbackUrl)}`;

/**
 * Keeps provider discovery and per-provider overlay navigation at the app
 * edge while reusing the established external-login polling lifecycle.
 */
export const useOverlayProviderLogin = (): OverlayProviderLogin => {
  const authProviderUiModes = useOptionalOverlay()?.authProviderUiModes;
  const hasProviderConfiguration =
    authProviderUiModes !== undefined &&
    Object.keys(authProviderUiModes).length > 0;
  const [providers, setProviders] = useState<ProviderInfoDto[] | null>(null);
  const [isLoadingProviders, setIsLoadingProviders] = useState(
    hasProviderConfiguration,
  );
  const [hasProviderError, setHasProviderError] = useState(false);
  const [loadRequest, setLoadRequest] = useState(0);
  const {
    status: externalLoginStatus,
    openLogin: openExternalLogin,
    cancelLogin: cancelExternalLogin,
  } = useOverlayExternalLogin();

  useEffect(() => {
    if (!hasProviderConfiguration) {
      setProviders(null);
      setIsLoadingProviders(false);
      setHasProviderError(false);
      return;
    }

    let isCancelled = false;
    const loadProviders = async () => {
      setIsLoadingProviders(true);
      setHasProviderError(false);
      try {
        const nextProviders = await getProviders();
        if (!isCancelled) {
          setProviders(nextProviders);
        }
      } catch {
        if (!isCancelled) {
          setProviders(null);
          setHasProviderError(true);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingProviders(false);
        }
      }
    };

    loadProviders();
    return () => {
      isCancelled = true;
    };
  }, [hasProviderConfiguration, loadRequest]);

  const retryLoadProviders = useCallback(() => {
    setLoadRequest((request) => request + 1);
  }, []);

  const getProviderUiMode = useCallback(
    (providerId: string): OverlayAuthUiMode =>
      authProviderUiModes?.[providerId] === OverlayAuthUiMode.SameWindow
        ? OverlayAuthUiMode.SameWindow
        : OverlayAuthUiMode.External,
    [authProviderUiModes],
  );

  const openProviderLogin = useCallback(
    (providerId: string) => {
      const mode = getProviderUiMode(providerId);
      if (mode === OverlayAuthUiMode.SameWindow) {
        cancelExternalLogin();
        window.location.assign(
          buildProviderLoginUrl(providerId, window.location.href),
        );
        return;
      }
      openExternalLogin(
        buildProviderLoginUrl(
          providerId,
          `${window.location.origin}/overlay-close`,
        ),
      );
    },
    [cancelExternalLogin, getProviderUiMode, openExternalLogin],
  );

  return {
    hasProviderConfiguration,
    providers,
    isLoadingProviders,
    hasProviderError,
    retryLoadProviders,
    openProviderLogin,
    openLogin: openExternalLogin,
    externalLoginStatus,
  };
};
