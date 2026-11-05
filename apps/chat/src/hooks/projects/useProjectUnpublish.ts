import {
  useAsyncConfirmDialog,
  useUnpublishableFolders,
} from '@epam/ai-dial-chat-hooks';
import { useCallback, useMemo, useState } from 'react';
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

  const {
    isPending: isDialogOpen,
    isRunning: isUnpublishing,
    open: openDialog,
    close: closeDialog,
    confirm: confirmDialog,
  } = useAsyncConfirmDialog<{ id: string; name: string; folders: string[] }>();
  /* Set only when the project is published to more than one folder. */
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const requestUnpublish = useCallback(() => {
    if (projectId == null || folderOptions.length === 0) return;
    setSelectedFolder(null);
    openDialog({ id: projectId, name: projectName, folders: folderOptions });
  }, [folderOptions, openDialog, projectId, projectName]);

  const handleCloseDialog = useCallback(() => {
    if (isUnpublishing) return;
    closeDialog();
    setSelectedFolder(null);
  }, [closeDialog, isUnpublishing]);

  const handleConfirmDialog = useCallback(async () => {
    await confirmDialog(
      async ({ id, name, folders }) => {
        const folderPath =
          selectedFolder != null
            ? folders.find((folder) => folder === selectedFolder)
            : folders[0];
        /* `''` is the public root and must be sent; only "not found" aborts. */
        if (folderPath == null) return;

        try {
          await unpublishCatalogEntity(CatalogPublishEntityType.Project, id, {
            folderPath,
          });
        } catch (error) {
          showPublishError(error, EntityOperation.UnpublishRequested);
          /* Swallowed so confirm() closes the dialog instead of keeping it open. */
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
      () => '',
    );
    setSelectedFolder(null);
  }, [
    confirmDialog,
    notifyOperationSuccess,
    refreshPublishState,
    selectedFolder,
    showPublishError,
    t,
  ]);

  return useMemo(
    () => ({
      isPublishStateResolved,
      publishedFolders,
      refreshPublishState,
      requestUnpublish,
      dialog: {
        isOpen: isDialogOpen,
        name: projectName,
        folders: folderOptions,
        selectedFolder,
        onSelectedFolderChange: setSelectedFolder,
        isLoading: isUnpublishing,
        onConfirm: handleConfirmDialog,
        onClose: handleCloseDialog,
      },
    }),
    [
      folderOptions,
      handleCloseDialog,
      handleConfirmDialog,
      isDialogOpen,
      isPublishStateResolved,
      isUnpublishing,
      projectName,
      publishedFolders,
      refreshPublishState,
      requestUnpublish,
      selectedFolder,
    ],
  );
};
