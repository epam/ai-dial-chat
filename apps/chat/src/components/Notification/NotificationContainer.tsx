import { NotificationStack } from '@epam/ai-dial-chat-shared';
import { memo, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { NotificationI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';

/*
 * The app's toast stack: `NotificationStack` at its default bottom-end
 * placement, which at z-70 draws over the bottom-end TransferQueue panels
 * (z-51); the overlap is accepted because toasts are transient and closable.
 */
const NotificationContainer: FC = () => {
  const { t } = useTranslation();
  const { notifications, dismissNotification } = useNotification();
  const labels = useMemo(
    () => ({
      requestId: t(NotificationI18nKeys.RequestIdLabel),
      copyRequestIdAriaLabel: t(NotificationI18nKeys.RequestIdCopyAriaLabel),
      requestIdCopied: t(NotificationI18nKeys.RequestIdCopiedStatus),
      requestIdCopyFailed: t(NotificationI18nKeys.RequestIdCopyFailedStatus),
    }),
    [t],
  );

  return (
    <NotificationStack
      items={notifications}
      onDismiss={dismissNotification}
      labels={labels}
    />
  );
};

export default memo(NotificationContainer);
