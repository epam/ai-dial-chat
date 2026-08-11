import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PublishI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { getApiErrorDetails } from '../../server-api/api-error';

/**
 * Returns a handler that surfaces a failed publish request as an error
 * notification. Wire it to `usePublishFlow`'s `onPublishError` so a rejected
 * publish is reported outside the panel too, not only through the panel's
 * inline callout.
 */
export const usePublishErrorNotification = (): ((error: unknown) => void) => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();

  return useCallback(
    (error: unknown) => {
      console.error('Publish request failed', error);

      /*
       * An offline failure never reaches the backend, so it has no trace ID and
       * no server message — it gets its own copy telling the user to check the
       * connection, mirroring the attachment-upload network-error notification.
       */
      if (!navigator.onLine) {
        showNotification({
          variant: NotificationVariant.Error,
          title: t(PublishI18nKeys.FailedTitle),
          message: t(PublishI18nKeys.NetworkErrorMessage),
        });
        return;
      }

      const notify = async () => {
        const { traceId } = await getApiErrorDetails(error);
        showNotification({
          variant: NotificationVariant.Error,
          title: t(PublishI18nKeys.FailedTitle),
          message: t(PublishI18nKeys.FailedMessage),
          requestId: traceId,
        });
      };

      void notify();
    },
    [showNotification, t],
  );
};
