import { DialConfirmationPopup } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
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
  const navigate = useNavigate();
  const { reset } = useUser();
  const overlay = useOptionalOverlay();

  const handleConfirm = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout request failed', err);
    }
    reset();
    if (!overlay) {
      navigate(ROUTES.Login);
    }
  };

  return (
    <DialConfirmationPopup
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
