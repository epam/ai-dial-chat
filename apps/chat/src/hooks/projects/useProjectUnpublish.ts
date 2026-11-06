import {
  type UnpublishConfirmationPayload,
  useUnpublishableFolders,
  useUnpublishConfirmation,
} from '@epam/ai-dial-chat-hooks';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CatalogPublishEntityType,
  publishApiClient,
  unpublishCatalogEntity,
} from '../../server-api/publish.api';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import { getPublishFolderLabel } from '../../utils/publish';
import { usePublishErrorNotification } from '../publish/usePublishErrorNotification';
import { useOperationNotification } from '../useOperationNotification';

/** The loaded project fields `useProjectUnpublish` reads. */
interface UnpublishableProject {
  /** The project's DIAL Core id, e.g. `projects/{bucket}/{name}`. */
  id: string;
  /** The project name, shown in the confirmation and the notification. */
  name: string;
  /** Whether the caller owns the project (rename, delete, share, publish). */
  canManage: boolean;
}

/** Inputs of `useProjectUnpublish`. */
interface Params {
  /** The loaded project, or `null` while it loads. */
  project: UnpublishableProject | null;
  /** Whether the session user is a DIAL administrator. */
  isAdmin: boolean;
}

const joinFolder = (folderPath: string[]): string => folderPath.join('/');

/**
 * Owns the project view page's unpublish state: which folders the caller may
 * unpublish the project from, the confirmation dialog, and the request. The
 * page passes Publish or Unpublish to `ProjectView` only once
 * `isPublishStateResolved`, so the header never shows Publish and then swaps
 * it for Unpublish while the lookup runs.
 */
export const useProjectUnpublish = ({ project, isAdmin }: Params) => {
  const { t } = useTranslation();
  const { notifyOperationSuccess } = useOperationNotification();
  const showPublishError = usePublishErrorNotification();

  const projectId = project?.id ?? null;
  const projectName = project?.name ?? '';
  const canManage = project?.canManage ?? false;

  /* Who may unpublish is decided in chat-hooks; this hook adds the dialog, the request and the toasts. */
  const target = useMemo(
    () =>
      projectId == null
        ? null
        : {
            entityType: CatalogPublishEntityType.Project,
            entityId: projectId,
            isOwner: canManage,
          },
    [canManage, projectId],
  );
  const {
    isResolved: isPublishStateResolved,
    folders: publishedFolders,
    refresh: refreshPublishState,
  } = useUnpublishableFolders(publishApiClient, target, isAdmin);
  const folderOptions = useMemo(
    () => publishedFolders.map(joinFolder),
    [publishedFolders],
  );

  const runUnpublish = useCallback(
    async (
      { id, name }: UnpublishConfirmationPayload & { id: string },
      folderPath: string,
    ) => {
      try {
        await unpublishCatalogEntity(CatalogPublishEntityType.Project, id, {
          folderPath,
        });
      } catch (error) {
        showPublishError(error, EntityOperation.UnpublishRequested);
        /* Swallowed so the dialog closes instead of staying open. */
        return;
      }

      notifyOperationSuccess(
        NotifiableEntity.Project,
        EntityOperation.UnpublishRequested,
        { name, folder: getPublishFolderLabel(folderPath, t) },
      );
      /* The removal is pending, so the folder stays live until an admin approves. */
      refreshPublishState();
    },
    [notifyOperationSuccess, refreshPublishState, showPublishError, t],
  );
  const { open: openDialog, dialog } = useUnpublishConfirmation(runUnpublish);

  const requestUnpublish = useCallback(() => {
    if (projectId == null || folderOptions.length === 0) return;
    openDialog({ id: projectId, name: projectName, folders: folderOptions });
  }, [folderOptions, openDialog, projectId, projectName]);

  return useMemo(
    () => ({
      isPublishStateResolved,
      publishedFolders,
      refreshPublishState,
      requestUnpublish,
      dialog,
    }),
    [
      dialog,
      isPublishStateResolved,
      publishedFolders,
      refreshPublishState,
      requestUnpublish,
    ],
  );
};
