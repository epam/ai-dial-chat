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
import { AuthStatus } from '../../types/auth-status';

interface UserContextType {
  status: AuthStatus;
  user: UserProfile | null;
  refresh: () => Promise<void>;
  reset: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>(AuthStatus.Loading);
  const [user, setUser] = useState<UserProfile | null>(null);

  const bootstrap = useCallback(async (signal: { isCancelled: boolean }) => {
    setStatus(AuthStatus.Loading);
    try {
      const profile = await getMe();
      if (!signal.isCancelled) {
        setUser(profile);
        setStatus(AuthStatus.Authenticated);
      }
    } catch (err) {
      if (!signal.isCancelled) {
        if (!(err instanceof UnauthorizedError)) {
          console.error('UserContext bootstrap failed', err);
        }
        setUser(null);
        setStatus(AuthStatus.Unauthenticated);
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
      setStatus(AuthStatus.Unauthenticated);
    });
  }, []);

  const reset = useCallback(() => {
    setUser(null);
    setStatus(AuthStatus.Unauthenticated);
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
