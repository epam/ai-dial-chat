import { useCallback, useState } from 'react';

export const useLogout = () => {
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const openLogout = useCallback(() => setIsLogoutOpen(true), []);
  const closeLogout = useCallback(() => setIsLogoutOpen(false), []);
  return { isLogoutOpen, openLogout, closeLogout };
};
