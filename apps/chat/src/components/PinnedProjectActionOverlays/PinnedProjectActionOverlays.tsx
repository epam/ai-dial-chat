import { memo, useCallback, useEffect, type FC } from 'react';
import type { PinnedProjectActionOverlay } from '../../hooks/projects/usePinnedProjectsPanel';
import { useProjectActions } from '../../hooks/projects/useProjectActions';
import { PinnedProjectActionKind } from '../../types/pinned-project-action';
import ProjectDeleteConfirmation from '../ProjectDeleteConfirmation/ProjectDeleteConfirmation';
import ProjectShareOverlay from '../ProjectShareOverlay/ProjectShareOverlay';
import PublishProjectPanelContainer from '../PublishProjectPanelContainer/PublishProjectPanelContainer';

type Props = PinnedProjectActionOverlay;

/**
 * The overlays a pinned project's sidebar ⋮ menu opens: the publish panel,
 * the share popover and the delete confirmation, with the copy and behaviour
 * of the project view page. A delete leaves the route only while it shows
 * that project.
 */
const PinnedProjectActionOverlays: FC<Props> = ({
  action,
  project,
  routeProjectId,
  returnFocusRef,
  onClose,
  onProjectChanged,
}) => {
  const isOpenAction = (kind: PinnedProjectActionKind) =>
    action?.kind === kind && action.isOpen && project != null;

  const deleteTarget = isOpenAction(PinnedProjectActionKind.Delete)
    ? project
    : null;
  const deleteTargetId = deleteTarget?.id;
  const handleReload = useCallback(() => {
    if (deleteTargetId != null) onProjectChanged(deleteTargetId);
  }, [deleteTargetId, onProjectChanged]);
  /* The action owns the dialog's open state: it opens the dialog, and any
     way the dialog closes — cancel, success or a conflict — ends the action. */
  const handleDeleteOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) onClose();
    },
    [onClose],
  );
  const { cancelDelete, confirmDelete, isDeleteOpen, isDeleting } =
    useProjectActions(deleteTarget, handleReload, {
      leaveOnDelete:
        deleteTargetId != null && deleteTargetId === routeProjectId,
      isDeleteOpen: deleteTarget != null,
      onDeleteOpenChange: handleDeleteOpenChange,
    });

  /* A project that left the tree (unpinned or deleted elsewhere) ends its
     action, so it cannot reopen by itself if the project comes back. */
  const isActionOpen = action?.isOpen === true;
  const hasProject = project != null;
  useEffect(() => {
    if (isActionOpen && !hasProject) onClose();
  }, [isActionOpen, hasProject, onClose]);

  const isShareOpen = isOpenAction(PinnedProjectActionKind.Share);

  const handleConfirmDelete = useCallback(() => {
    void confirmDelete();
  }, [confirmDelete]);

  if (project == null) return null;

  const conversationCount = project.conversationCount;

  return (
    <>
      {isShareOpen && (
        <ProjectShareOverlay projectId={project.id} onClose={onClose} />
      )}
      {/* Kept mounted after closing, so the panel slides out. */}
      {action?.kind === PinnedProjectActionKind.Publish &&
        project.canManage && (
          <PublishProjectPanelContainer
            isOpen={action.isOpen}
            projectId={project.id}
            projectName={project.name}
            conversationCount={conversationCount}
            onClose={onClose}
            returnFocusRef={returnFocusRef}
          />
        )}
      {deleteTarget != null && (
        <ProjectDeleteConfirmation
          isOpen={isDeleteOpen}
          projectName={project.name}
          isDeleting={isDeleting}
          onConfirm={handleConfirmDelete}
          onClose={cancelDelete}
        />
      )}
    </>
  );
};

export default memo(PinnedProjectActionOverlays);
