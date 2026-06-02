import { DialConfirmationPopup } from '@epam/ai-dial-ui-kit';
import { useTranslation } from 'react-i18next';
import { AuthI18nKeys } from '../../constants/translation-keys';
import { ApiEndpoints } from '../../server-api/base';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LogoutConfirmationModal({ open, onClose }: Props) {
  const { t } = useTranslation();

  const handleConfirm = () => {
    window.location.href = ApiEndpoints.AUTH_LOGOUT;
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
