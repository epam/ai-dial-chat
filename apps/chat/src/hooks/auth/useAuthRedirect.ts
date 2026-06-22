import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthStatus, useUser } from '../../context/auth/UserContext';
import { getProviders } from '../../server-api/auth.api';

export const AUTH_REDIRECT_ATTEMPT_STORAGE_KEY = 'chat.auth.redirectAttempt';

const AUTH_REDIRECT_ATTEMPT_TTL_MS = 60_000;

interface AuthRedirectAttempt {
  callbackUrl: string;
  createdAt: number;
}

const getRecentAuthRedirectAttempt = (
  callbackUrl: string,
): AuthRedirectAttempt | null => {
  try {
    const raw = window.sessionStorage.getItem(
      AUTH_REDIRECT_ATTEMPT_STORAGE_KEY,
    );
    if (!raw) return null;

    const attempt = JSON.parse(raw) as AuthRedirectAttempt;
    const isFresh =
      Date.now() - attempt.createdAt < AUTH_REDIRECT_ATTEMPT_TTL_MS;
    return isFresh && attempt.callbackUrl === callbackUrl ? attempt : null;
  } catch {
    return null;
  }
};

const rememberAuthRedirectAttempt = (callbackUrl: string): void => {
  window.sessionStorage.setItem(
    AUTH_REDIRECT_ATTEMPT_STORAGE_KEY,
    JSON.stringify({ callbackUrl, createdAt: Date.now() }),
  );
};

const clearAuthRedirectAttempt = (): void => {
  window.sessionStorage.removeItem(AUTH_REDIRECT_ATTEMPT_STORAGE_KEY);
};

/**
 * Centralises the unauthenticated redirect policy (design doc D3).
 * - Single provider → full browser navigation to the BFF login endpoint.
 * - Multiple providers → client-side navigate to /login picker.
 * - Already authenticated on /login → redirect to callbackUrl or /.
 * - Failed automatic login attempt → fall back to /login instead of looping.
 * Must NOT fetch providers or redirect when the current path is /login
 * (LoginPage owns its own provider fetch on that route).
 */
export const useAuthRedirect = () => {
  const { status } = useUser();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (status === AuthStatus.Loading) return;

    if (status === AuthStatus.Authenticated) {
      clearAuthRedirectAttempt();
    }

    if (status === 'authenticated' && pathname === '/login') {
      const callbackUrl = new URLSearchParams(search).get('callbackUrl');
      if (callbackUrl) {
        try {
          const parsed = new URL(callbackUrl);
          const currentOrigin = window.location.origin;
          if (parsed.origin === currentOrigin) {
            navigate(`${parsed.pathname}${parsed.search}${parsed.hash}`, {
              replace: true,
            });
            return;
          }
        } catch {
          // Fall through to the default app root.
        }
      }

      navigate('/', { replace: true });
      return;
    }

    if (status === AuthStatus.Unauthenticated && pathname !== '/login') {
      let cancelled = false;
      const rawCallbackUrl = `${window.location.origin}${pathname}${search}${hash}`;
      const callbackUrl = encodeURIComponent(rawCallbackUrl);

      if (getRecentAuthRedirectAttempt(rawCallbackUrl)) {
        navigate(`/login?callbackUrl=${callbackUrl}`, { replace: true });
        return;
      }

      const load = async () => {
        try {
          const providers = await getProviders();
          if (cancelled) return;
          if (providers.length === 1) {
            rememberAuthRedirectAttempt(rawCallbackUrl);
            window.location.assign(
              `/api/v1/auth/login/${encodeURIComponent(providers[0].id)}?callbackUrl=${callbackUrl}`,
            );
          } else if (providers.length > 1) {
            navigate(`/login?callbackUrl=${callbackUrl}`, { replace: true });
          }
        } catch {
          // If provider fetch fails, do nothing — user will see a blank gate
        }
      };

      load();

      return () => {
        cancelled = true;
      };
    }
    // unauthenticated on /login — LoginPage handles its own state, nothing to do
    return undefined;
  }, [status, pathname, search, hash, navigate]);
};
