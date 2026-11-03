import { makeOutsideInert } from '@epam/ai-dial-chat-shared';
import { memo, useCallback, useEffect, useRef, type FC } from 'react';
import { createPortal } from 'react-dom';
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
  const {
    requestDelete,
    cancelDelete,
    confirmDelete,
    isDeleteOpen,
    isDeleting,
  } = useProjectActions(deleteTarget, handleReload, {
    leaveOnDelete: deleteTargetId != null && deleteTargetId === routeProjectId,
  });

  /* The shared actions own the dialog's open state: the action opens it, and
     any way it closes — cancel, success or a conflict — ends the action. */
  useEffect(() => {
    if (deleteTargetId != null) requestDelete();
  }, [deleteTargetId, requestDelete]);
  const wasDeleteOpenRef = useRef(false);
  useEffect(() => {
    if (isDeleteOpen) {
      wasDeleteOpenRef.current = true;
      return;
    }
    if (!wasDeleteOpenRef.current) return;
    wasDeleteOpenRef.current = false;
    onClose();
  }, [isDeleteOpen, onClose]);

  /* A project that left the tree (unpinned or deleted elsewhere) ends its
     action, so it cannot reopen by itself if the project comes back. */
  const isActionOpen = action?.isOpen === true;
  const hasProject = project != null;
  useEffect(() => {
    if (isActionOpen && !hasProject) onClose();
  }, [isActionOpen, hasProject, onClose]);

  /* The share overlay dims the page but traps no focus: while it is open,
     the rest of the page leaves the tab order, as on the project view page.
     It is portalled to the body, so that the rest of the page is a sibling
     to make inert, and its fixed backdrop is not boxed in by the sidebar
     (the mobile drawer is translated and clips its overflow). */
  const isShareOpen = isOpenAction(PinnedProjectActionKind.Share);
  const shareContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = shareContainerRef.current;
    if (!isShareOpen || container == null) return;
    return makeOutsideInert(container);
  }, [isShareOpen]);

  const handleConfirmDelete = useCallback(() => {
    void confirmDelete();
  }, [confirmDelete]);

  if (project == null) return null;

  const conversationCount = project.conversationCount;

  return (
    <>
      {isShareOpen &&
        createPortal(
          <div ref={shareContainerRef} className="contents">
            <ProjectShareOverlay projectId={project.id} onClose={onClose} />
          </div>,
          document.body,
        )}
      {/* Kept mounted after closing, so the panel slides out. */}
      {action?.kind === PinnedProjectActionKind.Publish && project.canEdit && (
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
          conversationCount={conversationCount}
          isDeleting={isDeleting}
          onConfirm={handleConfirmDelete}
          onClose={cancelDelete}
        />
      )}
    </>
  );
};

export default memo(PinnedProjectActionOverlays);
