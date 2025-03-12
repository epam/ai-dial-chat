import { signIn, useSession } from 'next-auth/react';
import { useCallback } from 'react';

import { customSignOut } from '@/src/utils/auth/signOut';

import { Routes } from '@/src/constants/routes';

export const useLogout = () => {
  const { data: session } = useSession();
  const handleLogout = useCallback(() => {
    session
      ? customSignOut({ redirect: true, callbackUrl: Routes.Chat })
      : signIn('azure-ad', { redirect: true });
  }, [session]);
  return {
    session,
    handleLogout,
  };
};
