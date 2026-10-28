import {
  ProjectCreateErrorCode,
  type ProjectDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import { getApiErrorDetails, sanitizeFileName } from '@epam/ai-dial-chat-hooks';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ProjectsI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { useUserConfig } from '../../context/UserConfigContext';
import {
  deleteProject,
  downloadProjectArchive,
  downloadProjectContextFile,
} from '../../server-api/projects.api';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import { ROUTES } from '../../types/routes';
import { triggerBrowserDownload } from '../../utils/file-download';
import { useOperationNotification } from '../useOperationNotification';

/**
 * Side effects of the project view page for one loaded project: pin,
 * archive and context-file downloads, and the confirmed delete. They live
 * in one hook so the page stays a thin wiring layer and every action shares
 * the same toast and error handling. A delete that loses to a concurrent
 * change reloads the project through `onReload` instead of failing silently.
 *
 * @param project - The loaded project, or `null` while none is loaded.
 * @param onReload - Re-reads the project, e.g. `useProject().retry`.
 */
export const useProjectActions = (
  project: ProjectDetailsDto | null,
  onReload: () => void,
) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showErrorNotification } = useNotification();
  const { notifyOperationSuccess } = useOperationNotification();
  const { pinnedProjectIds, setPinnedProject, replacePinnedProjectId } =
    useUserConfig();
  const [isPinPending, setIsPinPending] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isPinned = project != null && pinnedProjectIds.includes(project.id);

  const showError = useCallback(
    async (err: unknown, key: ProjectsI18nKeys) => {
      const { traceId } = await getApiErrorDetails(err);
      showErrorNotification({ message: t(key), requestId: traceId });
    },
    [showErrorNotification, t],
  );

  const togglePin = useCallback(async () => {
    if (project == null) return;
    setIsPinPending(true);
    try {
      await setPinnedProject(project.id, !isPinned);
    } catch (err) {
      await showError(err, ProjectsI18nKeys.ActionsPinError);
    } finally {
      setIsPinPending(false);
    }
  }, [project, isPinned, setPinnedProject, showError]);

  const downloadArchive = useCallback(async () => {
    if (project == null) return;
    try {
      const response = await downloadProjectArchive(project.id);
      const savedName = await triggerBrowserDownload(
        response,
        `${sanitizeFileName(project.name)}.zip`,
      );
      notifyOperationSuccess(
        NotifiableEntity.Project,
        EntityOperation.Downloaded,
        { name: savedName },
      );
    } catch (err) {
      await showError(err, ProjectsI18nKeys.ActionsDownloadError);
    }
  }, [project, notifyOperationSuccess, showError]);

  const openFile = useCallback(
    async (fileName: string) => {
      if (project == null) return;
      try {
        const response = await downloadProjectContextFile(project.id, fileName);
        await triggerBrowserDownload(response, fileName);
      } catch (err) {
        await showError(err, ProjectsI18nKeys.ActionsDownloadError);
      }
    },
    [project, showError],
  );

  const requestDelete = useCallback(() => setIsDeleteOpen(true), []);
  const cancelDelete = useCallback(() => {
    if (!isDeleting) setIsDeleteOpen(false);
  }, [isDeleting]);

  const confirmDelete = useCallback(async () => {
    if (project == null) return;
    setIsDeleting(true);
    try {
      await deleteProject(project.id, project.etag);
      notifyOperationSuccess(
        NotifiableEntity.Project,
        EntityOperation.Deleted,
        {
          name: project.name,
        },
      );
      /* The BFF already removed the pin; mirror it so a recreated project of
       * the same name does not show as pinned. */
      replacePinnedProjectId(project.id, null);
      setIsDeleteOpen(false);
      /* Replace the deleted project's entry, so Back does not reopen it. */
      navigate(ROUTES.Projects, { replace: true });
    } catch (err) {
      const { code, traceId } = await getApiErrorDetails(err);
      if (code === ProjectCreateErrorCode.ProjectChanged) {
        setIsDeleteOpen(false);
        showErrorNotification({
          message: t(ProjectsI18nKeys.ErrorsChangedElsewhere),
          requestId: traceId,
        });
        onReload();
        return;
      }
      showErrorNotification({
        message: t(ProjectsI18nKeys.ActionsDeleteError),
        requestId: traceId,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [
    project,
    notifyOperationSuccess,
    replacePinnedProjectId,
    navigate,
    showErrorNotification,
    t,
    onReload,
  ]);

  return useMemo(
    () => ({
      isPinned,
      isPinPending,
      togglePin,
      downloadArchive,
      openFile,
      isDeleteOpen,
      isDeleting,
      requestDelete,
      cancelDelete,
      confirmDelete,
    }),
    [
      isPinned,
      isPinPending,
      togglePin,
      downloadArchive,
      openFile,
      isDeleteOpen,
      isDeleting,
      requestDelete,
      cancelDelete,
      confirmDelete,
    ],
  );
};
