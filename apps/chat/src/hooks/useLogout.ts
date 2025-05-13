import { signIn, useSession } from 'next-auth/react';
import { useCallback } from 'react';

import { customSignOut } from '@/src/utils/auth/signOut';

export const useLogout = () => {
  const { data: session } = useSession();
  const handleLogout = useCallback(() => {
    session ? customSignOut() : signIn('azure-ad', { redirect: true });
  }, [session]);
  return {
    session,
    handleLogout,
  };
};
