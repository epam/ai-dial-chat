import { ConfirmationPopup } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AuthI18nKeys,
  ButtonsI18nKeys,
} from '../../constants/translation-keys';
import { useLogout } from '../../hooks/logout/useLogout';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const LogoutConfirmationModal: FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { performLogout } = useLogout();

  return (
    <ConfirmationPopup
      open={isOpen}
      header={t(AuthI18nKeys.LogOutConfirmTitle)}
      description={t(AuthI18nKeys.LogOutConfirmDescription)}
      confirmLabel={t(ButtonsI18nKeys.LogOut)}
      onConfirm={performLogout}
      onCancel={onClose}
      onClose={onClose}
    />
  );
};

export default memo(LogoutConfirmationModal);
