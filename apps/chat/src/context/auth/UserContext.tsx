import { UserProfile } from '@epam/ai-dial-chat-shared';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getMe } from '../../server-api/auth.api';
import {
  clearCsrfToken,
  onUnauthorized,
  UnauthorizedError,
} from '../../server-api/base';
import { AuthStatus } from '../../types/auth-status';

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
        } else {
          clearCsrfToken();
        }
        setUser(null);
        setStatus(AuthStatus.Unauthenticated);
        return AuthStatus.Unauthenticated;
      }
    },
    [],
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
      clearCsrfToken();
      setUser(null);
      setStatus(AuthStatus.Unauthenticated);
    });
  }, []);

  const reset = useCallback(() => {
    clearCsrfToken();
    setUser(null);
    setStatus(AuthStatus.Unauthenticated);
  }, []);

  const refresh = useCallback(
    (options?: UserRefreshOptions): Promise<AuthStatus> =>
      bootstrap({ isCancelled: false }, options),
    [bootstrap],
  );

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
