import { DialConfirmationPopup } from '@epam/ai-dial-ui-kit';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { AuthI18nKeys } from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { logout } from '../../server-api/auth.api';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LogoutConfirmationModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { reset } = useUser();

  const handleConfirm = async () => {
    await logout();
    reset();
    navigate(ROUTES.LOGIN);
  };

  return (
    <DialConfirmationPopup
      open={open}
      header={t(AuthI18nKeys.LogOutConfirmTitle)}
      description={t(AuthI18nKeys.LogOutConfirmDescription)}
      confirmLabel={t(AuthI18nKeys.LogOutConfirm)}
      onConfirm={handleConfirm}
      onCancel={onClose}
      onClose={onClose}
    />
  );
}
