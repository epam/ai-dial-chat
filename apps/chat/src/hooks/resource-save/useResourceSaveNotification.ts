import {
  getApiErrorDetails,
  ResourceSaveOutcome,
  SaveDestinationRoot,
  type ResourceSaveChoice,
  type ResourceSaveResult,
} from '@epam/ai-dial-chat-hooks';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CatalogI18nKeys,
  ResourceSavePanelI18nKeys,
} from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import {
  EntityOperation,
  type NotifiableEntity,
} from '../../types/entity-notification';
import type { CatalogNotifiableEntity } from '../../utils/entity-notification';
import { getPublishFolderLabel } from '../../utils/publish';
import { useOperationNotification } from '../useOperationNotification';

/**
 * Entities the Save panel saves: every catalog kind with Created, Edited and
 * PublishRequested copy. Models are published, never saved through the panel.
 */
export type SaveNotifiableEntity = Exclude<
  CatalogNotifiableEntity,
  NotifiableEntity.Model
>;

/** Parameters for {@link useResourceSaveNotification}. */
export interface UseResourceSaveNotificationParams {
  /** Display name, interpolated into notifications. */
  resourceName: string;
  /** Entity the success notifications name. */
  notifiableEntity: SaveNotifiableEntity;
  /** Schema display name, for `NotifiableEntity.SchemaApp` copy. */
  notificationType?: string;
}

/** Returns a callback that shows the notification for a finished Save panel run. */
export const useResourceSaveNotification = ({
  resourceName,
  notifiableEntity,
  notificationType,
}: UseResourceSaveNotificationParams) => {
  const { t } = useTranslation();
  const { showErrorNotification, showSuccessNotification } = useNotification();
  const { notifyOperationSuccess } = useOperationNotification();

  /* Names why the publish failed: a 409 means this version is already in that Organization folder. */
  const notifyPublishFailed = useCallback(
    async (error: unknown, folderPath: string[]) => {
      const { message, status, traceId } = await getApiErrorDetails(error);
      let text = t(ResourceSavePanelI18nKeys.SavedButPublishFailed, {
        name: resourceName,
      });
      if (status === 409) {
        text = t(ResourceSavePanelI18nKeys.SavedButAlreadyPublished, {
          name: resourceName,
          folder: getPublishFolderLabel(folderPath, t),
        });
      } else if (message) {
        text = t(ResourceSavePanelI18nKeys.SavedButPublishFailedReason, {
          name: resourceName,
          reason: message,
        });
      }
      showErrorNotification({ message: text, requestId: traceId });
    },
    [resourceName, showErrorNotification, t],
  );

  return useCallback(
    (result: ResourceSaveResult, choice: ResourceSaveChoice) => {
      const folderPath = choice.destination.path;
      const params = { name: resourceName, type: notificationType };
      if (result.outcome === ResourceSaveOutcome.SavedButMoveFailed) {
        // The Personal root has no path segments; name it as the folder tree does.
        const folder =
          choice.destination.rootKey === SaveDestinationRoot.Organization
            ? getPublishFolderLabel(folderPath, t)
            : (folderPath.at(-1) ?? t(CatalogI18nKeys.FolderPersonal));
        showErrorNotification({
          message: t(ResourceSavePanelI18nKeys.SavedButMoveFailed, {
            name: resourceName,
            folder,
          }),
        });
        return;
      }
      if (result.outcome === ResourceSaveOutcome.SavedButPublishFailed) {
        void notifyPublishFailed(result.error, folderPath);
        return;
      }
      if (result.isPublished) {
        notifyOperationSuccess(
          notifiableEntity,
          EntityOperation.PublishRequested,
          { ...params, folder: getPublishFolderLabel(folderPath, t) },
        );
        return;
      }
      if (result.isNewVersion) {
        showSuccessNotification({
          title: t(ResourceSavePanelI18nKeys.NewVersionSavedTitle),
          message: t(ResourceSavePanelI18nKeys.NewVersionSaved, {
            name: resourceName,
            version: choice.newVersion,
          }),
        });
        return;
      }
      notifyOperationSuccess(
        notifiableEntity,
        result.isCreated ? EntityOperation.Created : EntityOperation.Edited,
        params,
      );
    },
    [
      notifiableEntity,
      notificationType,
      notifyOperationSuccess,
      notifyPublishFailed,
      resourceName,
      showErrorNotification,
      showSuccessNotification,
      t,
    ],
  );
};
