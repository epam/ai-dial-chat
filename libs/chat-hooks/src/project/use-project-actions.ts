import {
  ProjectCreateErrorCode,
  type ProjectDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import { useCallback, useMemo, useState } from 'react';
import { getApiErrorDetails } from '../api-error/api-error';
import { sanitizeFileName } from '../files/file-name';
import type { ProjectsApiClient } from './projects-api-client';

/** Which project action failed, for the host's error message. */
export enum ProjectActionError {
  Pin = 'pin',
  Download = 'download',
  Delete = 'delete',
  /** The delete lost to a concurrent change; the project should be reloaded. */
  ChangedElsewhere = 'changed-elsewhere',
}

/** Host behaviour the project actions delegate to. */
export interface ProjectActionsHandlers {
  /** Whether the project is in the caller's pins. */
  isPinned: boolean;
  /** Persists the pin state; rejects on failure. */
  setPinned: (projectId: string, isPinned: boolean) => Promise<void>;
  /** Saves a downloaded response as a file and resolves the saved name. */
  saveFile: (response: Response, fileName: string) => Promise<string>;
  /** Called after the archive was saved, with the saved file name. */
  onArchiveDownloaded?: (savedName: string) => void;
  /** Called after the project was deleted; the host updates pins and navigates away. */
  onDeleted: (project: ProjectDetailsDto) => void;
  /** Called with a failed action and its trace id; the host shows the message. */
  onError: (error: ProjectActionError, requestId?: string) => void;
  /** Re-reads the project, e.g. after a delete lost to a concurrent change. */
  onReload: () => void;
  /** Whether the delete confirmation is open, when the host owns that state. Defaults to the hook's own state. */
  isDeleteOpen?: boolean;
  /** Called with the new state whenever the delete confirmation opens or closes: a request, a cancel, a success or a conflict. */
  onDeleteOpenChange?: (isOpen: boolean) => void;
}

/**
 * Pin, archive and context-file downloads, and the confirmed delete of one
 * loaded project, with their in-flight state. Messages, notifications, pins
 * and navigation stay with the host through `handlers`.
 *
 * @param client - Configured project requests, from `createProjectsApiClient`.
 * @param project - The loaded project, or `null` while none is loaded.
 * @param handlers - Host behaviour the actions delegate to.
 */
export const useProjectActions = (
  client: Pick<ProjectsApiClient, 'deleteProject' | 'downloadProjectArchive'>,
  project: ProjectDetailsDto | null,
  {
    isPinned,
    setPinned,
    saveFile,
    onArchiveDownloaded,
    onDeleted,
    onError,
    onReload,
    isDeleteOpen: controlledDeleteOpen,
    onDeleteOpenChange,
  }: ProjectActionsHandlers,
) => {
  const [isPinPending, setIsPinPending] = useState(false);
  const [ownDeleteOpen, setOwnDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /* A host that passes `isDeleteOpen` owns the dialog state; the hook then
     only reports the changes it would have made. */
  const isDeleteControlled = controlledDeleteOpen != null;
  const isDeleteOpen = controlledDeleteOpen ?? ownDeleteOpen;
  const setIsDeleteOpen = useCallback(
    (isOpen: boolean) => {
      if (!isDeleteControlled) setOwnDeleteOpen(isOpen);
      onDeleteOpenChange?.(isOpen);
    },
    [isDeleteControlled, onDeleteOpenChange],
  );

  const reportError = useCallback(
    async (err: unknown, error: ProjectActionError) => {
      const { traceId } = await getApiErrorDetails(err);
      onError(error, traceId);
    },
    [onError],
  );

  const togglePin = useCallback(async () => {
    if (project == null) return;
    setIsPinPending(true);
    try {
      await setPinned(project.id, !isPinned);
    } catch (err) {
      await reportError(err, ProjectActionError.Pin);
    } finally {
      setIsPinPending(false);
    }
  }, [project, isPinned, setPinned, reportError]);

  const downloadArchive = useCallback(async () => {
    if (project == null) return;
    try {
      const response = await client.downloadProjectArchive(project.id);
      const savedName = await saveFile(
        response,
        `${sanitizeFileName(project.name)}.zip`,
      );
      onArchiveDownloaded?.(savedName);
    } catch (err) {
      await reportError(err, ProjectActionError.Download);
    }
  }, [client, project, saveFile, onArchiveDownloaded, reportError]);

  const requestDelete = useCallback(
    () => setIsDeleteOpen(true),
    [setIsDeleteOpen],
  );
  const cancelDelete = useCallback(() => {
    if (!isDeleting) setIsDeleteOpen(false);
  }, [isDeleting, setIsDeleteOpen]);

  const confirmDelete = useCallback(async () => {
    if (project == null) return;
    setIsDeleting(true);
    try {
      await client.deleteProject(project.id, project.contentVersion);
      setIsDeleteOpen(false);
      onDeleted(project);
    } catch (err) {
      const { code, traceId } = await getApiErrorDetails(err);
      if (code === ProjectCreateErrorCode.ProjectChanged) {
        setIsDeleteOpen(false);
        onError(ProjectActionError.ChangedElsewhere, traceId);
        onReload();
        return;
      }
      onError(ProjectActionError.Delete, traceId);
    } finally {
      setIsDeleting(false);
    }
  }, [client, project, setIsDeleteOpen, onDeleted, onError, onReload]);

  return useMemo(
    () => ({
      isPinned,
      isPinPending,
      togglePin,
      downloadArchive,
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
      isDeleteOpen,
      isDeleting,
      requestDelete,
      cancelDelete,
      confirmDelete,
    ],
  );
};
