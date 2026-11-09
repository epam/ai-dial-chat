import { ProjectSource } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import { isProjectSharedWithMe } from '../project-sharing';

describe('isProjectSharedWithMe', () => {
  it('accepts a shared project the user cannot manage', () => {
    expect(
      isProjectSharedWithMe({ source: ProjectSource.Shared, canManage: false }),
    ).toBe(true);
  });

  it('rejects an owned project', () => {
    expect(
      isProjectSharedWithMe({
        source: ProjectSource.Personal,
        canManage: true,
      }),
    ).toBe(false);
  });

  it('rejects an organization project', () => {
    expect(
      isProjectSharedWithMe({
        source: ProjectSource.Organization,
        canManage: false,
      }),
    ).toBe(false);
  });

  it('rejects a shared project the user can manage', () => {
    expect(
      isProjectSharedWithMe({ source: ProjectSource.Shared, canManage: true }),
    ).toBe(false);
  });

  it('rejects a missing project', () => {
    expect(isProjectSharedWithMe(null)).toBe(false);
    expect(isProjectSharedWithMe(undefined)).toBe(false);
  });
});
