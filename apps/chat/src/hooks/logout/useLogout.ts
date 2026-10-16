import { useCallback, useState } from 'react';
import { useUser } from '../../context/auth/UserContext';
import { useOptionalOverlay } from '../../context/overlay/OverlayContext';
import { logout } from '../../server-api/auth.api';
import { ROUTES } from '../../types/routes';

export const useLogout = () => {
  const { reset } = useUser();
  const overlay = useOptionalOverlay();
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const openLogout = useCallback(() => setIsLogoutOpen(true), []);
  const closeLogout = useCallback(() => setIsLogoutOpen(false), []);

  /*
   * Signs the user out. Shared by the "Log out?" confirmation and the
   * unsaved-changes dialog's Discard changes, which logs out directly.
   */
  const performLogout = useCallback(async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout request failed', err);
    }
    if (overlay) {
      reset();
      return;
    }
    /*
     * Full document load, not a client-side navigate: the SPA route would
     * lazy-import the Login chunk by the hash this long-lived tab was built
     * with, which a redeploy since then has removed — the import fails and
     * the root error boundary replaces the page ([#9254](https://github.com/epam/ai-dial-chat/issues/9254)). A fresh
     * index.html always references the current chunks, and it also drops
     * every piece of the signed-out user's in-memory state. `reset()` is
     * skipped on purpose: an Unauthenticated status would let
     * useAuthRedirect start a single-provider SSO redirect that races
     * this navigation and signs the user straight back in.
     */
    window.location.replace(ROUTES.Login);
  }, [overlay, reset]);

  return { isLogoutOpen, openLogout, closeLogout, performLogout };
};
