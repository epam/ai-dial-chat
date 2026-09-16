import type { ProviderInfoDto } from '@epam/ai-dial-chat-api-client';
import { OverlayAuthUiMode } from '@epam/ai-dial-chat-overlay';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useOptionalOverlay } from '../../context/overlay/OverlayContext';
import { getProviders } from '../../server-api/auth.api';
import {
  hasRecentOverlayAutoSignInAttempt,
  rememberOverlayAutoSignInAttempt,
} from '../../utils/overlay-auto-sign-in';
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
  const overlay = useOptionalOverlay();
  const authProviderUiModes = overlay?.authProviderUiModes;
  const autoSignInProvider = overlay?.authAutoSignInProvider;
  const hasProviderConfiguration =
    authProviderUiModes !== undefined &&
    Object.keys(authProviderUiModes).length > 0;
  const [providers, setProviders] = useState<ProviderInfoDto[] | null>(null);
  const [isLoadingProviders, setIsLoadingProviders] = useState(
    hasProviderConfiguration,
  );
  const [hasProviderError, setHasProviderError] = useState(false);
  const [loadRequest, setLoadRequest] = useState(0);
  const hasAutoSignInRunRef = useRef(false);
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

  /*
   * Wrapped so wiring this straight into a component's `onClick` cannot leak
   * the handler's own argument into `openExternalLogin`'s optional `loginUrl`,
   * which would navigate the auth window to "[object Object]".
   */
  const openLogin = useCallback(() => {
    openExternalLogin();
  }, [openExternalLogin]);

  /*
   * Starts login for the host's `auth.autoSignInProvider` with no user
   * interaction, at most once per mount. Only the same-window mode qualifies:
   * it navigates the iframe itself, while the external mode calls
   * `window.open`, which a browser blocks outside a user gesture. Every
   * suppression leaves the ordinary gate rendered, because a misconfigured
   * host is a developer-facing problem and the gate is already a complete
   * fallback.
   *
   * The ref latches one evaluation per mount, covering React's double effect
   * invocation in development and the provider fetch settling after the first
   * run. A missing provider id does not latch: it usually just means the
   * handshake has not delivered `SET_OVERLAY_OPTIONS` yet.
   */
  useEffect(() => {
    if (hasAutoSignInRunRef.current) return;

    const providerId = autoSignInProvider?.trim();
    if (!providerId) return;

    if (!hasProviderConfiguration) {
      hasAutoSignInRunRef.current = true;
      console.warn(
        `Overlay auto sign-in skipped: provider "${providerId}" is not mapped to "${OverlayAuthUiMode.SameWindow}" in auth.providerUiModes.`,
      );
      return;
    }

    if (isLoadingProviders || providers == null) return;

    hasAutoSignInRunRef.current = true;

    if (!providers.some(({ id }) => id === providerId)) {
      console.warn(
        `Overlay auto sign-in skipped: provider "${providerId}" is not registered by the backend.`,
      );
      return;
    }

    if (getProviderUiMode(providerId) !== OverlayAuthUiMode.SameWindow) {
      console.warn(
        `Overlay auto sign-in skipped: provider "${providerId}" is not mapped to "${OverlayAuthUiMode.SameWindow}" in auth.providerUiModes.`,
      );
      return;
    }

    const { href } = window.location;
    if (hasRecentOverlayAutoSignInAttempt(href)) {
      console.warn(
        'Overlay auto sign-in skipped: an attempt for this URL was already started.',
      );
      return;
    }

    rememberOverlayAutoSignInAttempt(href);
    openProviderLogin(providerId);
  }, [
    autoSignInProvider,
    getProviderUiMode,
    hasProviderConfiguration,
    isLoadingProviders,
    openProviderLogin,
    providers,
  ]);

  return {
    hasProviderConfiguration,
    providers,
    isLoadingProviders,
    hasProviderError,
    retryLoadProviders,
    openProviderLogin,
    openLogin,
    externalLoginStatus,
  };
};
