import { ProjectSource } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  getPinnedProjectMenuActions,
  isProjectSharedWithMe,
  PinnedProjectMenuAction,
} from '../project-sharing';

const project = (
  source: ProjectSource,
  canEdit: boolean,
  canManage: boolean,
) => ({ source, canEdit, canManage });

describe('isProjectSharedWithMe', () => {
  it('accepts a shared project the caller cannot manage', () => {
    expect(
      isProjectSharedWithMe(project(ProjectSource.Shared, false, false)),
    ).toBe(true);
  });

  it('rejects an owned, organization or manageable project and a missing one', () => {
    expect(
      isProjectSharedWithMe(project(ProjectSource.Personal, true, true)),
    ).toBe(false);
    expect(
      isProjectSharedWithMe(project(ProjectSource.Organization, false, false)),
    ).toBe(false);
    expect(
      isProjectSharedWithMe(project(ProjectSource.Shared, true, true)),
    ).toBe(false);
    expect(isProjectSharedWithMe(null)).toBe(false);
    expect(isProjectSharedWithMe(undefined)).toBe(false);
  });
});

describe('getPinnedProjectMenuActions', () => {
  it('offers the owner every action but Remove from My List', () => {
    expect(
      getPinnedProjectMenuActions(
        project(ProjectSource.Personal, true, true),
        true,
      ),
    ).toEqual([
      PinnedProjectMenuAction.Unpin,
      PinnedProjectMenuAction.Edit,
      PinnedProjectMenuAction.Publish,
      PinnedProjectMenuAction.Share,
      PinnedProjectMenuAction.RevokeAccess,
      PinnedProjectMenuAction.Delete,
    ]);
  });

  it('hides revoke for an owner until recipients are confirmed', () => {
    const owned = project(ProjectSource.Personal, true, true);
    expect(getPinnedProjectMenuActions(owned)).not.toContain(
      PinnedProjectMenuAction.RevokeAccess,
    );
    expect(getPinnedProjectMenuActions(owned, false)).not.toContain(
      PinnedProjectMenuAction.RevokeAccess,
    );
  });

  it('never offers revoke to a non-owner even with a positive recipient count', () => {
    for (const candidate of [
      project(ProjectSource.Shared, true, false),
      project(ProjectSource.Shared, false, false),
      project(ProjectSource.Organization, false, false),
      undefined,
    ]) {
      expect(getPinnedProjectMenuActions(candidate, true)).not.toContain(
        PinnedProjectMenuAction.RevokeAccess,
      );
    }
  });

  it('offers an editor with a share Unpin, Edit and Remove from My List', () => {
    expect(
      getPinnedProjectMenuActions(project(ProjectSource.Shared, true, false)),
    ).toEqual([
      PinnedProjectMenuAction.Unpin,
      PinnedProjectMenuAction.Edit,
      PinnedProjectMenuAction.RemoveFromMyList,
    ]);
  });

  it('offers a view-only recipient Unpin and Remove from My List', () => {
    expect(
      getPinnedProjectMenuActions(project(ProjectSource.Shared, false, false)),
    ).toEqual([
      PinnedProjectMenuAction.Unpin,
      PinnedProjectMenuAction.RemoveFromMyList,
    ]);
  });

  it('offers an organization project Unpin only', () => {
    expect(
      getPinnedProjectMenuActions(
        project(ProjectSource.Organization, false, false),
      ),
    ).toEqual([PinnedProjectMenuAction.Unpin]);
  });

  it('offers a project that is not loaded Unpin only', () => {
    expect(getPinnedProjectMenuActions(undefined)).toEqual([
      PinnedProjectMenuAction.Unpin,
    ]);
  });
});
