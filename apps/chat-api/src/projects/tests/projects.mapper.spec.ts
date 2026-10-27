import { describe, expect, it } from 'vitest';
import { ProjectSource } from '../dto/project-source.enum';
import {
  type DialProjectMetadata,
  mapProjectMetadata,
  mapSharedProject,
} from '../projects.mapper';

const item = (overrides: Partial<DialProjectMetadata> = {}) =>
  ({
    nodeType: 'ITEM',
    bucket: 'a1b2c3',
    name: 'q4-launch',
    ...overrides,
  }) as DialProjectMetadata;

describe('mapProjectMetadata', () => {
  it('maps a root-level item with its timestamps and author', () => {
    expect(
      mapProjectMetadata(
        item({ author: 'jane.doe', createdAt: 1, updatedAt: 2 }),
        ProjectSource.Personal,
      ),
    ).toEqual({
      id: 'projects/a1b2c3/q4-launch',
      name: 'q4-launch',
      bucket: 'a1b2c3',
      path: 'q4-launch',
      parentPath: undefined,
      source: ProjectSource.Personal,
      author: 'jane.doe',
      createdAt: 1,
      updatedAt: 2,
    });
  });

  it('joins a nested parentPath into path and keeps it without a trailing slash', () => {
    const result = mapProjectMetadata(
      item({ parentPath: 'marketing/2026/' }),
      ProjectSource.Organization,
    );
    expect(result).toMatchObject({
      id: 'projects/a1b2c3/marketing/2026/q4-launch',
      path: 'marketing/2026/q4-launch',
      parentPath: 'marketing/2026',
      source: ProjectSource.Organization,
    });
  });

  it('ignores a folder-shaped trailing slash in Core url when building the id', () => {
    const result = mapProjectMetadata(
      item({ url: 'projects/a1b2c3/q4-launch/' }),
      ProjectSource.Personal,
    );
    expect(result?.id).toBe('projects/a1b2c3/q4-launch');
  });

  it('drops grouping folders', () => {
    expect(
      mapProjectMetadata(
        { nodeType: 'FOLDER', bucket: 'a1b2c3', name: 'marketing' },
        ProjectSource.Personal,
      ),
    ).toBeNull();
  });

  it('drops an item without a name or bucket', () => {
    expect(
      mapProjectMetadata(item({ name: undefined }), ProjectSource.Personal),
    ).toBeNull();
    expect(
      mapProjectMetadata(item({ bucket: undefined }), ProjectSource.Personal),
    ).toBeNull();
  });
});

describe('mapSharedProject', () => {
  it('derives bucket, path, name and parentPath from the shared url', () => {
    expect(
      mapSharedProject(
        item({
          bucket: undefined,
          name: undefined,
          url: 'projects/z9y8x7/research/shared-research/',
          updatedAt: 5,
        }),
      ),
    ).toEqual({
      id: 'projects/z9y8x7/research/shared-research',
      name: 'shared-research',
      bucket: 'z9y8x7',
      path: 'research/shared-research',
      parentPath: 'research',
      source: ProjectSource.Shared,
      author: undefined,
      createdAt: undefined,
      updatedAt: 5,
    });
  });

  it('decodes a percent-encoded shared url', () => {
    const result = mapSharedProject(
      item({ url: 'projects/z9y8x7/Q4%20Launch' }),
    );
    expect(result).toMatchObject({
      name: 'Q4 Launch',
      id: 'projects/z9y8x7/Q4 Launch',
    });
  });

  it.each([
    ['a foreign prefix', 'files/z9y8x7/doc.txt'],
    ['a missing bucket', 'projects//x'],
    ['an empty path', 'projects/z9y8x7/'],
  ])('drops a shared url with %s', (_label, url) => {
    expect(mapSharedProject(item({ url }))).toBeNull();
  });

  it('drops shared folders and entries without a url', () => {
    expect(
      mapSharedProject({ nodeType: 'FOLDER', url: 'projects/z9y8x7/f/' }),
    ).toBeNull();
    expect(mapSharedProject(item({ url: undefined }))).toBeNull();
  });
});
