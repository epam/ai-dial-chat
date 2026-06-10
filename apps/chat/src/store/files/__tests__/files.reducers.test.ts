import { describe, expect, it } from 'vitest';

import { FeatureType, ReplaceOptions } from '@/src/types/common';
import { DialFile, FileFolderInterface } from '@/src/types/files';

import { FilesActions, filesSlice } from '../files.reducers';

import { UploadStatus } from '@epam/ai-dial-shared';
import { DialFileNodeType } from '@epam/ai-dial-ui-kit';

const makeFile = (partial: Partial<DialFile>): DialFile =>
  ({
    id: 'files/test/file.txt',
    name: 'file.txt',
    folderId: 'files/test',
    contentLength: 1,
    contentType: 'text/plain',
    ...partial,
  }) as DialFile;

const makeFolder = (
  partial: Partial<FileFolderInterface>,
): FileFolderInterface =>
  ({
    id: 'files/test/folder',
    name: 'folder',
    folderId: 'files/test',
    type: FeatureType.File,
    status: UploadStatus.LOADED,
    ...partial,
  }) as FileFolderInterface;

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

describe('files.reducers deleteFilesSuccess', () => {
  const parent = 'files/bucket/parent';
  const zipRoot = `${parent}/zipRoot`;
  const nestedFolderId = `${zipRoot}/nested`;
  const nestedFileId = `${nestedFolderId}/doc.txt`;
  const siblingFileId = `${parent}/sibling.txt`;

  it('removes nested ZIP-like files and folders when batch fully succeeds', () => {
    const state = {
      ...filesSlice.getInitialState(),
      files: [
        makeFile({
          id: nestedFileId,
          name: 'doc.txt',
          folderId: nestedFolderId,
        }),
        makeFile({
          id: siblingFileId,
          name: 'sibling.txt',
          folderId: parent,
        }),
      ],
      folders: [
        makeFolder({
          id: zipRoot,
          name: 'zipRoot',
          folderId: parent,
        }),
        makeFolder({
          id: nestedFolderId,
          name: 'nested',
          folderId: zipRoot,
        }),
        makeFolder({
          id: `${parent}/otherFolder`,
          name: 'otherFolder',
          folderId: parent,
        }),
      ],
      chosenFileIds: [nestedFileId, siblingFileId],
      chosenEmptyFoldersIds: [nestedFolderId],
      selectedFilesIds: [nestedFileId],
    };

    const nextState = filesSlice.reducer(
      state,
      FilesActions.deleteFilesSuccess({
        deletedItems: [
          {
            sourceUrl: zipRoot,
            nodeType: DialFileNodeType.FOLDER,
          },
        ],
        request: {
          files: [
            {
              sourceUrl: zipRoot,
              nodeType: DialFileNodeType.FOLDER,
            },
          ],
          folderUrl: parent,
        },
        result: {
          success: true,
          total: 1,
          succeeded: 1,
          failed: 0,
          results: [{ index: 0, data: nestedFileId }],
        },
      }),
    );

    expect(nextState.files.map((f) => f.id)).toEqual([siblingFileId]);
    expect(nextState.folders.map((f) => f.id)).toEqual([
      `${parent}/otherFolder`,
    ]);
    expect(nextState.chosenFileIds).toEqual([siblingFileId]);
    expect(nextState.chosenEmptyFoldersIds).toEqual([]);
    expect(nextState.selectedFilesIds).toEqual([]);
  });

  it('when batch has failures, removes only succeeded file ids and keeps subtree folders', () => {
    const state = {
      ...filesSlice.getInitialState(),
      files: [
        makeFile({
          id: nestedFileId,
          name: 'doc.txt',
          folderId: nestedFolderId,
        }),
      ],
      folders: [
        makeFolder({
          id: zipRoot,
          name: 'zipRoot',
          folderId: parent,
        }),
        makeFolder({
          id: nestedFolderId,
          name: 'nested',
          folderId: zipRoot,
        }),
      ],
    };

    const nextState = filesSlice.reducer(
      state,
      FilesActions.deleteFilesSuccess({
        deletedItems: [
          {
            sourceUrl: zipRoot,
            nodeType: DialFileNodeType.FOLDER,
          },
        ],
        request: {
          files: [
            {
              sourceUrl: zipRoot,
              nodeType: DialFileNodeType.FOLDER,
            },
          ],
          folderUrl: parent,
        },
        result: {
          success: false,
          total: 2,
          succeeded: 1,
          failed: 1,
          results: [{ index: 0, data: nestedFileId }],
          errors: [
            { index: 1, data: `${nestedFolderId}/other.bin`, error: 'x' },
          ],
        },
      }),
    );

    expect(nextState.files).toHaveLength(0);
    expect(nextState.folders.map((f) => f.id).sort()).toEqual(
      [nestedFolderId, zipRoot].sort(),
    );
  });
});

describe('files.reducers uploadReplaceDialog', () => {
  const folderId = 'files/test-bucket/uploads';
  const file = new File(['content'], 'sun.jpg', { type: 'image/jpeg' });

  it('opens dialog with duplicated and non-duplicated files', () => {
    const duplicatedFile = makeFile({
      id: `${folderId}/sun.jpg`,
      name: 'sun.jpg',
      folderId,
    });

    const nextState = filesSlice.reducer(
      filesSlice.getInitialState(),
      FilesActions.showUploadReplaceDialog({
        duplicatedFiles: [{ ...duplicatedFile, fileContent: file }],
        nonDuplicatedFiles: [],
        folderId,
        folderPath: 'uploads',
        bucket: 'test-bucket',
        showSuccessMessage: true,
        selectFileIds: true,
      }),
    );

    expect(nextState.uploadReplaceDialog?.isOpen).toBe(true);
    expect(nextState.uploadReplaceDialog?.duplicatedFiles).toHaveLength(1);
  });

  it('clears dialog on cancel', () => {
    const state = {
      ...filesSlice.getInitialState(),
      uploadReplaceDialog: {
        isOpen: true,
        duplicatedFiles: [],
        nonDuplicatedFiles: [],
        folderId,
        showSuccessMessage: false,
        selectFileIds: false,
      },
    };

    const nextState = filesSlice.reducer(
      state,
      FilesActions.cancelUploadReplaceDialog(),
    );

    expect(nextState.uploadReplaceDialog).toBeNull();
  });

  it('stores mapped actions and closes dialog on continue', () => {
    const state = {
      ...filesSlice.getInitialState(),
      uploadReplaceDialog: {
        isOpen: true,
        duplicatedFiles: [],
        nonDuplicatedFiles: [],
        folderId,
        showSuccessMessage: false,
        selectFileIds: false,
      },
    };

    const nextState = filesSlice.reducer(
      state,
      FilesActions.continueUploadReplaceDialog({
        mappedActions: { [`${folderId}/sun.jpg`]: ReplaceOptions.Postfix },
      }),
    );

    expect(nextState.uploadReplaceDialog?.isOpen).toBe(false);
    expect(nextState.uploadReplaceDialog?.mappedActions).toEqual({
      [`${folderId}/sun.jpg`]: ReplaceOptions.Postfix,
    });
  });
});
