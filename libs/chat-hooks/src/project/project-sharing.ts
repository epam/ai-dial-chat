import {
  type ProjectDetailsDto,
  ProjectSource,
} from '@epam/ai-dial-chat-api-client';

/** Whether a project was shared with the caller, so they may drop it from their list but not delete it. */
export const isProjectSharedWithMe = (
  project: Pick<ProjectDetailsDto, 'source' | 'canManage'> | null | undefined,
): boolean =>
  project != null &&
  project.source === ProjectSource.Shared &&
  !project.canManage;

/** An action of a pinned project's sidebar menu; the values are the menu item keys. */
export enum PinnedProjectMenuAction {
  /** Removes the project from the pins. */
  Unpin = 'unpin',
  /** Opens the edit page. */
  Edit = 'edit',
  /** Opens the publish panel. */
  Publish = 'publish',
  /** Opens the share popover. */
  Share = 'share',
  /** Opens the owner's revoke-access confirmation. */
  RevokeAccess = 'revokeAccess',
  /** Opens the delete confirmation. */
  Delete = 'delete',
  /** Opens the confirmation that drops a shared project from the caller's list. */
  RemoveFromMyList = 'removeFromMyList',
}

/** Returns the actions a pinned project's menu offers the caller, in display order; the host maps each to its label, icon and handler. */
export const getPinnedProjectMenuActions = (
  project:
    | Pick<ProjectDetailsDto, 'source' | 'canEdit' | 'canManage'>
    | null
    | undefined,
): PinnedProjectMenuAction[] => {
  /* A project that is not loaded yet only offers Unpin. */
  if (project == null) return [PinnedProjectMenuAction.Unpin];
  const removeFromList = isProjectSharedWithMe(project)
    ? [PinnedProjectMenuAction.RemoveFromMyList]
    : [];
  /* `canEdit` (the owner or a share with edit access) adds Edit; `canManage` (the owner) adds Publish, Share and Delete. */
  if (!project.canEdit) {
    return [PinnedProjectMenuAction.Unpin, ...removeFromList];
  }
  if (!project.canManage) {
    return [
      PinnedProjectMenuAction.Unpin,
      PinnedProjectMenuAction.Edit,
      ...removeFromList,
    ];
  }
  return [
    PinnedProjectMenuAction.Unpin,
    PinnedProjectMenuAction.Edit,
    PinnedProjectMenuAction.Publish,
    PinnedProjectMenuAction.Share,
    PinnedProjectMenuAction.RevokeAccess,
    PinnedProjectMenuAction.Delete,
  ];
};
