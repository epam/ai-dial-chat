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
import {
  ApiEndpoints,
  get,
  onUnauthorized,
  setCsrfToken,
  UnauthorizedError,
} from '../../server-api/base';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface UserContextType {
  status: AuthStatus;
  user: UserProfile | null;
  refresh: () => Promise<void>;
  reset: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserProfile | null>(null);

  const bootstrap = useCallback(async (signal: { cancelled: boolean }) => {
    setStatus('loading');
    try {
      const profile = await get<UserProfile>(ApiEndpoints.AUTH_ME, {
        responseHandler: (res) => setCsrfToken(res.headers.get('x-csrf-token')),
      });
      if (!signal.cancelled) {
        setUser(profile);
        setStatus('authenticated');
      }
    } catch (err) {
      if (!signal.cancelled) {
        if (!(err instanceof UnauthorizedError)) {
          console.error('UserContext bootstrap failed', err);
        }
        setUser(null);
        setStatus('unauthenticated');
      }
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    bootstrap(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [bootstrap]);

  useEffect(() => {
    return onUnauthorized(() => {
      setUser(null);
      setStatus('unauthenticated');
    });
  }, []);

  const reset = useCallback(() => {
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const refresh = useCallback(async () => {
    await bootstrap({ cancelled: false });
  }, [bootstrap]);

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
