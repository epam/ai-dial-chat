import { ConfirmationPopup } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AuthI18nKeys,
  ButtonsI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useOptionalOverlay } from '../../context/overlay/OverlayContext';
import { logout } from '../../server-api/auth.api';
import { ROUTES } from '../../types/routes';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const LogoutConfirmationModal: FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { reset } = useUser();
  const overlay = useOptionalOverlay();

  const handleConfirm = async () => {
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
  };

  return (
    <ConfirmationPopup
      open={isOpen}
      header={t(AuthI18nKeys.LogOutConfirmTitle)}
      description={t(AuthI18nKeys.LogOutConfirmDescription)}
      confirmLabel={t(ButtonsI18nKeys.LogOut)}
      onConfirm={handleConfirm}
      onCancel={onClose}
      onClose={onClose}
    />
  );
};

export default memo(LogoutConfirmationModal);
