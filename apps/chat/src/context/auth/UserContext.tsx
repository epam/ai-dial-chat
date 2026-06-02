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
import { onUnauthorized, UnauthorizedError } from '../../server-api/base';

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

  const bootstrap = useCallback(async (signal: { isCancelled: boolean }) => {
    setStatus('loading');
    try {
      const profile = await getMe();
      if (!signal.isCancelled) {
        setUser(profile);
        setStatus('authenticated');
      }
    } catch (err) {
      if (!signal.isCancelled) {
        if (!(err instanceof UnauthorizedError)) {
          console.error('UserContext bootstrap failed', err);
        }
        setUser(null);
        setStatus('unauthenticated');
      }
    }
  }, []);

  useEffect(() => {
    const signal = { isCancelled: false };
    bootstrap(signal);
    return () => {
      signal.isCancelled = true;
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
    await bootstrap({ isCancelled: false });
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
