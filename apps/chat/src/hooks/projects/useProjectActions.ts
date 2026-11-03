import type { ProjectDetailsDto } from '@epam/ai-dial-chat-api-client';
import {
  ProjectActionError,
  useProjectActions as useSharedProjectActions,
} from '@epam/ai-dial-chat-hooks/project';
import { triggerBrowserDownload } from '@epam/ai-dial-chat-hooks/utils';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ProjectsI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { useUserConfig } from '../../context/UserConfigContext';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import { ROUTES } from '../../types/routes';
import { useOperationNotification } from '../useOperationNotification';
import { projectsClient } from './projects-client';

const ERROR_MESSAGES: Record<ProjectActionError, ProjectsI18nKeys> = {
  [ProjectActionError.Pin]: ProjectsI18nKeys.ActionsPinError,
  [ProjectActionError.Download]: ProjectsI18nKeys.ActionsDownloadError,
  [ProjectActionError.Delete]: ProjectsI18nKeys.ActionsDeleteError,
  [ProjectActionError.ChangedElsewhere]:
    ProjectsI18nKeys.ErrorsChangedElsewhere,
};

/** How the app's project actions behave around a delete. */
interface ProjectActionsOptions {
  /** Leaves for the Projects list after a delete; `false` keeps the current route. Defaults to `true`. */
  leaveOnDelete?: boolean;
}

/**
 * App adapter of the shared `useProjectActions`: pins through the user
 * config, toasts through the notification context, and leaves for the
 * Projects list after a delete unless `leaveOnDelete` is `false`.
 *
 * @param project - The loaded project, or `null` while none is loaded.
 * @param onReload - Re-reads the project, e.g. `useProject().retry`.
 * @param options - Delete behaviour; leaves for the Projects list by default.
 */
export const useProjectActions = (
  project: ProjectDetailsDto | null,
  onReload: () => void,
  { leaveOnDelete = true }: ProjectActionsOptions = {},
) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showErrorNotification } = useNotification();
  const { notifyOperationSuccess } = useOperationNotification();
  const { pinnedProjectIds, setPinnedProject, replacePinnedProjectId } =
    useUserConfig();

  const handleArchiveDownloaded = useCallback(
    (savedName: string) =>
      notifyOperationSuccess(
        NotifiableEntity.Project,
        EntityOperation.Downloaded,
        { name: savedName },
      ),
    [notifyOperationSuccess],
  );
  const handleDeleted = useCallback(
    (deleted: ProjectDetailsDto) => {
      notifyOperationSuccess(
        NotifiableEntity.Project,
        EntityOperation.Deleted,
        {
          name: deleted.name,
        },
      );
      /* The BFF already removed the pin; mirror it so a recreated project of
       * the same name does not show as pinned. */
      replacePinnedProjectId(deleted.id, null);
      if (!leaveOnDelete) return;
      /* Replace the deleted project's entry, so Back does not reopen it. */
      navigate(ROUTES.Projects, { replace: true });
    },
    [leaveOnDelete, navigate, notifyOperationSuccess, replacePinnedProjectId],
  );
  const handleError = useCallback(
    (error: ProjectActionError, requestId?: string) =>
      showErrorNotification({ message: t(ERROR_MESSAGES[error]), requestId }),
    [showErrorNotification, t],
  );

  return useSharedProjectActions(projectsClient, project, {
    isPinned: project != null && pinnedProjectIds.includes(project.id),
    setPinned: setPinnedProject,
    saveFile: triggerBrowserDownload,
    onArchiveDownloaded: handleArchiveDownloaded,
    onDeleted: handleDeleted,
    onError: handleError,
    onReload,
  });
};
