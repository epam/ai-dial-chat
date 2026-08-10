import { HIDDEN_FILE } from '@epam/ai-dial-chat-shared';
import type { DialFile } from '@epam/ai-dial-react-file-manager';
import {
  DialFileManagerTabs,
  DialFileNodeType,
} from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DialFileManagerI18nKeys } from '../../../../constants/translation-keys';
import * as filesApi from '../../../../server-api/files.api';
import type { SharedRootMeta } from '../../dial-file-manager.model';
import type { UseDialFileMutationsOptions } from '../../useDialFileMutations';
import { useDialFileMutations } from '../../useDialFileMutations';

vi.mock('../../../../server-api/files.api');
vi.mock('../../../../utils/file-download', () => ({
  DownloadDestinationType: {
    Blob: 'blob',
    Stream: 'stream',
    Cancelled: 'cancelled',
  },
  prepareDownloadDestination: vi.fn().mockResolvedValue({ type: 'blob' }),
  triggerBrowserDownload: vi.fn().mockResolvedValue(undefined),
}));

const mockRenameFiles = vi.mocked(filesApi.renameFiles);
const mockMoveFiles = vi.mocked(filesApi.moveFiles);
const mockCopyFiles = vi.mocked(filesApi.copyFiles);
const mockCreateFolder = vi.mocked(filesApi.createFolder);

const BUCKET = 'test-bucket';

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
  const sharedRootMetaRef = { current: new Map<string, SharedRootMeta>() };

  const { result } = renderHook(() => {
    const [folderPath, setFolderPath] = useState(overrides.folderPath ?? '');
    const mutations = useDialFileMutations({
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

    it('returns invalid chars error for a folder name containing colon', () => {
      const { result } = renderMutations({
        forbiddenSymbolsRegExp: /[:]/,
      });
      const msg = result.current.onCreateFolderValidate(
        'reports:2026',
        parentFolder,
      );
      expect(msg).toBe(DialFileManagerI18nKeys.FolderNameInvalidChars);
    });

    it('returns invalid chars error for a folder name containing a path separator', () => {
      const { result } = renderMutations();
      const msg = result.current.onCreateFolderValidate(
        'reports/2026',
        parentFolder,
      );
      expect(msg).toBe(DialFileManagerI18nKeys.FolderNameInvalidChars);
    });
  });

  describe('onCreateFolder', () => {
    const uploadItem = (name: string) => ({
      name,
      fileContent: new File([], name),
    });

    it('does not call createFolder for a name containing a forbidden symbol', async () => {
      const { result } = renderMutations({
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

      expect(mockCreateFolder).not.toHaveBeenCalled();
    });

    it('does not call createFolder for an empty name', async () => {
      const { result } = renderMutations({ folderPath: '' });

      await act(async () => {
        // Trailing double slash parses to an empty final name segment.
        await result.current.onCreateFolder(
          uploadItem(''),
          '/My files//',
          'file-2',
        );
      });

      expect(mockCreateFolder).not.toHaveBeenCalled();
    });

    it('does not call createFolder for the reserved marker name', async () => {
      const { result } = renderMutations({ folderPath: '' });

      await act(async () => {
        await result.current.onCreateFolder(
          uploadItem(HIDDEN_FILE),
          `/My files/${HIDDEN_FILE}`,
          'file-3',
        );
      });

      expect(mockCreateFolder).not.toHaveBeenCalled();
    });

    it('calls createFolder for a valid name at the current folder', async () => {
      mockCreateFolder.mockResolvedValue({
        name: 'reports',
        path: `files/${BUCKET}/reports/`,
        parentPath: '',
        bucket: BUCKET,
        nodeType: 'folder',
        folderId: `${BUCKET}:files/${BUCKET}/reports/`,
      });

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

      const { result, mergeCreatedFolder, bumpRetry } = renderMutations({
        folderPath: '',
        currentFolder: rootFolder,
      });

      await act(async () => {
        await result.current.onCreateFolder(
          uploadItem('reports'),
          '/My files/reports',
          'file-4',
        );
      });

      expect(mockCreateFolder).toHaveBeenCalledWith({
        bucket: BUCKET,
        parentPath: undefined,
        name: 'reports',
      });
      expect(mergeCreatedFolder).toHaveBeenCalled();
      expect(bumpRetry).toHaveBeenCalled();
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

      const { result } = renderMutations({
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

      expect(mockCreateFolder).not.toHaveBeenCalled();
    });

    it('rejects an invalid name without erroring when creating outside the currently browsed folder', async () => {
      // currentFolder/folderPath reflect "reports/", but the new folder is
      // being created under a different parent (e.g. a destination-folder
      // popup) — parentFolder falls back to the minimal shim with no items.
      const { result } = renderMutations({ folderPath: 'reports/' });

      await act(async () => {
        // Trailing double slash parses to an empty final name segment,
        // under a parent ("archive/") different from folderPath ("reports/").
        await result.current.onCreateFolder(
          uploadItem(''),
          '/My files/archive//',
          'file-5',
        );
      });

      expect(mockCreateFolder).not.toHaveBeenCalled();
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

    it('returns empty-name error for an empty name', () => {
      const { result } = renderMutations();
      expect(result.current.onRenameValidate('', dummyItem)).toBeTruthy();
    });

    it('returns reserved name error for ".dial_folder"', () => {
      const { result } = renderMutations();
      const msg = result.current.onRenameValidate(HIDDEN_FILE, dummyItem);
      expect(msg).toBeTruthy();
    });

    it('returns invalid chars error for name containing forward slash', () => {
      const { result } = renderMutations();
      const msg = result.current.onRenameValidate('a/b', dummyItem);
      expect(msg).toBe(DialFileManagerI18nKeys.ForbiddenSymbolsTooltip);
    });

    it('returns invalid chars error for name containing backslash', () => {
      const { result } = renderMutations();
      const msg = result.current.onRenameValidate('a\\b', dummyItem);
      expect(msg).toBe(DialFileManagerI18nKeys.ForbiddenSymbolsTooltip);
    });

    it('returns forbidden-symbols error for name containing colon', () => {
      const { result } = renderMutations({
        forbiddenSymbolsRegExp: /[:]/,
      });
      const msg = result.current.onRenameValidate('file:name.pdf', dummyItem);
      expect(msg).toBe(DialFileManagerI18nKeys.ForbiddenSymbolsTooltip);
    });

    it('returns too-long error for name longer than 255 chars', () => {
      const { result } = renderMutations();
      const msg = result.current.onRenameValidate('a'.repeat(256), dummyItem);
      expect(msg).toBeTruthy();
    });

    it('returns forbidden-symbols error when name matches forbiddenSymbolsRegExp', () => {
      const { result } = renderMutations({
        forbiddenSymbolsRegExp: /[<>]/,
      });
      const msg = result.current.onRenameValidate('file<name>', dummyItem);
      expect(msg).toBe(DialFileManagerI18nKeys.ForbiddenSymbolsTooltip);
    });

    it('returns folder invalid chars error when renaming a folder with a forbidden symbol', () => {
      const { result } = renderMutations({
        forbiddenSymbolsRegExp: /[:]/,
      });
      const folderItem: DialFile = {
        ...dummyItem,
        name: 'reports',
        path: '/My files/reports',
        nodeType: DialFileNodeType.FOLDER,
      };
      const msg = result.current.onRenameValidate('reports:2026', folderItem);
      expect(msg).toBe(DialFileManagerI18nKeys.FolderNameInvalidChars);
    });

    it('returns null when name does not match forbiddenSymbolsRegExp', () => {
      const { result } = renderMutations({
        forbiddenSymbolsRegExp: /[<>]/,
      });
      expect(
        result.current.onRenameValidate('valid.pdf', dummyItem),
      ).toBeNull();
    });

    it('returns duplicate-name error for a sibling with the same name', () => {
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

      expect(
        result.current.onRenameValidate('REPORT.PDF', dummyItem),
      ).toBeTruthy();
    });
  });

  describe('onMoveToFiles', () => {
    beforeEach(() => {
      mockRenameFiles.mockResolvedValue({ results: [] });
    });

    it('calls renameFiles and triggers cache invalidation and retry on success', async () => {
      mockRenameFiles.mockResolvedValue({
        results: [
          {
            sourcePath: 'file.pdf',
            destinationPath: 'renamed.pdf',
            success: true,
          },
        ],
      });

      const { result, invalidateFolders, bumpRetry } = renderMutations();

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

      await waitFor(() => expect(mockRenameFiles).toHaveBeenCalledOnce());
      await waitFor(() => expect(bumpRetry).toHaveBeenCalled());
      expect(invalidateFolders).toHaveBeenCalledWith(['']);
    });

    it('shows partial error toast when some items fail', async () => {
      mockRenameFiles.mockResolvedValue({
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

      const { result, onNotification } = renderMutations();

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

    it('shows error toast when all items fail', async () => {
      mockRenameFiles.mockResolvedValue({
        results: [
          {
            sourcePath: 'file.pdf',
            destinationPath: 'renamed.pdf',
            success: false,
            error: 'Forbidden',
          },
        ],
      });

      const { result, onNotification } = renderMutations();

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
      mockRenameFiles.mockResolvedValue({
        results: [
          {
            sourcePath: 'reports/',
            destinationPath: 'archive/',
            success: true,
          },
        ],
      });

      const { result } = renderMutations({ folderPath: 'reports/' });
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
      mockRenameFiles.mockResolvedValue({
        results: [
          {
            sourcePath: 'reports/',
            destinationPath: 'archive/',
            success: false,
            error: 'Conflict',
          },
        ],
      });

      const { result } = renderMutations({ folderPath: 'reports/' });

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

      await waitFor(() => expect(mockRenameFiles).toHaveBeenCalledOnce());
      expect(result.current.folderPath).toBe('reports/');
    });

    it('calls only moveFiles for a cross-folder batch, not renameFiles', async () => {
      mockMoveFiles.mockResolvedValue({
        results: [
          {
            sourcePath: 'inbox/draft.pdf',
            destinationPath: 'reports/draft.pdf',
            success: true,
          },
        ],
      });

      const { result, onNotification } = renderMutations();

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

      await waitFor(() => expect(mockMoveFiles).toHaveBeenCalledOnce());
      expect(mockRenameFiles).not.toHaveBeenCalled();
      expect(onNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Success,
        title: 'dialFileManager.itemMovedSuccessfully',
        message: 'dialFileManager.itemMovedToFolder',
      });
    });

    it('shows a success toast with the moved item count for multiple files', async () => {
      mockMoveFiles.mockResolvedValue({
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

      const { result, onNotification } = renderMutations();

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
        expect(onNotification).toHaveBeenCalledWith({
          variant: NotificationVariant.Success,
          title: 'dialFileManager.itemsMovedSuccessfully',
          message: 'dialFileManager.itemsMovedToFolder',
        }),
      );
    });

    it('passes overwrite=true from conflict resolution to moveFiles', async () => {
      mockMoveFiles.mockResolvedValue({
        results: [
          {
            sourcePath: 'inbox/draft.pdf',
            destinationPath: 'reports/draft.pdf',
            success: true,
          },
        ],
      });

      const { result } = renderMutations();

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

      await waitFor(() => expect(mockMoveFiles).toHaveBeenCalledOnce());
      expect(mockMoveFiles).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            destinationPath: 'reports/draft.pdf',
            overwrite: true,
          }),
        ],
        expect.anything(),
      );
    });

    it('calls both renameFiles and moveFiles for a mixed batch and merges the failure toast', async () => {
      mockRenameFiles.mockResolvedValue({
        results: [
          {
            sourcePath: 'a.pdf',
            destinationPath: 'a2.pdf',
            success: false,
            error: 'Forbidden',
          },
        ],
      });
      mockMoveFiles.mockResolvedValue({
        results: [
          {
            sourcePath: 'inbox/draft.pdf',
            destinationPath: 'reports/draft.pdf',
            success: true,
          },
        ],
      });

      const { result, onNotification } = renderMutations();

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
        expect(mockRenameFiles).toHaveBeenCalledOnce();
        expect(mockMoveFiles).toHaveBeenCalledOnce();
      });
      expect(onNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: NotificationVariant.Error }),
      );
    });
  });

  describe('onCopyFiles', () => {
    it('invalidates cache and shows a success toast on full copy success', async () => {
      mockCopyFiles.mockResolvedValue({
        results: [
          {
            sourcePath: 'reports/q1.pdf',
            destinationPath: 'archive/q1.pdf',
            success: true,
          },
        ],
      });

      const { result, invalidateFolders, bumpRetry, onNotification } =
        renderMutations();

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

      await waitFor(() => expect(mockCopyFiles).toHaveBeenCalledOnce());
      await waitFor(() => expect(bumpRetry).toHaveBeenCalled());
      expect(invalidateFolders).toHaveBeenCalledWith(['reports/', 'archive/']);
      expect(onNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Success,
        title: 'dialFileManager.itemCopiedSuccessfully',
        message: 'dialFileManager.itemCopiedToFolder',
      });
    });

    it('shows a success toast with the copied item count for multiple files', async () => {
      mockCopyFiles.mockResolvedValue({
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

      const { result, onNotification } = renderMutations();

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
        expect(onNotification).toHaveBeenCalledWith({
          variant: NotificationVariant.Success,
          title: 'dialFileManager.itemsCopiedSuccessfully',
          message: 'dialFileManager.itemsCopiedToFolder',
        }),
      );
    });

    it('collapses a double-slash destinationUrl (folder prefix + leading slash) before sending', async () => {
      mockCopyFiles.mockResolvedValue({
        results: [
          {
            sourcePath: 'Folder_for_test_copy/img.png',
            destinationPath: 'folder_for_test_copy_1/img.png',
            success: true,
          },
        ],
      });

      const { result } = renderMutations();

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

      await waitFor(() => expect(mockCopyFiles).toHaveBeenCalledOnce());
      expect(mockCopyFiles).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            destinationPath: 'folder_for_test_copy_1/img.png',
          }),
        ],
        expect.anything(),
      );
    });

    it('passes overwrite=true from conflict resolution to copyFiles', async () => {
      mockCopyFiles.mockResolvedValue({
        results: [
          {
            sourcePath: 'requirements.txt',
            destinationPath: 'Folder1/requirements.txt',
            success: true,
          },
        ],
      });

      const { result } = renderMutations();

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

      await waitFor(() => expect(mockCopyFiles).toHaveBeenCalledOnce());
      expect(mockCopyFiles).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            destinationPath: 'Folder1/requirements.txt',
            overwrite: true,
          }),
        ],
        expect.anything(),
      );
    });

    it('shows a partial-failure toast with the failed count', async () => {
      mockCopyFiles.mockResolvedValue({
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

      const { result, onNotification } = renderMutations();

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
          expect.objectContaining({ variant: NotificationVariant.Error }),
        ),
      );
    });

    it('shows a full-failure toast when every item fails', async () => {
      mockCopyFiles.mockResolvedValue({
        results: [
          {
            sourcePath: 'reports/q1.pdf',
            destinationPath: 'archive/q1.pdf',
            success: false,
            error: 'Forbidden',
          },
        ],
      });

      const { result, onNotification } = renderMutations();

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
          expect.objectContaining({ variant: NotificationVariant.Error }),
        ),
      );
    });

    it('handles a same-folder destination (duplicate) correctly on success', async () => {
      mockCopyFiles.mockResolvedValue({
        results: [
          {
            sourcePath: 'reports/q1.pdf',
            destinationPath: 'reports/q1 (1).pdf',
            success: true,
          },
        ],
      });

      const { result, invalidateFolders, onNotification } = renderMutations();

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

      await waitFor(() => expect(mockCopyFiles).toHaveBeenCalledOnce());
      expect(mockCopyFiles).toHaveBeenCalledWith(
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
      expect(onNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Success,
        title: 'dialFileManager.itemCopiedSuccessfully',
        message: 'dialFileManager.itemCopiedToFolder',
      });
    });

    it('shows the existing partial-failure toast for a same-folder destination (duplicate)', async () => {
      mockCopyFiles.mockResolvedValue({
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

      const { result, onNotification } = renderMutations();

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
            message: 'dialFileManager.copyPartialError',
          }),
        ),
      );
    });

    it('clears isCopying with no toast when cancelled', async () => {
      mockCopyFiles.mockImplementation(
        (_items, signal) =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      );

      const { result, onNotification } = renderMutations();

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
});
