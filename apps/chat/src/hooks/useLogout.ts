import { signIn, signOut, useSession } from 'next-auth/react';
import { useCallback } from 'react';

import { Routes } from '@/src/constants/routes';

export const useLogout = () => {
  const { data: session } = useSession();
  const handleLogout = useCallback(() => {
    session
      ? signOut({ redirect: true, callbackUrl: Routes.Chat })
      : signIn('azure-ad', { redirect: true });
  }, [session]);
  return {
    session,
    handleLogout,
  };
};
