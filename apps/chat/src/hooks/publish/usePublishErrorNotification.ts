import {
  getApiErrorDetails,
  isPublishInProgressDetails,
  PublishTargetTakenError,
} from '@epam/ai-dial-chat-hooks';
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

/** Extra facts about the failed publish that pick its text. */
export interface PublishErrorOptions {
  /** Whether the published resource has a version, which a taken-path text then tells the user to change. */
  isVersioned?: boolean;
}

/**
 * Returns a handler that surfaces a failed publish or unpublish request as an
 * error notification. Wire it to `usePublishFlow`'s `onPublishError` so a
 * rejected publish is reported outside the panel too, not only through the
 * panel's inline callout. Shows the server-provided error message when the
 * response carries one, falling back to a generic message otherwise.
 *
 * A `PublishTargetTakenError` (the publish endpoint's `409` for a path another
 * resource already holds) gets the rename-or-choose-another-folder text instead
 * of Core's raw message, with the version part when `options.isVersioned`. The
 * `409` for an application that is already being published (code
 * `publish-in-progress`) gets its own translated text for the same reason.
 *
 * `operation` picks the copy. It defaults to publish, but an unpublish caller
 * must pass `EntityOperation.UnpublishRequested`: a failed unpublish used to be
 * reported as "Publish failed", which is what the user saw in
 * [#8445](https://github.com/epam/ai-dial-chat/issues/8445) after clicking
 * Unpublish.
 */
export const usePublishErrorNotification = (): ((
  error: unknown,
  operation?: EntityOperation,
  options?: PublishErrorOptions,
) => void) => {
  const { t } = useTranslation();
  const { showErrorNotification } = useNotification();

  return useCallback(
    (
      error: unknown,
      operation?: EntityOperation,
      options?: PublishErrorOptions,
    ) => {
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

      if (error instanceof PublishTargetTakenError) {
        const notifyTargetTaken = async () => {
          let traceId: string | undefined;
          try {
            ({ traceId } = await getApiErrorDetails(error.cause));
          } catch {
            /* The text is shown without a request ID when the cause cannot be read. */
          }
          showErrorNotification({
            title: t(copy.titleKey),
            message: t(
              options?.isVersioned
                ? PublishI18nKeys.TargetTakenVersionedMessage
                : PublishI18nKeys.TargetTakenMessage,
            ),
            requestId: traceId,
          });
        };
        void notifyTargetTaken();
        return;
      }

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
        const details = await getApiErrorDetails(error);
        const { message, traceId } = details;
        showErrorNotification({
          title: t(copy.titleKey),
          message: isPublishInProgressDetails(details)
            ? t(PublishI18nKeys.InProgressMessage)
            : (message ?? t(copy.messageKey)),
          requestId: traceId,
        });
      };

      void notify();
    },
    [showErrorNotification, t],
  );
};
