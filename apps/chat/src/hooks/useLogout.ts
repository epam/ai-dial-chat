import { signIn, signOut, useSession } from 'next-auth/react';
import { useCallback } from 'react';

export const useLogout = () => {
  const { data: session } = useSession();
  const handleLogout = useCallback(() => {
    session
      ? signOut({ redirect: true, callbackUrl: '/' })
      : signIn('azure-ad', { redirect: true });
  }, [session]);
  return {
    session,
    handleLogout,
  };
};
