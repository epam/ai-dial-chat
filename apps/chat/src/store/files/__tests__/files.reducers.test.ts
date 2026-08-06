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

  it('keeps selected root shared files that are excluded from the payload', () => {
    const sharedRootFileId = 'files/sharer-bucket/shared.jpg';
    const state = {
      ...filesSlice.getInitialState(),
      sharedWithMeFilesAndFoldersIds: [sharedRootFileId],
      files: [
        makeFile({
          id: sharedRootFileId,
          name: 'shared.jpg',
          folderId: 'files/sharer-bucket',
          sharedWithMe: true,
          isRootSharedItem: true,
        }),
      ],
    };

    const nextState = filesSlice.reducer(
      state,
      FilesActions.addSharedFiles({
        files: [],
        keepFileIds: [sharedRootFileId],
      }),
    );

    expect(nextState.files.map((f) => f.id)).toContain(sharedRootFileId);
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

describe('files.reducers moveFiles', () => {
  const bucket = 'files/bucket';
  const renamed = `${bucket}/parent`;
  const sibling = `${bucket}/parent2`;

  it('drops the moved subtree but keeps a sibling sharing the name prefix', () => {
    const state = {
      ...filesSlice.getInitialState(),
      files: [
        makeFile({
          id: `${renamed}/child/doc.txt`,
          folderId: `${renamed}/child`,
        }),
        makeFile({
          id: `${sibling}/child/doc.txt`,
          folderId: `${sibling}/child`,
        }),
      ],
      folders: [
        makeFolder({ id: renamed, name: 'parent', folderId: bucket }),
        makeFolder({ id: `${renamed}/child`, folderId: renamed }),
        makeFolder({ id: sibling, name: 'parent2', folderId: bucket }),
        makeFolder({ id: `${sibling}/child`, folderId: sibling }),
      ],
    };

    const nextState = filesSlice.reducer(
      state,
      FilesActions.moveFiles({
        files: [
          {
            sourceUrl: renamed,
            destinationUrl: `${bucket}/newName`,
            nodeType: DialFileNodeType.FOLDER,
          },
        ],
        sourceFolder: bucket,
        destinationFolder: bucket,
      }),
    );

    expect(nextState.folders.map((f) => f.id).sort()).toEqual(
      [renamed, sibling, `${sibling}/child`].sort(),
    );
    expect(nextState.files.map((f) => f.id)).toEqual([
      `${sibling}/child/doc.txt`,
    ]);
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

describe('files.reducers quick attachments', () => {
  const fileId = 'files/test/uploads/2025-01/attachment.txt';
  const fileContent = new File(['content'], 'attachment.txt', {
    type: 'text/plain',
  });

  it('uploadFile sets isFromDeviceAttachment when flag is passed', () => {
    const state = filesSlice.getInitialState();

    const nextState = filesSlice.reducer(
      state,
      FilesActions.uploadFile({
        fileContent,
        id: fileId,
        name: 'attachment.txt',
        relativePath: 'uploads/2025-01',
        isFromDeviceAttachment: true,
      }),
    );

    expect(nextState.files).toHaveLength(1);
    expect(nextState.files[0].isFromDeviceAttachment).toBe(true);
    expect(nextState.files[0].status).toBe(UploadStatus.LOADING);
  });

  it('uploadFile does not set isFromDeviceAttachment without flag', () => {
    const state = filesSlice.getInitialState();

    const nextState = filesSlice.reducer(
      state,
      FilesActions.uploadFile({
        fileContent,
        id: fileId,
        name: 'attachment.txt',
        relativePath: 'uploads/2025-01',
      }),
    );

    expect(nextState.files[0].isFromDeviceAttachment).toBeUndefined();
  });

  it('uploadFileSuccess preserves isFromDeviceAttachment', () => {
    const state = {
      ...filesSlice.getInitialState(),
      files: [
        makeFile({
          id: fileId,
          status: UploadStatus.LOADING,
          isFromDeviceAttachment: true,
        }),
      ],
    };

    const nextState = filesSlice.reducer(
      state,
      FilesActions.uploadFileSuccess({
        apiResult: makeFile({
          id: fileId,
          serverSynced: true,
        }),
      }),
    );

    expect(nextState.files[0].isFromDeviceAttachment).toBe(true);
    expect(nextState.files[0].serverSynced).toBe(true);
  });

  it('unselectFiles removes ids from selectedFilesIds only', () => {
    const state = {
      ...filesSlice.getInitialState(),
      selectedFilesIds: [fileId, 'files/test/other.txt'],
      files: [
        makeFile({
          id: fileId,
          isFromDeviceAttachment: true,
        }),
      ],
    };

    const nextState = filesSlice.reducer(
      state,
      FilesActions.unselectFiles({ ids: [fileId] }),
    );

    expect(nextState.selectedFilesIds).toEqual(['files/test/other.txt']);
    expect(nextState.files).toHaveLength(1);
  });

  it('resetDeviceAttachmentFlag clears isFromDeviceAttachment for matching ids', () => {
    const otherId = 'files/test/other.txt';
    const state = {
      ...filesSlice.getInitialState(),
      files: [
        makeFile({
          id: fileId,
          isFromDeviceAttachment: true,
        }),
        makeFile({
          id: otherId,
          isFromDeviceAttachment: true,
        }),
      ],
    };

    const nextState = filesSlice.reducer(
      state,
      FilesActions.resetDeviceAttachmentFlag({ ids: [fileId] }),
    );

    expect(nextState.files[0].isFromDeviceAttachment).toBeFalsy();
    expect(nextState.files[1].isFromDeviceAttachment).toBe(true);
  });

  it('resetDeviceAttachmentFlag leaves non-device files untouched', () => {
    const state = {
      ...filesSlice.getInitialState(),
      files: [
        makeFile({
          id: fileId,
        }),
      ],
    };

    const nextState = filesSlice.reducer(
      state,
      FilesActions.resetDeviceAttachmentFlag({ ids: [fileId] }),
    );

    expect(nextState.files[0].isFromDeviceAttachment).toBeUndefined();
    expect(nextState.files).toHaveLength(1);
  });
});

describe('files.reducers getFullListingSuccess', () => {
  it('preserves client-only metadata like publishedWithMe when merging fresh listing results', () => {
    const folderPath = 'files/org-bucket';
    const fileId = `${folderPath}/happy_beach_person.png`;
    const state = {
      ...filesSlice.getInitialState(),
      files: [
        makeFile({
          id: fileId,
          folderId: folderPath,
          publishedWithMe: true,
        }),
      ],
    };

    const nextState = filesSlice.reducer(
      state,
      FilesActions.getFullListingSuccess({
        folderPath,
        files: [
          makeFile({
            id: fileId,
            folderId: folderPath,
          }),
        ],
      }),
    );

    const file = nextState.files.find((f) => f.id === fileId);
    expect(file?.publishedWithMe).toBe(true);
  });

  it('keeps the known content length when a listing result has none (no size flicker while uploading)', () => {
    const folderPath = 'files/my-bucket';
    const fileId = `${folderPath}/uploading.png`;
    const state = {
      ...filesSlice.getInitialState(),
      files: [
        makeFile({ id: fileId, folderId: folderPath, contentLength: 42 }),
      ],
    };

    const nextState = filesSlice.reducer(
      state,
      FilesActions.getFullListingSuccess({
        folderPath,
        files: [
          makeFile({ id: fileId, folderId: folderPath, contentLength: 0 }),
        ],
      }),
    );

    const file = nextState.files.find((f) => f.id === fileId);
    expect(file?.contentLength).toBe(42);
  });

  it('falls back to the locally cached size for a new file that has no content length yet', () => {
    const folderPath = 'files/my-bucket';
    const fileId = `${folderPath}/new.png`;
    const state = {
      ...filesSlice.getInitialState(),
      localFileSizeCache: { [fileId]: 128 },
    };

    const nextState = filesSlice.reducer(
      state,
      FilesActions.getFullListingSuccess({
        folderPath,
        files: [
          makeFile({ id: fileId, folderId: folderPath, contentLength: 0 }),
        ],
      }),
    );

    const file = nextState.files.find((f) => f.id === fileId);
    expect(file?.contentLength).toBe(128);
  });

  it('prefers the backend content length once it arrives and clears the local cache', () => {
    const folderPath = 'files/my-bucket';
    const fileId = `${folderPath}/done.png`;
    const state = {
      ...filesSlice.getInitialState(),
      files: [
        makeFile({ id: fileId, folderId: folderPath, contentLength: 42 }),
      ],
      localFileSizeCache: { [fileId]: 42 },
    };

    const nextState = filesSlice.reducer(
      state,
      FilesActions.getFullListingSuccess({
        folderPath,
        files: [
          makeFile({ id: fileId, folderId: folderPath, contentLength: 100 }),
        ],
      }),
    );

    const file = nextState.files.find((f) => f.id === fileId);
    expect(file?.contentLength).toBe(100);
    expect(nextState.localFileSizeCache[fileId]).toBeUndefined();
  });
});
