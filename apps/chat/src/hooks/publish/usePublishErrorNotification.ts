import { getApiErrorDetails } from '@epam/ai-dial-chat-hooks';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PublishI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { EntityOperation } from '../../types/entity-notification';

/** Copy for the operation whose request failed. */
interface PublishErrorCopy {
  titleKey: PublishI18nKeys;
  messageKey: PublishI18nKeys;
  networkMessageKey: PublishI18nKeys;
}

const PUBLISH_COPY: PublishErrorCopy = {
  titleKey: PublishI18nKeys.FailedTitle,
  messageKey: PublishI18nKeys.FailedMessage,
  networkMessageKey: PublishI18nKeys.NetworkErrorMessage,
};

const UNPUBLISH_COPY: PublishErrorCopy = {
  titleKey: PublishI18nKeys.UnpublishFailedTitle,
  messageKey: PublishI18nKeys.UnpublishFailedMessage,
  networkMessageKey: PublishI18nKeys.UnpublishNetworkErrorMessage,
};

/**
 * Returns a handler that surfaces a failed publish or unpublish request as an
 * error notification. Wire it to `usePublishFlow`'s `onPublishError` so a
 * rejected publish is reported outside the panel too, not only through the
 * panel's inline callout. Shows the server-provided error message when the
 * response carries one, falling back to a generic message otherwise.
 *
 * `operation` picks the copy. It defaults to publish, but an unpublish caller
 * must pass `EntityOperation.UnpublishRequested`: a failed unpublish used to be
 * reported as "Publish failed", which is what the user saw in
 * [GH #8445](https://github.com/epam/ai-dial-chat/issues/8445) after clicking
 * Unpublish.
 */
export const usePublishErrorNotification = (): ((
  error: unknown,
  operation?: EntityOperation,
) => void) => {
  const { t } = useTranslation();
  const { showErrorNotification } = useNotification();

  return useCallback(
    (error: unknown, operation?: EntityOperation) => {
      const copy =
        operation === EntityOperation.UnpublishRequested
          ? UNPUBLISH_COPY
          : PUBLISH_COPY;

      console.error(
        operation === EntityOperation.UnpublishRequested
          ? 'Unpublish request failed'
          : 'Publish request failed',
        error,
      );

      /*
       * An offline failure never reaches the backend, so it has no trace ID and
       * no server message — it gets its own copy telling the user to check the
       * connection, mirroring the attachment-upload network-error notification.
       */
      if (!navigator.onLine) {
        showErrorNotification({
          title: t(copy.titleKey),
          message: t(copy.networkMessageKey),
        });
        return;
      }

      const notify = async () => {
        const { message, traceId } = await getApiErrorDetails(error);
        showErrorNotification({
          title: t(copy.titleKey),
          message: message ?? t(copy.messageKey),
          requestId: traceId,
        });
      };

      void notify();
    },
    [showErrorNotification, t],
  );
};
