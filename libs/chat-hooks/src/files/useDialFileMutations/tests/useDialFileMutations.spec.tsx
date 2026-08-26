import { HIDDEN_FILE } from '@epam/ai-dial-chat-shared';
import type { DialFile } from '@epam/ai-dial-react-file-manager';
import {
  DialFileManagerTabs,
  DialFileNodeType,
} from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SharedRootMeta } from '../../dial-file-manager.model';
import {
  FileManagerNotificationReason,
  FileNameValidationErrorReason,
} from '../../dial-file-manager.types';
import type { DialFilesApi } from '../../dial-files-api';
import { DownloadDestinationType } from '../../download-destination';
import type { DownloadDestinationHandlers } from '../../download-destination';
import type { UseDialFileMutationsOptions } from '../useDialFileMutations';
import { useDialFileMutations } from '../useDialFileMutations';

const BUCKET = 'test-bucket';

const makeFilesApi = (): DialFilesApi =>
  ({
    listFiles: vi.fn(),
    listPublicFiles: vi.fn(),
    listSharedFiles: vi.fn(),
    listSharedByMe: vi.fn(),
    getFileMetadata: vi.fn(),
    uploadFile: vi.fn(),
    uploadArchive: vi.fn(),
    createFolder: vi.fn(),
    deleteFiles: vi.fn(),
    renameFiles: vi.fn().mockResolvedValue({ results: [] }),
    copyFiles: vi.fn(),
    moveFiles: vi.fn(),
    downloadFile: vi.fn(),
    downloadArchive: vi.fn(),
    revokeAccess: vi.fn(),
    discardShared: vi.fn(),
  }) as unknown as DialFilesApi;

const makeDownloadDestination = (): DownloadDestinationHandlers => ({
  resolveDestination: vi
    .fn()
    .mockResolvedValue({ type: DownloadDestinationType.Blob }),
  triggerDownload: vi
    .fn()
    .mockImplementation((_response: Response, fallbackName: string) =>
      Promise.resolve(fallbackName),
    ),
});

interface RenderMutationsOverrides extends Partial<
  Omit<UseDialFileMutationsOptions, 'folderPath'>
> {
  folderPath?: string;
}

const renderMutations = (overrides: RenderMutationsOverrides = {}) => {
  const invalidateFolders = vi.fn();
  const bumpRetry = vi.fn();
  const mergeCreatedFolder = vi.fn();
  const onNotification = vi.fn();
  const onOperationSuccess = vi.fn();
  const sharedRootMetaRef = { current: new Map<string, SharedRootMeta>() };
  const filesApi = overrides.filesApi ?? makeFilesApi();
  const downloadDestination =
    overrides.downloadDestination ?? makeDownloadDestination();

  const { result } = renderHook(() => {
    const [folderPath, setFolderPath] = useState(overrides.folderPath ?? '');
    const mutations = useDialFileMutations({
      filesApi,
      bucket: BUCKET,
      rootLabel: 'My files',
      activeTab: DialFileManagerTabs.MyFiles,
      currentFolder: undefined,
      sharedRootMetaRef,
      listingPermissionsCache: new Map(),
      invalidateFolders,
      bumpRetry,
      mergeCreatedFolder,
      onNotification,
      onOperationSuccess,
      downloadDestination,
      ...overrides,
      folderPath,
      setFolderPath,
    });
    return { ...mutations, folderPath };
  });

  return {
    result,
    invalidateFolders,
    bumpRetry,
    mergeCreatedFolder,
    onNotification,
    onOperationSuccess,
    filesApi,
    downloadDestination,
  };
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('useDialFileMutations', () => {
  describe('onCreateFolderValidate', () => {
    const parentFolder: DialFile = {
      id: 'root',
      name: 'My files',
      path: '/My files',
      parentPath: '',
      nodeType: DialFileNodeType.FOLDER,
      folderId: BUCKET,
      bucket: BUCKET,
      items: [],
    };

    it('returns null for a valid folder name', () => {
      const { result } = renderMutations();
      expect(
        result.current.onCreateFolderValidate('reports', parentFolder),
      ).toBeNull();
    });

    it('returns a forbiddenSymbols error for a folder name containing colon', () => {
      const { result } = renderMutations({
        forbiddenSymbolsRegExp: /[:]/,
      });
      const error = result.current.onCreateFolderValidate(
        'reports:2026',
        parentFolder,
      );
      expect(error).toEqual(
        expect.objectContaining({
          reason: FileNameValidationErrorReason.ForbiddenSymbols,
        }),
      );
    });

    it('returns a forbiddenSymbols error for a folder name containing a path separator', () => {
      const { result } = renderMutations();
      const error = result.current.onCreateFolderValidate(
        'reports/2026',
        parentFolder,
      );
      expect(error).toEqual(
        expect.objectContaining({
          reason: FileNameValidationErrorReason.ForbiddenSymbols,
        }),
      );
    });
  });

  describe('onCreateFolder', () => {
    const uploadItem = (name: string) => ({
      name,
      fileContent: new File([], name),
    });

    it('does not call createFolder when the last live-validated name was invalid, even if the path-derived name is clean', async () => {
      const { result, filesApi } = renderMutations({ folderPath: '' });
      const parentFolder: DialFile = {
        id: 'root',
        name: 'My files',
        path: '/My files',
        parentPath: '',
        nodeType: DialFileNodeType.FOLDER,
        folderId: BUCKET,
        bucket: BUCKET,
        items: [],
      };

      // Simulates the host grid showing an inline error while the user
      // types "/New folder", then confirming with a path where the leading
      // "/" got absorbed as a path separator, leaving a clean derived name
      // — see #7968.
      act(() => {
        result.current.onCreateFolderValidate('/New folder', parentFolder);
      });

      await act(async () => {
        await result.current.onCreateFolder(
          uploadItem('New folder'),
          '/My files/New folder',
          'file-slash',
        );
      });

      expect(filesApi.createFolder).not.toHaveBeenCalled();
    });

    it('does not call createFolder for a name containing a forbidden symbol', async () => {
      const { result, filesApi } = renderMutations({
        folderPath: '',
        forbiddenSymbolsRegExp: /[:]/,
      });

      await act(async () => {
        await result.current.onCreateFolder(
          uploadItem('reports:2026'),
          '/My files/reports:2026',
          'file-1',
        );
      });

      expect(filesApi.createFolder).not.toHaveBeenCalled();
    });

    it('does not call createFolder for an empty name', async () => {
      const { result, filesApi } = renderMutations({ folderPath: '' });

      await act(async () => {
        // Trailing double slash parses to an empty final name segment.
        await result.current.onCreateFolder(
          uploadItem(''),
          '/My files//',
          'file-2',
        );
      });

      expect(filesApi.createFolder).not.toHaveBeenCalled();
    });

    it('does not call createFolder for a name starting with a dot', async () => {
      const { result, filesApi } = renderMutations({ folderPath: '' });

      await act(async () => {
        await result.current.onCreateFolder(
          uploadItem('.hidden'),
          '/My files/.hidden',
          'file-hidden',
        );
      });

      expect(filesApi.createFolder).not.toHaveBeenCalled();
    });

    it('does not call createFolder for the reserved marker name', async () => {
      const { result, filesApi } = renderMutations({ folderPath: '' });

      await act(async () => {
        await result.current.onCreateFolder(
          uploadItem(HIDDEN_FILE),
          `/My files/${HIDDEN_FILE}`,
          'file-3',
        );
      });

      expect(filesApi.createFolder).not.toHaveBeenCalled();
    });

    it('calls createFolder for a valid name at the current folder', async () => {
      const rootFolder: DialFile = {
        id: 'root',
        name: 'My files',
        path: '/My files',
        parentPath: '',
        nodeType: DialFileNodeType.FOLDER,
        folderId: BUCKET,
        bucket: BUCKET,
        items: [],
      };

      const {
        result,
        mergeCreatedFolder,
        bumpRetry,
        onOperationSuccess,
        filesApi,
      } = renderMutations({
        folderPath: '',
        currentFolder: rootFolder,
      });

      vi.mocked(filesApi.createFolder).mockResolvedValue({
        name: 'reports',
        path: `files/${BUCKET}/reports/`,
        parentPath: '',
        bucket: BUCKET,
        nodeType: 'folder',
        folderId: `${BUCKET}:files/${BUCKET}/reports/`,
      });

      await act(async () => {
        await result.current.onCreateFolder(
          uploadItem('reports'),
          '/My files/reports',
          'file-4',
        );
      });

      expect(filesApi.createFolder).toHaveBeenCalledWith({
        bucket: BUCKET,
        parentPath: undefined,
        name: 'reports',
      });
      expect(mergeCreatedFolder).toHaveBeenCalled();
      expect(bumpRetry).toHaveBeenCalled();
      expect(onOperationSuccess).toHaveBeenCalledWith({
        kind: 'folderCreated',
        name: 'reports',
      });
    });

    it('does not call createFolder for a name matching an existing sibling in the current folder', async () => {
      const rootFolder: DialFile = {
        id: 'root',
        name: 'My files',
        path: '/My files',
        parentPath: '',
        nodeType: DialFileNodeType.FOLDER,
        folderId: BUCKET,
        bucket: BUCKET,
        items: [
          {
            id: 'reports',
            name: 'reports',
            path: '/My files/reports',
            parentPath: '/My files',
            nodeType: DialFileNodeType.FOLDER,
            folderId: BUCKET,
            bucket: BUCKET,
          },
        ],
      };

      const { result, filesApi } = renderMutations({
        folderPath: '',
        currentFolder: rootFolder,
      });

      await act(async () => {
        await result.current.onCreateFolder(
          uploadItem('REPORTS'),
          '/My files/REPORTS',
          'file-6',
        );
      });

      expect(filesApi.createFolder).not.toHaveBeenCalled();
    });

    it('rejects an invalid name without erroring when creating outside the currently browsed folder', async () => {
      // currentFolder/folderPath reflect "reports/", but the new folder is
      // being created under a different parent (e.g. a destination-folder
      // popup) — parentFolder falls back to the minimal shim with no items.
      const { result, filesApi } = renderMutations({ folderPath: 'reports/' });

      await act(async () => {
        // Trailing double slash parses to an empty final name segment,
        // under a parent ("archive/") different from folderPath ("reports/").
        await result.current.onCreateFolder(
          uploadItem(''),
          '/My files/archive//',
          'file-5',
        );
      });

      expect(filesApi.createFolder).not.toHaveBeenCalled();
    });

    it('reports a structured failure notification when createFolder rejects', async () => {
      const rootFolder: DialFile = {
        id: 'root',
        name: 'My files',
        path: '/My files',
        parentPath: '',
        nodeType: DialFileNodeType.FOLDER,
        folderId: BUCKET,
        bucket: BUCKET,
        items: [],
      };
      const { result, onNotification, filesApi } = renderMutations({
        folderPath: '',
        currentFolder: rootFolder,
      });
      vi.mocked(filesApi.createFolder).mockRejectedValue(new Error('failed'));

      await act(async () => {
        await result.current.onCreateFolder(
          uploadItem('reports'),
          '/My files/reports',
          'file-7',
        );
      });

      expect(onNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Error,
        reason: FileManagerNotificationReason.FolderCreateFailed,
      });
    });
  });

  describe('onRenameValidate', () => {
    const dummyItem: DialFile = {
      id: 'file.pdf',
      name: 'file.pdf',
      path: '/My files/file.pdf',
      parentPath: '/My files',
      nodeType: DialFileNodeType.ITEM,
      folderId: BUCKET,
      bucket: BUCKET,
      items: [],
    };

    it('returns null for a valid name', () => {
      const { result } = renderMutations();
      expect(
        result.current.onRenameValidate('report.pdf', dummyItem),
      ).toBeNull();
    });

    it('returns an empty error for an empty name', () => {
      const { result } = renderMutations();
      expect(result.current.onRenameValidate('', dummyItem)).toEqual({
        reason: FileNameValidationErrorReason.Empty,
      });
    });

    it('returns a reservedName error for ".dial_folder"', () => {
      const { result } = renderMutations();
      const error = result.current.onRenameValidate(HIDDEN_FILE, dummyItem);
      expect(error).toEqual({
        reason: FileNameValidationErrorReason.ReservedName,
      });
    });

    it('returns a forbiddenSymbols error for a name containing forward slash', () => {
      const { result } = renderMutations();
      const error = result.current.onRenameValidate('a/b', dummyItem);
      expect(error).toEqual(
        expect.objectContaining({
          reason: FileNameValidationErrorReason.ForbiddenSymbols,
        }),
      );
    });

    it('returns a forbiddenSymbols error for a name containing backslash', () => {
      const { result } = renderMutations();
      const error = result.current.onRenameValidate('a\\b', dummyItem);
      expect(error).toEqual(
        expect.objectContaining({
          reason: FileNameValidationErrorReason.ForbiddenSymbols,
        }),
      );
    });

    it('returns a forbiddenSymbols error for a name containing colon', () => {
      const { result } = renderMutations({
        forbiddenSymbolsRegExp: /[:]/,
      });
      const error = result.current.onRenameValidate('file:name.pdf', dummyItem);
      expect(error).toEqual(
        expect.objectContaining({
          reason: FileNameValidationErrorReason.ForbiddenSymbols,
        }),
      );
    });

    it('returns a tooLong error for a name longer than 255 chars', () => {
      const { result } = renderMutations();
      const error = result.current.onRenameValidate('a'.repeat(256), dummyItem);
      expect(error).toEqual({
        reason: FileNameValidationErrorReason.TooLong,
        maxLength: 255,
      });
    });

    it('returns a forbiddenSymbols error when name matches forbiddenSymbolsRegExp', () => {
      const { result } = renderMutations({
        forbiddenSymbolsRegExp: /[<>]/,
      });
      const error = result.current.onRenameValidate('file<name>', dummyItem);
      expect(error).toEqual(
        expect.objectContaining({
          reason: FileNameValidationErrorReason.ForbiddenSymbols,
        }),
      );
    });

    it('returns a forbiddenSymbols error when renaming a folder with a forbidden symbol', () => {
      const { result } = renderMutations({
        forbiddenSymbolsRegExp: /[:]/,
      });
      const folderItem: DialFile = {
        ...dummyItem,
        name: 'reports',
        path: '/My files/reports',
        nodeType: DialFileNodeType.FOLDER,
      };
      const error = result.current.onRenameValidate('reports:2026', folderItem);
      expect(error).toEqual(
        expect.objectContaining({
          reason: FileNameValidationErrorReason.ForbiddenSymbols,
        }),
      );
    });

    it('returns null when name does not match forbiddenSymbolsRegExp', () => {
      const { result } = renderMutations({
        forbiddenSymbolsRegExp: /[<>]/,
      });
      expect(
        result.current.onRenameValidate('valid.pdf', dummyItem),
      ).toBeNull();
    });

    it('returns a duplicateName error for a sibling with the same name', () => {
      const currentFolder: DialFile = {
        id: 'root',
        name: 'My files',
        path: '/My files',
        parentPath: '',
        nodeType: DialFileNodeType.FOLDER,
        folderId: BUCKET,
        bucket: BUCKET,
        items: [
          {
            id: 'report.pdf',
            name: 'report.pdf',
            path: '/My files/report.pdf',
            parentPath: '/My files',
            nodeType: DialFileNodeType.ITEM,
            folderId: BUCKET,
            bucket: BUCKET,
          },
        ],
      };

      const { result } = renderMutations({ currentFolder });

      expect(result.current.onRenameValidate('REPORT.PDF', dummyItem)).toEqual({
        reason: FileNameValidationErrorReason.DuplicateName,
        existingName: 'report.pdf',
      });
    });
  });

  describe('onMoveToFiles', () => {
    it('calls renameFiles and triggers cache invalidation and retry on success', async () => {
      const {
        result,
        invalidateFolders,
        bumpRetry,
        onOperationSuccess,
        filesApi,
      } = renderMutations();
      vi.mocked(filesApi.renameFiles).mockResolvedValue({
        results: [
          {
            sourcePath: 'file.pdf',
            destinationPath: 'renamed.pdf',
            success: true,
          },
        ],
      });

      await act(async () => {
        result.current.onMoveToFiles(
          [
            {
              sourceUrl: '/My files/file.pdf',
              destinationUrl: '/My files/renamed.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files',
          '/My files',
        );
      });

      await waitFor(() => expect(filesApi.renameFiles).toHaveBeenCalledOnce());
      await waitFor(() => expect(bumpRetry).toHaveBeenCalled());
      expect(invalidateFolders).toHaveBeenCalledWith(['']);
      expect(onOperationSuccess).toHaveBeenCalledWith({
        kind: 'fileRenamed',
        name: 'renamed.pdf',
        isFolder: false,
      });
    });

    it('reports a renamed folder with isFolder: true', async () => {
      const { result, onOperationSuccess, filesApi } = renderMutations();
      vi.mocked(filesApi.renameFiles).mockResolvedValue({
        results: [
          {
            sourcePath: 'folder',
            destinationPath: 'renamed-folder',
            success: true,
          },
        ],
      });

      await act(async () => {
        result.current.onMoveToFiles(
          [
            {
              sourceUrl: '/My files/folder',
              destinationUrl: '/My files/renamed-folder',
              nodeType: DialFileNodeType.FOLDER,
            },
          ],
          '/My files',
          '/My files',
        );
      });

      await waitFor(() => expect(filesApi.renameFiles).toHaveBeenCalledOnce());
      expect(onOperationSuccess).toHaveBeenCalledWith({
        kind: 'fileRenamed',
        name: 'renamed-folder',
        isFolder: true,
      });
    });

    it('shows partial error notification when some items fail', async () => {
      const { result, onNotification, filesApi } = renderMutations();
      vi.mocked(filesApi.renameFiles).mockResolvedValue({
        results: [
          { sourcePath: 'a.pdf', destinationPath: 'a2.pdf', success: true },
          {
            sourcePath: 'b.pdf',
            destinationPath: 'b2.pdf',
            success: false,
            error: 'Forbidden',
          },
        ],
      });

      await act(async () => {
        result.current.onMoveToFiles(
          [
            {
              sourceUrl: '/My files/a.pdf',
              destinationUrl: '/My files/a2.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
            {
              sourceUrl: '/My files/b.pdf',
              destinationUrl: '/My files/b2.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files',
          '/My files',
        );
      });

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith(
          expect.objectContaining({ variant: NotificationVariant.Error }),
        ),
      );
    });

    it('shows an error notification when all items fail', async () => {
      const { result, onNotification, filesApi } = renderMutations();
      vi.mocked(filesApi.renameFiles).mockResolvedValue({
        results: [
          {
            sourcePath: 'file.pdf',
            destinationPath: 'renamed.pdf',
            success: false,
            error: 'Forbidden',
          },
        ],
      });

      await act(async () => {
        result.current.onMoveToFiles(
          [
            {
              sourceUrl: '/My files/file.pdf',
              destinationUrl: '/My files/renamed.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files',
          '/My files',
        );
      });

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith(
          expect.objectContaining({ variant: NotificationVariant.Error }),
        ),
      );
    });

    it('navigates to the destination path after successfully renaming the current folder', async () => {
      const { result, filesApi } = renderMutations({ folderPath: 'reports/' });
      vi.mocked(filesApi.renameFiles).mockResolvedValue({
        results: [
          {
            sourcePath: 'reports/',
            destinationPath: 'archive/',
            success: true,
          },
        ],
      });
      expect(result.current.folderPath).toBe('reports/');

      act(() => {
        result.current.onMoveToFiles(
          [
            {
              sourceUrl: '/My files/reports/',
              destinationUrl: '/My files/archive/',
              nodeType: DialFileNodeType.FOLDER,
            },
          ],
          '/My files',
          '/My files',
        );
      });

      await waitFor(() => expect(result.current.folderPath).toBe('archive/'));
    });

    it('keeps the current path when a current-folder rename fails', async () => {
      const { result, filesApi } = renderMutations({ folderPath: 'reports/' });
      vi.mocked(filesApi.renameFiles).mockResolvedValue({
        results: [
          {
            sourcePath: 'reports/',
            destinationPath: 'archive/',
            success: false,
            error: 'Conflict',
          },
        ],
      });

      act(() => {
        result.current.onMoveToFiles(
          [
            {
              sourceUrl: '/My files/reports/',
              destinationUrl: '/My files/archive/',
              nodeType: DialFileNodeType.FOLDER,
            },
          ],
          '/My files',
          '/My files',
        );
      });

      await waitFor(() => expect(filesApi.renameFiles).toHaveBeenCalledOnce());
      expect(result.current.folderPath).toBe('reports/');
    });

    it('calls only moveFiles for a cross-folder batch, not renameFiles', async () => {
      const { result, onOperationSuccess, filesApi } = renderMutations();
      vi.mocked(filesApi.moveFiles).mockResolvedValue({
        results: [
          {
            sourcePath: 'inbox/draft.pdf',
            destinationPath: 'reports/draft.pdf',
            success: true,
          },
        ],
      });

      await act(async () => {
        result.current.onMoveToFiles(
          [
            {
              sourceUrl: '/My files/inbox/draft.pdf',
              destinationUrl: '/My files/reports/draft.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files/inbox',
          '/My files/reports',
        );
      });

      await waitFor(() => expect(filesApi.moveFiles).toHaveBeenCalledOnce());
      expect(filesApi.renameFiles).not.toHaveBeenCalled();
      expect(onOperationSuccess).toHaveBeenCalledWith({
        kind: 'fileMoved',
        name: 'draft.pdf',
        count: 1,
        destinationFolderName: 'My files/reports',
      });
    });

    it('reports a count for a multi-file move success', async () => {
      const { result, onOperationSuccess, filesApi } = renderMutations();
      vi.mocked(filesApi.moveFiles).mockResolvedValue({
        results: [
          {
            sourcePath: 'inbox/a.pdf',
            destinationPath: 'reports/a.pdf',
            success: true,
          },
          {
            sourcePath: 'inbox/b.pdf',
            destinationPath: 'reports/b.pdf',
            success: true,
          },
        ],
      });

      await act(async () => {
        result.current.onMoveToFiles(
          [
            {
              sourceUrl: '/My files/inbox/a.pdf',
              destinationUrl: '/My files/reports/a.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
            {
              sourceUrl: '/My files/inbox/b.pdf',
              destinationUrl: '/My files/reports/b.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files/inbox',
          '/My files/reports',
        );
      });

      await waitFor(() =>
        expect(onOperationSuccess).toHaveBeenCalledWith(
          expect.objectContaining({ kind: 'filesMoved', count: 2 }),
        ),
      );
    });

    it('passes overwrite=true from conflict resolution to moveFiles', async () => {
      const { result, filesApi } = renderMutations();
      vi.mocked(filesApi.moveFiles).mockResolvedValue({
        results: [
          {
            sourcePath: 'inbox/draft.pdf',
            destinationPath: 'reports/draft.pdf',
            success: true,
          },
        ],
      });

      await act(async () => {
        result.current.onMoveToFiles(
          [
            {
              sourceUrl: '/My files/inbox/draft.pdf',
              destinationUrl: '/My files/reports/draft.pdf',
              overwrite: true,
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files/inbox',
          '/My files/reports',
        );
      });

      await waitFor(() => expect(filesApi.moveFiles).toHaveBeenCalledOnce());
      expect(filesApi.moveFiles).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            destinationPath: 'reports/draft.pdf',
            overwrite: true,
          }),
        ],
        expect.anything(),
      );
    });

    it('calls both renameFiles and moveFiles for a mixed batch and merges the failure notification', async () => {
      const { result, onNotification, filesApi } = renderMutations();
      vi.mocked(filesApi.renameFiles).mockResolvedValue({
        results: [
          {
            sourcePath: 'a.pdf',
            destinationPath: 'a2.pdf',
            success: false,
            error: 'Forbidden',
          },
        ],
      });
      vi.mocked(filesApi.moveFiles).mockResolvedValue({
        results: [
          {
            sourcePath: 'inbox/draft.pdf',
            destinationPath: 'reports/draft.pdf',
            success: true,
          },
        ],
      });

      await act(async () => {
        result.current.onMoveToFiles(
          [
            {
              sourceUrl: '/My files/a.pdf',
              destinationUrl: '/My files/a2.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
            {
              sourceUrl: '/My files/inbox/draft.pdf',
              destinationUrl: '/My files/reports/draft.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files',
          '/My files',
        );
      });

      await waitFor(() => {
        expect(filesApi.renameFiles).toHaveBeenCalledOnce();
        expect(filesApi.moveFiles).toHaveBeenCalledOnce();
      });
      expect(onNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: NotificationVariant.Error }),
      );
    });
  });

  describe('onCopyFiles', () => {
    it('invalidates cache and reports a success event on full copy success', async () => {
      const {
        result,
        invalidateFolders,
        bumpRetry,
        onOperationSuccess,
        filesApi,
      } = renderMutations();
      vi.mocked(filesApi.copyFiles).mockResolvedValue({
        results: [
          {
            sourcePath: 'reports/q1.pdf',
            destinationPath: 'archive/q1.pdf',
            success: true,
          },
        ],
      });

      await act(async () => {
        result.current.onCopyFiles(
          [
            {
              sourceUrl: '/My files/reports/q1.pdf',
              destinationUrl: '/My files/archive/q1.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files/archive',
        );
      });

      await waitFor(() => expect(filesApi.copyFiles).toHaveBeenCalledOnce());
      await waitFor(() => expect(bumpRetry).toHaveBeenCalled());
      expect(invalidateFolders).toHaveBeenCalledWith(['reports/', 'archive/']);
      expect(onOperationSuccess).toHaveBeenCalledWith({
        kind: 'fileCopied',
        name: 'q1.pdf',
        count: 1,
        destinationFolderName: 'My files/archive',
      });
    });

    it('reports a count for a multi-file copy success', async () => {
      const { result, onOperationSuccess, filesApi } = renderMutations();
      vi.mocked(filesApi.copyFiles).mockResolvedValue({
        results: [
          {
            sourcePath: 'a.pdf',
            destinationPath: 'archive/a.pdf',
            success: true,
          },
          {
            sourcePath: 'b.pdf',
            destinationPath: 'archive/b.pdf',
            success: true,
          },
        ],
      });

      await act(async () => {
        result.current.onCopyFiles(
          [
            {
              sourceUrl: '/My files/a.pdf',
              destinationUrl: '/My files/archive/a.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
            {
              sourceUrl: '/My files/b.pdf',
              destinationUrl: '/My files/archive/b.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files/archive',
        );
      });

      await waitFor(() =>
        expect(onOperationSuccess).toHaveBeenCalledWith(
          expect.objectContaining({ kind: 'filesCopied', count: 2 }),
        ),
      );
    });

    it('collapses a double-slash destinationUrl (folder prefix + leading slash) before sending', async () => {
      const { result, filesApi } = renderMutations();
      vi.mocked(filesApi.copyFiles).mockResolvedValue({
        results: [
          {
            sourcePath: 'Folder_for_test_copy/img.png',
            destinationPath: 'folder_for_test_copy_1/img.png',
            success: true,
          },
        ],
      });

      await act(async () => {
        result.current.onCopyFiles(
          [
            {
              sourceUrl: '/My files/Folder_for_test_copy/img.png',
              destinationUrl: '/My files/folder_for_test_copy_1//img.png',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files/folder_for_test_copy_1',
        );
      });

      await waitFor(() => expect(filesApi.copyFiles).toHaveBeenCalledOnce());
      expect(filesApi.copyFiles).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            destinationPath: 'folder_for_test_copy_1/img.png',
          }),
        ],
        expect.anything(),
      );
    });

    it('passes overwrite=true from conflict resolution to copyFiles', async () => {
      const { result, filesApi } = renderMutations();
      vi.mocked(filesApi.copyFiles).mockResolvedValue({
        results: [
          {
            sourcePath: 'requirements.txt',
            destinationPath: 'Folder1/requirements.txt',
            success: true,
          },
        ],
      });

      await act(async () => {
        result.current.onCopyFiles(
          [
            {
              sourceUrl: '/My files/requirements.txt',
              destinationUrl: '/My files/Folder1/requirements.txt',
              overwrite: true,
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files/Folder1',
        );
      });

      await waitFor(() => expect(filesApi.copyFiles).toHaveBeenCalledOnce());
      expect(filesApi.copyFiles).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            destinationPath: 'Folder1/requirements.txt',
            overwrite: true,
          }),
        ],
        expect.anything(),
      );
    });

    it('shows a partial-failure notification with the failed count', async () => {
      const { result, onNotification, filesApi } = renderMutations();
      vi.mocked(filesApi.copyFiles).mockResolvedValue({
        results: [
          { sourcePath: 'a.pdf', destinationPath: 'a2.pdf', success: true },
          {
            sourcePath: 'b.pdf',
            destinationPath: 'b2.pdf',
            success: false,
            error: 'Forbidden',
          },
        ],
      });

      await act(async () => {
        result.current.onCopyFiles(
          [
            {
              sourceUrl: '/My files/a.pdf',
              destinationUrl: '/My files/a2.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
            {
              sourceUrl: '/My files/b.pdf',
              destinationUrl: '/My files/b2.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files',
        );
      });

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: NotificationVariant.Error,
            reason: FileManagerNotificationReason.CopyPartiallyFailed,
            count: 1,
          }),
        ),
      );
    });

    it('shows a full-failure notification when every item fails', async () => {
      const { result, onNotification, filesApi } = renderMutations();
      vi.mocked(filesApi.copyFiles).mockResolvedValue({
        results: [
          {
            sourcePath: 'reports/q1.pdf',
            destinationPath: 'archive/q1.pdf',
            success: false,
            error: 'Forbidden',
          },
        ],
      });

      await act(async () => {
        result.current.onCopyFiles(
          [
            {
              sourceUrl: '/My files/reports/q1.pdf',
              destinationUrl: '/My files/archive/q1.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files/archive',
        );
      });

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: NotificationVariant.Error,
            reason: FileManagerNotificationReason.CopyFailed,
          }),
        ),
      );
    });

    it('handles a same-folder destination (duplicate) correctly on success', async () => {
      const { result, invalidateFolders, onOperationSuccess, filesApi } =
        renderMutations();
      vi.mocked(filesApi.copyFiles).mockResolvedValue({
        results: [
          {
            sourcePath: 'reports/q1.pdf',
            destinationPath: 'reports/q1 (1).pdf',
            success: true,
          },
        ],
      });

      await act(async () => {
        result.current.onCopyFiles(
          [
            {
              sourceUrl: '/My files/reports/q1.pdf',
              destinationUrl: '/My files/reports/q1 (1).pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files/reports',
        );
      });

      await waitFor(() => expect(filesApi.copyFiles).toHaveBeenCalledOnce());
      expect(filesApi.copyFiles).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            bucket: BUCKET,
            sourcePath: 'reports/q1.pdf',
            destinationPath: 'reports/q1 (1).pdf',
          }),
        ],
        expect.anything(),
      );
      // Source and destination share the same parent folder — invalidated once.
      expect(invalidateFolders).toHaveBeenCalledWith(['reports/']);
      expect(onOperationSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'fileCopied' }),
      );
    });

    it('shows the existing partial-failure notification for a same-folder destination (duplicate)', async () => {
      const { result, onNotification, filesApi } = renderMutations();
      vi.mocked(filesApi.copyFiles).mockResolvedValue({
        results: [
          {
            sourcePath: 'a.pdf',
            destinationPath: 'a (1).pdf',
            success: true,
          },
          {
            sourcePath: 'b.pdf',
            destinationPath: 'b (1).pdf',
            success: false,
            error: 'Forbidden',
          },
        ],
      });

      await act(async () => {
        result.current.onCopyFiles(
          [
            {
              sourceUrl: '/My files/a.pdf',
              destinationUrl: '/My files/a (1).pdf',
              nodeType: DialFileNodeType.ITEM,
            },
            {
              sourceUrl: '/My files/b.pdf',
              destinationUrl: '/My files/b (1).pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files',
        );
      });

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: NotificationVariant.Error,
            reason: FileManagerNotificationReason.CopyPartiallyFailed,
          }),
        ),
      );
    });

    it('clears isCopying with no notification when cancelled', async () => {
      const { result, onNotification, filesApi } = renderMutations();
      vi.mocked(filesApi.copyFiles).mockImplementation(
        (_items, signal) =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      );

      act(() => {
        result.current.onCopyFiles(
          [
            {
              sourceUrl: '/My files/reports/q1.pdf',
              destinationUrl: '/My files/archive/q1.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files/archive',
        );
      });

      await waitFor(() => expect(result.current.isCopying).toBe(true));

      await act(async () => {
        result.current.cancelCopyMove();
      });

      await waitFor(() => expect(result.current.isCopying).toBe(false));
      expect(onNotification).not.toHaveBeenCalled();
    });
  });

  describe('onDownloadFiles', () => {
    it('reports a fileDownloaded success event for a single file', async () => {
      const { result, onOperationSuccess, filesApi, downloadDestination } =
        renderMutations();
      vi.mocked(filesApi.downloadFile).mockResolvedValue(
        new Response('data', { status: 200 }),
      );

      const singleFile: DialFile = {
        id: 'report.pdf',
        name: 'report.pdf',
        path: '/My files/report.pdf',
        parentPath: '/My files',
        nodeType: DialFileNodeType.ITEM,
        folderId: BUCKET,
        bucket: BUCKET,
      };

      await act(async () => {
        result.current.onDownloadFiles([singleFile]);
      });

      expect(downloadDestination.resolveDestination).toHaveBeenCalled();
      expect(onOperationSuccess).toHaveBeenCalledWith({
        kind: 'fileDownloaded',
        name: 'report.pdf',
        count: 1,
      });
    });

    it('reports a filesDownloaded success event with a count for a multi-item download', async () => {
      const { result, onOperationSuccess, filesApi } = renderMutations();
      vi.mocked(filesApi.downloadArchive).mockResolvedValue(
        new Response('zip', { status: 200 }),
      );

      const files: DialFile[] = [
        {
          id: 'a.pdf',
          name: 'a.pdf',
          path: '/My files/a.pdf',
          parentPath: '/My files',
          nodeType: DialFileNodeType.ITEM,
          folderId: BUCKET,
          bucket: BUCKET,
        },
        {
          id: 'b.pdf',
          name: 'b.pdf',
          path: '/My files/b.pdf',
          parentPath: '/My files',
          nodeType: DialFileNodeType.ITEM,
          folderId: BUCKET,
          bucket: BUCKET,
        },
      ];

      await act(async () => {
        result.current.onDownloadFiles(files);
      });

      expect(onOperationSuccess).toHaveBeenCalledWith({
        kind: 'filesDownloaded',
        count: 2,
      });
    });

    it('reports a structured failure notification when the download response is not ok', async () => {
      const { result, onNotification, filesApi } = renderMutations();
      vi.mocked(filesApi.downloadFile).mockResolvedValue(
        new Response('err', { status: 500 }),
      );

      const singleFile: DialFile = {
        id: 'report.pdf',
        name: 'report.pdf',
        path: '/My files/report.pdf',
        parentPath: '/My files',
        nodeType: DialFileNodeType.ITEM,
        folderId: BUCKET,
        bucket: BUCKET,
      };

      await act(async () => {
        result.current.onDownloadFiles([singleFile]);
      });

      expect(onNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Error,
        reason: FileManagerNotificationReason.DownloadFileFailed,
      });
    });

    it('does not download when the destination picker is cancelled', async () => {
      const { result, filesApi, downloadDestination } = renderMutations();
      vi.mocked(downloadDestination.resolveDestination).mockResolvedValue({
        type: DownloadDestinationType.Cancelled,
      });

      const singleFile: DialFile = {
        id: 'report.pdf',
        name: 'report.pdf',
        path: '/My files/report.pdf',
        parentPath: '/My files',
        nodeType: DialFileNodeType.ITEM,
        folderId: BUCKET,
        bucket: BUCKET,
      };

      await act(async () => {
        result.current.onDownloadFiles([singleFile]);
      });

      expect(filesApi.downloadFile).not.toHaveBeenCalled();
    });
  });

  describe('onDeleteFiles', () => {
    it('reports a FilesDeleted notification and invalidates the affected parent folder on success', async () => {
      const { result, invalidateFolders, bumpRetry, onNotification, filesApi } =
        renderMutations();
      vi.mocked(filesApi.deleteFiles).mockResolvedValue({
        results: [{ path: 'report.pdf', success: true }],
      });

      await act(async () => {
        result.current.onDeleteFiles(
          [
            {
              sourceUrl: '/My files/report.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files',
        );
      });

      expect(invalidateFolders).toHaveBeenCalledWith(['']);
      expect(bumpRetry).toHaveBeenCalled();
      expect(onNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: NotificationVariant.Success,
          reason: FileManagerNotificationReason.FilesDeleted,
          count: 1,
        }),
      );
    });

    it('reports a partial-failure notification with the failed names', async () => {
      const { result, onNotification, filesApi } = renderMutations();
      vi.mocked(filesApi.deleteFiles).mockResolvedValue({
        results: [
          { path: 'a.pdf', success: true },
          { path: 'b.pdf', success: false, error: 'Forbidden' },
        ],
      });

      await act(async () => {
        result.current.onDeleteFiles(
          [
            { sourceUrl: '/My files/a.pdf', nodeType: DialFileNodeType.ITEM },
            { sourceUrl: '/My files/b.pdf', nodeType: DialFileNodeType.ITEM },
          ],
          '/My files',
        );
      });

      expect(onNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: NotificationVariant.Error,
          reason: FileManagerNotificationReason.FilesDeletePartiallyFailed,
          names: ['b.pdf'],
          restCount: 0,
        }),
      );
    });

    it('reports a DeleteFailed notification when the request itself rejects', async () => {
      const { result, onNotification, filesApi } = renderMutations();
      vi.mocked(filesApi.deleteFiles).mockRejectedValue(new Error('network'));

      await act(async () => {
        result.current.onDeleteFiles(
          [
            {
              sourceUrl: '/My files/report.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files',
        );
      });

      expect(onNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Error,
        reason: FileManagerNotificationReason.DeleteFailed,
      });
    });
  });
});
