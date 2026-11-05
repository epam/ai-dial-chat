import {
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
import { getPublishFolderLabel } from '../../utils/publish';
import { useOperationNotification } from '../useOperationNotification';

/** Parameters for {@link useResourceSaveNotification}. */
export interface UseResourceSaveNotificationParams {
  /** Display name, interpolated into notifications. */
  resourceName: string;
  /** Entity the success notifications name. */
  notifiableEntity: NotifiableEntity;
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
        showErrorNotification({
          message: t(ResourceSavePanelI18nKeys.SavedButPublishFailed, {
            name: resourceName,
          }),
        });
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
      resourceName,
      showErrorNotification,
      showSuccessNotification,
      t,
    ],
  );
};
