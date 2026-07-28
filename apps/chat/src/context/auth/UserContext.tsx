import { UserProfile } from '@epam/ai-dial-chat-shared';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getMe } from '../../server-api/auth.api';
import {
  clearCsrfToken,
  onUnauthorized,
  UnauthorizedError,
} from '../../server-api/base';
import { AuthStatus } from '../../types/auth-status';
import { StorageKey } from '../../types/storage-key';
import { removeFromLocalStorage } from '../../utils/local-storage';

interface UserContextType {
  status: AuthStatus;
  user: UserProfile | null;
  refresh: (options?: UserRefreshOptions) => Promise<AuthStatus>;
  reset: () => void;
}

interface UserRefreshOptions {
  setLoading?: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>(AuthStatus.Loading);
  const [user, setUser] = useState<UserProfile | null>(null);

  /*
   * Shared by every path that invalidates the session (explicit logout, a
   * 401 from any API call, and an identity mismatch caught by the
   * revalidation checkpoint below) so identity-scoped Catalog preferences
   * never leak from one authenticated identity to the next on the same
   * browser. CatalogSortKey is a display preference with no ownership
   * semantics and is deliberately left untouched.
   */
  const invalidateSession = useCallback(() => {
    clearCsrfToken();
    removeFromLocalStorage(StorageKey.CatalogFilterTopics);
    removeFromLocalStorage(StorageKey.CatalogIsMyAppsActive);
    setUser(null);
    setStatus(AuthStatus.Unauthenticated);
  }, []);

  const bootstrap = useCallback(
    async (signal: { isCancelled: boolean }, options?: UserRefreshOptions) => {
      if (options?.setLoading !== false) {
        setStatus(AuthStatus.Loading);
      }
      try {
        const profile = await getMe();
        if (signal.isCancelled) {
          return AuthStatus.Loading;
        }
        setUser(profile);
        setStatus(AuthStatus.Authenticated);
        return AuthStatus.Authenticated;
      } catch (err) {
        if (signal.isCancelled) {
          return AuthStatus.Loading;
        }
        if (!(err instanceof UnauthorizedError)) {
          /*
           * Keep CSRF across transient bootstrap failures; mutating requests
           * re-prime it through the invalid-CSRF retry path if it became stale.
           */
          console.error('UserContext bootstrap failed', err);
          setUser(null);
          setStatus(AuthStatus.Unauthenticated);
        } else {
          invalidateSession();
        }
        return AuthStatus.Unauthenticated;
      }
    },
    [invalidateSession],
  );

  useEffect(() => {
    const signal = { isCancelled: false };
    bootstrap(signal);
    return () => {
      signal.isCancelled = true;
    };
  }, [bootstrap]);

  useEffect(() => {
    return onUnauthorized(() => {
      invalidateSession();
    });
  }, [invalidateSession]);

  const reset = useCallback(() => {
    invalidateSession();
  }, [invalidateSession]);

  const refresh = useCallback(
    (options?: UserRefreshOptions): Promise<AuthStatus> =>
      bootstrap({ isCancelled: false }, options),
    [bootstrap],
  );

  /*
   * Read through refs inside the focus/visibility handler so the listeners
   * below don't need to be re-registered on every status/user change.
   */
  const statusRef = useRef(status);
  const userRef = useRef(user);
  const isRevalidatingRef = useRef(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    const revalidate = async () => {
      if (
        statusRef.current !== AuthStatus.Authenticated ||
        isRevalidatingRef.current
      ) {
        return;
      }
      isRevalidatingRef.current = true;
      try {
        const profile = await getMe();
        if (profile.sub === userRef.current?.sub) {
          setUser(profile);
          return;
        }
        invalidateSession();
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          invalidateSession();
        } else {
          console.error('UserContext identity revalidation failed', err);
        }
      } finally {
        isRevalidatingRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void revalidate();
      }
    };
    const handleFocus = () => {
      void revalidate();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [invalidateSession]);

  return (
    <UserContext.Provider
      value={useMemo(
        () => ({ status, user, refresh, reset }),
        [status, user, refresh, reset],
      )}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
