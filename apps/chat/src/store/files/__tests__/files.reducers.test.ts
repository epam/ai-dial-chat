import { describe, expect, it } from 'vitest';

import { DialFile } from '@/src/types/files';

import { FilesActions, filesSlice } from '../files.reducers';

const makeFile = (partial: Partial<DialFile>): DialFile =>
  ({
    id: 'files/test/file.txt',
    name: 'file.txt',
    folderId: 'files/test',
    contentLength: 1,
    contentType: 'text/plain',
    ...partial,
  }) as DialFile;

describe('files.reducers addSharedFiles', () => {
  it('keeps nested shared descendants under active shared roots', () => {
    const activeRoot = 'files/test/shared-root';
    const state = {
      ...filesSlice.getInitialState(),
      sharedWithMeFilesAndFoldersIds: [activeRoot],
      files: [
        makeFile({
          id: `${activeRoot}/old-root-file.txt`,
          folderId: activeRoot,
          sharedWithMe: true,
          isRootSharedItem: true,
        }),
        makeFile({
          id: `${activeRoot}/nested/kept.txt`,
          folderId: `${activeRoot}/nested`,
          sharedWithMe: true,
        }),
        makeFile({
          id: 'files/test/private/not-shared.txt',
          folderId: 'files/test/private',
          sharedWithMe: false,
        }),
      ],
    };

    const nextState = filesSlice.reducer(
      state,
      FilesActions.addSharedFiles({
        files: [
          makeFile({
            id: `${activeRoot}/new-root-file.txt`,
            folderId: activeRoot,
            sharedWithMe: true,
            isRootSharedItem: true,
          }),
        ],
      }),
    );

    expect(nextState.files.map((f) => f.id)).toEqual(
      expect.arrayContaining([
        `${activeRoot}/nested/kept.txt`,
        `${activeRoot}/new-root-file.txt`,
        'files/test/private/not-shared.txt',
      ]),
    );
    expect(nextState.files.map((f) => f.id)).not.toContain(
      `${activeRoot}/old-root-file.txt`,
    );
  });

  it('removes stale nested shared descendants for revoked roots', () => {
    const activeRoot = 'files/test/active-root';
    const revokedRoot = 'files/test/revoked-root';
    const state = {
      ...filesSlice.getInitialState(),
      sharedWithMeFilesAndFoldersIds: [activeRoot],
      files: [
        makeFile({
          id: `${activeRoot}/nested/kept.txt`,
          folderId: `${activeRoot}/nested`,
          sharedWithMe: true,
        }),
        makeFile({
          id: `${revokedRoot}/nested/stale.txt`,
          folderId: `${revokedRoot}/nested`,
          sharedWithMe: true,
        }),
      ],
    };

    const nextState = filesSlice.reducer(
      state,
      FilesActions.addSharedFiles({
        files: [
          makeFile({
            id: `${activeRoot}/root.txt`,
            folderId: activeRoot,
            sharedWithMe: true,
            isRootSharedItem: true,
          }),
        ],
      }),
    );

    expect(nextState.files.map((f) => f.id)).toContain(
      `${activeRoot}/nested/kept.txt`,
    );
    expect(nextState.files.map((f) => f.id)).not.toContain(
      `${revokedRoot}/nested/stale.txt`,
    );
  });

  it('replaces previously stored root shared files without duplicates', () => {
    const activeRoot = 'files/test/shared-root';
    const state = {
      ...filesSlice.getInitialState(),
      sharedWithMeFilesAndFoldersIds: [activeRoot],
      files: [
        makeFile({
          id: `${activeRoot}/root.txt`,
          name: 'stale-name.txt',
          folderId: activeRoot,
          contentLength: 5,
          sharedWithMe: true,
          isRootSharedItem: true,
        }),
      ],
    };

    const nextState = filesSlice.reducer(
      state,
      FilesActions.addSharedFiles({
        files: [
          makeFile({
            id: `${activeRoot}/root.txt`,
            name: 'fresh-name.txt',
            folderId: activeRoot,
            contentLength: 10,
            sharedWithMe: true,
            isRootSharedItem: true,
          }),
        ],
      }),
    );

    const rootItems = nextState.files.filter(
      (file) => file.id === `${activeRoot}/root.txt`,
    );
    expect(rootItems).toHaveLength(1);
    expect(rootItems[0].name).toBe('fresh-name.txt');
    expect(rootItems[0].contentLength).toBe(10);
  });
});
