import type { components } from '@epam/ai-dial-typescript-sdk';
import { describe, expect, it } from 'vitest';
import { resolveSharedProjectPermissions } from '../utils/project-access.util';

type SharedResource = components['schemas']['MetadataBase'];

type Permission = components['schemas']['ResourceAccessType'];

const shared = (url: string | undefined, permissions?: Permission[]) =>
  ({ nodeType: 'ITEM', url, permissions }) as SharedResource;

const PROJECT_ID = 'projects/z9y8x7/research';

describe('resolveSharedProjectPermissions', () => {
  it('returns the permissions of the entry that names the project', () => {
    const permissions = resolveSharedProjectPermissions(
      [shared(PROJECT_ID, ['READ', 'WRITE'])],
      PROJECT_ID,
    );

    expect([...permissions].sort()).toEqual(['READ', 'WRITE']);
  });

  it('matches an encoded url against the decoded project id', () => {
    const permissions = resolveSharedProjectPermissions(
      [shared('projects/z9y8x7/Q4%20launch', ['READ', 'WRITE'])],
      'projects/z9y8x7/Q4 launch',
    );

    expect(permissions.has('WRITE')).toBe(true);
  });

  it('ignores a trailing slash on the listed url', () => {
    const permissions = resolveSharedProjectPermissions(
      [shared(`${PROJECT_ID}/`, ['READ'])],
      PROJECT_ID,
    );

    expect([...permissions]).toEqual(['READ']);
  });

  it('counts a share on a grouping folder above the project', () => {
    const permissions = resolveSharedProjectPermissions(
      [shared('projects/z9y8x7/team/', ['READ', 'WRITE'])],
      'projects/z9y8x7/team/research',
    );

    expect(permissions.has('WRITE')).toBe(true);
  });

  it('does not count a sibling whose name shares the prefix', () => {
    const permissions = resolveSharedProjectPermissions(
      [shared('projects/z9y8x7/research-old', ['READ', 'WRITE'])],
      PROJECT_ID,
    );

    expect(permissions.size).toBe(0);
  });

  it('unions the permissions of every matching entry', () => {
    const permissions = resolveSharedProjectPermissions(
      [
        shared(PROJECT_ID, ['READ']),
        shared('projects/z9y8x7/', ['READ', 'WRITE']),
      ],
      PROJECT_ID,
    );

    expect([...permissions].sort()).toEqual(['READ', 'WRITE']);
  });

  it('ignores other projects, entries without a url and entries without permissions', () => {
    const permissions = resolveSharedProjectPermissions(
      [
        shared('projects/other/research', ['READ', 'WRITE']),
        shared(undefined, ['READ', 'WRITE']),
        shared(PROJECT_ID),
      ],
      PROJECT_ID,
    );

    expect(permissions.size).toBe(0);
  });

  it('returns no permissions for an empty list', () => {
    expect(resolveSharedProjectPermissions([], PROJECT_ID).size).toBe(0);
  });
});
