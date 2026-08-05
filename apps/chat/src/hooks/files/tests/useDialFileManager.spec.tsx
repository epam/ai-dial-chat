import { HIDDEN_FILE } from '@epam/ai-dial-chat-shared';
import {
  DialFileManagerActions,
  DialFileManagerTabs,
  DialFileNodeType,
  DialFilePermission,
  FileManagerColumnKey,
} from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { ListFilesItemDto } from '@epam/chat-api-client';
import { ListFilesItemDtoNodeTypeEnum } from '@epam/chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as filesApi from '../../../server-api/files.api';
import {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
} from '../../../types/file-manager-variant';
import { useDialFileManager } from '../useDialFileManager';

vi.mock('../../../server-api/files.api');
vi.mock('../../../utils/file-name', () => ({
  sanitizeFileName: vi.fn((name: string) => name),
}));
vi.mock('../../../utils/file-download', () => ({
  DownloadDestinationType: {
    Blob: 'blob',
    Stream: 'stream',
    Cancelled: 'cancelled',
  },
  prepareDownloadDestination: vi.fn().mockResolvedValue({ type: 'blob' }),
  triggerBrowserDownload: vi.fn().mockResolvedValue(undefined),
}));

const mockListFiles = vi.mocked(filesApi.listFiles);
const mockListSharedFiles = vi.mocked(filesApi.listSharedFiles);
const mockListPublicFiles = vi.mocked(filesApi.listPublicFiles);
const mockListSharedByMe = vi.mocked(filesApi.listSharedByMe);
const mockDownloadArchive = vi.mocked(filesApi.downloadArchive);
const mockDeleteFiles = vi.mocked(filesApi.deleteFiles);
const mockCopyFiles = vi.mocked(filesApi.copyFiles);
const mockMoveFiles = vi.mocked(filesApi.moveFiles);
const mockDiscardShared = vi.mocked(filesApi.discardShared);
const mockRevokeAccess = vi.mocked(filesApi.revokeAccess);
const mockGetFileMetadata = vi.mocked(filesApi.getFileMetadata);

const BUCKET = 'test-bucket';

const OWNER_BUCKET = 'owner-bucket';

const emptySharedListResponse = { bucket: '', path: '', items: [] };
const emptyPublicListResponse = { bucket: 'public', path: '', items: [] };
const emptySharedByMeResponse = { bucket: BUCKET, path: '', items: [] };

beforeEach(() => {
  mockListFiles.mockResolvedValue({
    bucket: BUCKET,
    path: '',
    items: [],
    nextToken: undefined,
  });
  mockListSharedFiles.mockResolvedValue(emptySharedListResponse);
  mockListPublicFiles.mockResolvedValue(emptyPublicListResponse);
  mockListSharedByMe.mockResolvedValue(emptySharedByMeResponse);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useDialFileManager', () => {
  it('starts with isLoading true and resolves to items', async () => {
    const item: ListFilesItemDto = {
      name: 'report.pdf',
      path: 'report.pdf',
      folderId: `${BUCKET}:`,
      nodeType: ListFilesItemDtoNodeTypeEnum.Item,
      bucket: BUCKET,
    };
    mockListFiles.mockResolvedValue({
      bucket: BUCKET,
      path: '',
      items: [item],
      nextToken: undefined,
    });

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('resolves with no error for an empty folder', async () => {
    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // buildDialFileTree always produces at least the root node
    expect(result.current.error).toBeNull();
  });

  it('sets error when listFiles rejects', async () => {
    mockListFiles.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('dialFileManager.error');
  });

  it('re-fetches and clears error after retry', async () => {
    mockListFiles.mockRejectedValueOnce(new Error('fail'));
    mockListFiles.mockResolvedValue({
      bucket: BUCKET,
      path: '',
      items: [],
      nextToken: undefined,
    });

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() =>
      expect(result.current.error).toBe('dialFileManager.error'),
    );

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(mockListFiles).toHaveBeenCalledTimes(2);
  });

  describe('variant', () => {
    it('defaults to Attach and fetches the root listing on mount', async () => {
      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      expect(mockListFiles).toHaveBeenCalledWith(
        expect.objectContaining({ path: '' }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it('fetches the root listing on mount for the Standalone variant', async () => {
      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          variant: DialFileManagerVariant.Standalone,
        }),
      );
      expect(mockListFiles).toHaveBeenCalledWith(
        expect.objectContaining({ path: '' }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });
  });

  it('navigates to a subfolder via onPathChange', async () => {
    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.onPathChange('/My files/reports/'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'reports/' }),
    );
    expect(result.current.path).toBe('/My files/reports/');
  });

  it("gives a nested file a parentPath matching its folder node's own path", async () => {
    const reportsFolder: ListFilesItemDto = {
      name: 'reports',
      path: 'reports/',
      folderId: `${BUCKET}:reports/`,
      nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
      bucket: BUCKET,
    };
    const q1File: ListFilesItemDto = {
      name: 'q1.pdf',
      path: 'reports/q1.pdf',
      folderId: `${BUCKET}:reports/`,
      nodeType: ListFilesItemDtoNodeTypeEnum.Item,
      bucket: BUCKET,
    };
    mockListFiles.mockImplementation(async ({ path }) => ({
      bucket: BUCKET,
      path: path ?? '',
      items: path === 'reports/' ? [q1File] : [reportsFolder],
      nextToken: undefined,
    }));

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.onPathChange('/My files/reports/'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const reportsNode = result.current.items[0]?.items?.find(
      (i) => i.name === 'reports',
    );
    expect(reportsNode?.path).toBe('/My files/reports/');

    const q1Node = reportsNode?.items?.find((i) => i.name === 'q1.pdf');
    expect(q1Node?.parentPath).toBe(reportsNode?.path);
  });

  it('preloads a destination-popup folder without navigating the outer grid', async () => {
    const targetFolder: ListFilesItemDto = {
      name: 'Folder1',
      path: 'Folder1/',
      folderId: `${BUCKET}:Folder1/`,
      nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
      bucket: BUCKET,
    };
    const existingFile: ListFilesItemDto = {
      name: 'requirements.txt',
      path: 'Folder1/requirements.txt',
      folderId: `${BUCKET}:Folder1/`,
      nodeType: ListFilesItemDtoNodeTypeEnum.Item,
      bucket: BUCKET,
    };
    mockListFiles.mockImplementation(async ({ path }) => ({
      bucket: BUCKET,
      path: path ?? '',
      items: path === 'Folder1/' ? [existingFile] : [targetFolder],
      nextToken: undefined,
    }));

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onFolderPopupPathChange('/My files/Folder1/');
    });

    await waitFor(() =>
      expect(mockListFiles).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'Folder1/' }),
      ),
    );
    expect(result.current.path).toBe('/My files');

    await waitFor(() =>
      expect(
        result.current.items[0]?.items
          ?.find((item) => item.name === 'Folder1')
          ?.items?.some((item) => item.name === 'requirements.txt'),
      ).toBe(true),
    );
  });

  it('marks a destination-popup folder as loading while its listing is pending', async () => {
    const targetFolder: ListFilesItemDto = {
      name: 'Folder1',
      path: 'Folder1/',
      folderId: `${BUCKET}:Folder1/`,
      nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
      bucket: BUCKET,
    };
    let resolveFolderListing: (
      value: Awaited<ReturnType<typeof filesApi.listFiles>>,
    ) => void = () => undefined;
    const folderListingPromise = new Promise<
      Awaited<ReturnType<typeof filesApi.listFiles>>
    >((resolve) => {
      resolveFolderListing = resolve;
    });

    mockListFiles.mockImplementation(({ path }) => {
      if (path === 'Folder1/') {
        return folderListingPromise;
      }

      return Promise.resolve({
        bucket: BUCKET,
        path: path ?? '',
        items: [targetFolder],
        nextToken: undefined,
      });
    });

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onFolderPopupPathChange('/My files/Folder1/');
    });

    await waitFor(() =>
      expect(
        result.current.folderPopupLoadingPaths.has('/My files/Folder1'),
      ).toBe(true),
    );

    await act(async () => {
      resolveFolderListing({
        bucket: BUCKET,
        path: 'Folder1/',
        items: [],
        nextToken: undefined,
      });
      await folderListingPromise;
    });

    await waitFor(() =>
      expect(
        result.current.folderPopupLoadingPaths.has('/My files/Folder1'),
      ).toBe(false),
    );
  });

  it('marks a destination-popup folder as loading when the same folder is already expanding in the tree', async () => {
    const targetFolder: ListFilesItemDto = {
      name: 'Folder1',
      path: 'Folder1/',
      folderId: `${BUCKET}:Folder1/`,
      nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
      bucket: BUCKET,
    };
    let resolveFolderListing: (
      value: Awaited<ReturnType<typeof filesApi.listFiles>>,
    ) => void = () => undefined;
    const folderListingPromise = new Promise<
      Awaited<ReturnType<typeof filesApi.listFiles>>
    >((resolve) => {
      resolveFolderListing = resolve;
    });

    mockListFiles.mockImplementation(({ path }) => {
      if (path === 'Folder1/') {
        return folderListingPromise;
      }

      return Promise.resolve({
        bucket: BUCKET,
        path: path ?? '',
        items: [targetFolder],
        nextToken: undefined,
      });
    });

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onExpandedPathsChange(new Set(['/My files/Folder1/']));
    });
    await waitFor(() =>
      expect(mockListFiles).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'Folder1/' }),
      ),
    );

    act(() => {
      result.current.onFolderPopupPathChange('/My files/Folder1/');
    });

    await waitFor(() =>
      expect(
        result.current.folderPopupLoadingPaths.has('/My files/Folder1'),
      ).toBe(true),
    );

    await act(async () => {
      resolveFolderListing({
        bucket: BUCKET,
        path: 'Folder1/',
        items: [],
        nextToken: undefined,
      });
      await folderListingPromise;
    });

    await waitFor(() =>
      expect(
        result.current.folderPopupLoadingPaths.has('/My files/Folder1'),
      ).toBe(false),
    );
  });

  it('does not refetch an already cached destination-popup folder', async () => {
    const targetFolder: ListFilesItemDto = {
      name: 'Folder1',
      path: 'Folder1/',
      folderId: `${BUCKET}:Folder1/`,
      nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
      bucket: BUCKET,
    };
    const existingFile: ListFilesItemDto = {
      name: 'requirements.txt',
      path: 'Folder1/requirements.txt',
      folderId: `${BUCKET}:Folder1/`,
      nodeType: ListFilesItemDtoNodeTypeEnum.Item,
      bucket: BUCKET,
    };
    mockListFiles.mockImplementation(async ({ path }) => ({
      bucket: BUCKET,
      path: path ?? '',
      items: path === 'Folder1/' ? [existingFile] : [targetFolder],
      nextToken: undefined,
    }));

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onFolderPopupPathChange('/My files/Folder1/');
    });

    await waitFor(() =>
      expect(mockListFiles).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'Folder1/' }),
      ),
    );
    await waitFor(() =>
      expect(
        result.current.items[0]?.items?.find((item) => item.name === 'Folder1')
          ?.items?.[0]?.name,
      ).toBe('requirements.txt'),
    );
    const callCount = mockListFiles.mock.calls.length;

    act(() => {
      result.current.onFolderPopupPathChange('/My files/Folder1/');
    });

    expect(mockListFiles).toHaveBeenCalledTimes(callCount);
  });

  it('navigates via onPathChange without leading slash (DialFileManager breadcrumb format)', async () => {
    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    /*
     * DialFileManager breadcrumb calls onPathChange with "My files/reports"
     * (no leading /, no trailing /)
     */
    act(() => result.current.onPathChange('My files/reports'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'reports/' }),
    );
    expect(result.current.path).toBe('/My files/reports/');
  });

  it('resets folderPath to root when onPathChange receives the root label path', async () => {
    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.onPathChange('/My files/reports/'));
    await waitFor(() => expect(result.current.path).toBe('/My files/reports/'));

    act(() => result.current.onPathChange('/My files'));
    await waitFor(() => expect(result.current.path).toBe('/My files'));
    expect(mockListFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: '' }),
    );
  });

  it('resets to root when onPathChange receives root label without leading slash', async () => {
    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.onPathChange('My files/reports/'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.onPathChange('My files'));
    await waitFor(() => expect(result.current.path).toBe('/My files'));
    expect(mockListFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: '' }),
    );
  });

  it('maps folder permissions from DIAL Core listing data', async () => {
    const item: ListFilesItemDto = {
      name: 'reports',
      path: 'reports/',
      folderId: `${BUCKET}:reports/`,
      nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
      bucket: BUCKET,
      permissions: ['READ', 'WRITE'],
    };
    mockListFiles.mockResolvedValue({
      bucket: BUCKET,
      path: '',
      items: [item],
      nextToken: undefined,
      permissions: ['READ', 'WRITE'],
    });

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const root = result.current.items[0];
    expect(root.permissions).toEqual([
      DialFilePermission.READ,
      DialFilePermission.WRITE,
    ]);

    const reports = root.items?.[0];
    expect(reports?.permissions).toEqual([
      DialFilePermission.READ,
      DialFilePermission.WRITE,
    ]);
    expect(result.current.uploadEnabled).toBe(true);
    expect(result.current.isNewButtonDisabled).toBe(false);
  });

  it('disables upload and new folder when current folder lacks WRITE permission', async () => {
    mockListFiles.mockResolvedValue({
      bucket: BUCKET,
      path: '',
      items: [],
      nextToken: undefined,
      permissions: ['READ'],
    });

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.uploadEnabled).toBe(false);
    expect(result.current.isNewButtonDisabled).toBe(true);
  });

  it('reflects WRITE permission for the browsed subfolder', async () => {
    const writableFolder: ListFilesItemDto = {
      name: 'reports',
      path: 'reports/',
      folderId: `${BUCKET}:reports/`,
      nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
      bucket: BUCKET,
      permissions: ['READ', 'WRITE'],
    };
    mockListFiles
      .mockResolvedValueOnce({
        bucket: BUCKET,
        path: '',
        items: [writableFolder],
        permissions: ['READ', 'WRITE'],
      })
      .mockResolvedValueOnce({
        bucket: BUCKET,
        path: 'reports/',
        items: [],
        permissions: ['READ', 'WRITE'],
      });

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.onPathChange('/My files/reports/'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.uploadEnabled).toBe(true);
    expect(result.current.isNewButtonDisabled).toBe(false);
  });

  it('shows a notification when folder creation fails', async () => {
    const mockCreateFolder = vi.mocked(filesApi.createFolder);
    const onNotification = vi.fn();
    const conflict = new Error('Conflict');
    mockCreateFolder.mockRejectedValue(conflict);

    const { result } = renderHook(() =>
      useDialFileManager({ bucket: BUCKET, onNotification }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.onCreateFolder(
        {
          name: HIDDEN_FILE,
          fileContent: new File([], HIDDEN_FILE),
        },
        '/My files/2026',
        `/My files/2026/${HIDDEN_FILE}`,
      );
    });

    expect(result.current.isCreatingFolder).toBe(false);
    expect(onNotification).toHaveBeenCalledWith({
      variant: NotificationVariant.Error,
      message: 'dialFileManager.folderCreateError',
    });
  });

  it('updates upload percent and closes the upload modal after completion', async () => {
    const mockUploadFile = vi.mocked(filesApi.uploadFile);
    let finishUpload: (() => void) | undefined;

    mockUploadFile.mockImplementation(
      (_bucket, _path, _file, options) =>
        new Promise((resolve) => {
          const resolved =
            options instanceof AbortSignal
              ? { signal: options }
              : (options ?? {});
          resolved.onProgress?.(35);
          finishUpload = () => {
            resolved.onProgress?.(100);
            resolve({ url: 'files/test-bucket/report.pdf' });
          };
        }),
    );
    mockListFiles.mockResolvedValue({
      bucket: BUCKET,
      path: '',
      items: [],
      permissions: ['READ', 'WRITE'],
    });

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onUploadFiles(
        [
          {
            name: 'report.pdf',
            fileContent: new File(['data'], 'report.pdf'),
          },
        ],
        '/My files',
      );
    });

    await waitFor(() =>
      expect(result.current.uploadBatchState?.files[0]?.percent).toBe(35),
    );

    await act(async () => {
      finishUpload?.();
    });

    await waitFor(() => expect(result.current.uploadBatchState).toBeNull());
  });

  it('creates a folder using the name from the virtual path, not the marker file', async () => {
    const mockCreateFolder = vi.mocked(filesApi.createFolder);
    mockCreateFolder.mockResolvedValue({
      name: '2026',
      path: `files/${BUCKET}/2026/`,
      parentPath: '',
      bucket: BUCKET,
      nodeType: 'folder',
      folderId: `${BUCKET}:files/${BUCKET}/2026/`,
    });

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.onCreateFolder(
        {
          name: HIDDEN_FILE,
          fileContent: new File([], HIDDEN_FILE),
        },
        '/My files/2026',
        `/My files/2026/${HIDDEN_FILE}`,
      );
    });

    expect(mockCreateFolder).toHaveBeenCalledWith({
      bucket: BUCKET,
      parentPath: undefined,
      name: '2026',
    });
  });

  it('creates the folder at the call-time path even when the outer grid is browsing a different folder', async () => {
    mockListFiles.mockResolvedValue({
      bucket: BUCKET,
      path: '',
      items: [],
      permissions: ['READ', 'WRITE'],
    });
    const mockCreateFolder = vi.mocked(filesApi.createFolder);
    mockCreateFolder.mockResolvedValue({
      name: '2026',
      path: `files/${BUCKET}/notes/2026/`,
      parentPath: 'notes',
      bucket: BUCKET,
      nodeType: 'folder',
      folderId: `${BUCKET}:files/${BUCKET}/notes/2026/`,
    });

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // The outer grid is browsing "/My files/reports/" — a different folder
    // than the one the destination-folder popup will create the new folder in.
    act(() => result.current.onPathChange('/My files/reports/'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // The popup's own currently-browsed path is passed at call time.
    await act(async () => {
      await result.current.onCreateFolder(
        {
          name: HIDDEN_FILE,
          fileContent: new File([], HIDDEN_FILE),
        },
        '/My files/notes/2026',
        `/My files/notes/2026/${HIDDEN_FILE}`,
      );
    });

    expect(mockCreateFolder).toHaveBeenCalledWith({
      bucket: BUCKET,
      parentPath: 'notes/',
      name: '2026',
    });
  });

  it('shows the created folder from the refreshed parent listing', async () => {
    const mockCreateFolder = vi.mocked(filesApi.createFolder);
    const createdFolder: ListFilesItemDto = {
      name: '2026',
      path: `files/${BUCKET}/2026/`,
      folderId: `${BUCKET}:files/${BUCKET}/2026/`,
      nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
      bucket: BUCKET,
    };
    mockCreateFolder.mockResolvedValue({
      name: '2026',
      path: `files/${BUCKET}/2026/`,
      parentPath: '',
      bucket: BUCKET,
      nodeType: 'folder',
      folderId: `${BUCKET}:files/${BUCKET}/2026/`,
    });
    mockListFiles
      .mockResolvedValueOnce({
        bucket: BUCKET,
        path: '',
        items: [],
        nextToken: undefined,
      })
      .mockResolvedValueOnce({
        bucket: BUCKET,
        path: '',
        items: [createdFolder],
        nextToken: undefined,
      });

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.onCreateFolder(
        {
          name: HIDDEN_FILE,
          fileContent: new File([], HIDDEN_FILE),
        },
        '/My files/2026',
        `/My files/2026/${HIDDEN_FILE}`,
      );
    });

    await waitFor(() =>
      expect(
        result.current.items[0].items?.some((item) => item.name === '2026'),
      ).toBe(true),
    );
  });

  it('re-fetches the current listing after creating a folder', async () => {
    const mockCreateFolder = vi.mocked(filesApi.createFolder);
    mockCreateFolder.mockResolvedValue({
      name: '2026',
      path: `files/${BUCKET}/2026/`,
      parentPath: '',
      bucket: BUCKET,
      nodeType: 'folder',
      folderId: `${BUCKET}:files/${BUCKET}/2026/`,
    });

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.onCreateFolder(
        {
          name: HIDDEN_FILE,
          fileContent: new File([], HIDDEN_FILE),
        },
        '/My files/2026',
        `/My files/2026/${HIDDEN_FILE}`,
      );
    });

    await waitFor(() => expect(mockListFiles).toHaveBeenCalledTimes(2));
    expect(mockListFiles).toHaveBeenLastCalledWith({
      bucket: BUCKET,
      path: '',
      permissions: true,
    });
  });

  it('downloads multiple files using API paths derived from virtual paths', async () => {
    mockDownloadArchive.mockResolvedValue(new Response('zip', { status: 200 }));

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onDownloadFiles([
        {
          id: '/My files/report-a.pdf',
          name: 'report-a.pdf',
          path: '/My files/report-a.pdf',
          parentPath: '/My files',
          nodeType: DialFileNodeType.ITEM,
          folderId: BUCKET,
          bucket: BUCKET,
        },
        {
          id: '/My files/report-b.pdf',
          name: 'report-b.pdf',
          path: '/My files/report-b.pdf',
          parentPath: '/My files',
          nodeType: DialFileNodeType.ITEM,
          folderId: BUCKET,
          bucket: BUCKET,
        },
      ]);
    });

    await waitFor(() => expect(result.current.isDownloading).toBe(false));

    expect(mockDownloadArchive).toHaveBeenCalledWith([
      {
        bucket: BUCKET,
        path: 'report-a.pdf',
        name: 'report-a.pdf',
        nodeType: 'item',
      },
      {
        bucket: BUCKET,
        path: 'report-b.pdf',
        name: 'report-b.pdf',
        nodeType: 'item',
      },
    ]);
  });

  it('shows a notification when file download fails', async () => {
    const onNotification = vi.fn();
    mockDownloadArchive.mockResolvedValue(
      new Response('fail', { status: 500 }),
    );

    const { result } = renderHook(() =>
      useDialFileManager({ bucket: BUCKET, onNotification }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onDownloadFiles([
        {
          id: '/My files/report-a.pdf',
          name: 'report-a.pdf',
          path: '/My files/report-a.pdf',
          parentPath: '/My files',
          nodeType: DialFileNodeType.ITEM,
          folderId: BUCKET,
          bucket: BUCKET,
        },
        {
          id: '/My files/report-b.pdf',
          name: 'report-b.pdf',
          path: '/My files/report-b.pdf',
          parentPath: '/My files',
          nodeType: DialFileNodeType.ITEM,
          folderId: BUCKET,
          bucket: BUCKET,
        },
      ]);
    });

    await waitFor(() =>
      expect(onNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Error,
        message: 'dialFileManager.downloadFilesError',
      }),
    );
  });

  it('does not fetch the same expanded folder twice while the first load is pending', async () => {
    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const initialCallCount = mockListFiles.mock.calls.length;
    mockListFiles.mockImplementation(() => new Promise(() => undefined));

    act(() => {
      result.current.onExpandedPathsChange(new Set(['/My files/docs/']));
    });
    act(() => {
      result.current.onExpandedPathsChange(
        new Set(['/My files/docs/', '/My files/images/']),
      );
    });

    expect(mockListFiles).toHaveBeenCalledTimes(initialCallCount + 2);
    expect(
      mockListFiles.mock.calls
        .slice(initialCallCount)
        .map(([params]) => params.path),
    ).toEqual(['docs/', 'images/']);
  });

  it('shows notifications for successful and failed deletes', async () => {
    const onNotification = vi.fn();
    mockDeleteFiles.mockResolvedValue({
      results: [
        { path: 'reports/old.pdf', success: true },
        { path: 'reports/locked.pdf', success: false, error: 'Forbidden' },
      ],
    });

    const { result } = renderHook(() =>
      useDialFileManager({ bucket: BUCKET, onNotification }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onDeleteFiles(
        [
          {
            sourceUrl: '/My files/reports/old.pdf',
            nodeType: DialFileNodeType.ITEM,
          },
          {
            sourceUrl: '/My files/reports/locked.pdf',
            nodeType: DialFileNodeType.ITEM,
          },
        ],
        '/My files/reports',
      );
    });

    await waitFor(() =>
      expect(onNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Success,
        title: 'dialFileManager.itemDeletedSuccessfully',
        message: 'dialFileManager.itemDeletedFromFolder',
      }),
    );
    expect(onNotification).toHaveBeenCalledWith({
      variant: NotificationVariant.Error,
      title: 'dialFileManager.itemsDeletingFailed',
      message: 'dialFileManager.someItemsNotDeleted',
    });
  });

  it('uploads with overwrite mode when file name exists in cached listing', async () => {
    const mockUploadFile = vi.mocked(filesApi.uploadFile);
    mockUploadFile.mockResolvedValue({ url: `files/${BUCKET}/report.pdf` });

    const existingFile: ListFilesItemDto = {
      name: 'report.pdf',
      path: 'report.pdf',
      folderId: `${BUCKET}:`,
      nodeType: ListFilesItemDtoNodeTypeEnum.Item,
      bucket: BUCKET,
    };
    mockListFiles.mockResolvedValue({
      bucket: BUCKET,
      path: '',
      items: [existingFile],
      permissions: ['READ', 'WRITE'],
    });

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onUploadFiles(
        [{ name: 'REPORT.PDF', fileContent: new File(['data'], 'REPORT.PDF') }],
        '/My files',
      );
    });

    await waitFor(() =>
      expect(mockUploadFile).toHaveBeenCalledWith(
        BUCKET,
        'REPORT.PDF',
        expect.any(File),
        expect.objectContaining({ uploadMode: 'overwrite' }),
      ),
    );
  });

  it('uploads with create-only mode when file name is absent from cached listing', async () => {
    const mockUploadFile = vi.mocked(filesApi.uploadFile);
    mockUploadFile.mockResolvedValue({ url: `files/${BUCKET}/new-file.pdf` });

    mockListFiles.mockResolvedValue({
      bucket: BUCKET,
      path: '',
      items: [],
      permissions: ['READ', 'WRITE'],
    });

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onUploadFiles(
        [
          {
            name: 'new-file.pdf',
            fileContent: new File(['data'], 'new-file.pdf'),
          },
        ],
        '/My files',
      );
    });

    await waitFor(() =>
      expect(mockUploadFile).toHaveBeenCalledWith(
        BUCKET,
        'new-file.pdf',
        expect.any(File),
        expect.objectContaining({ uploadMode: 'create-only' }),
      ),
    );
  });

  it('does not call setState after unmount during an in-flight fetch', async () => {
    let resolvePromise!: () => void;
    mockListFiles.mockReturnValue(
      new Promise((res) => {
        resolvePromise = () =>
          res({ bucket: BUCKET, path: '', items: [], nextToken: undefined });
      }),
    );

    const { result, unmount } = renderHook(() =>
      useDialFileManager({ bucket: BUCKET }),
    );
    expect(result.current.isLoading).toBe(true);
    unmount();
    // Resolve after unmount — no warnings should be thrown
    await act(async () => resolvePromise());
  });

  describe('tab-aware behavior', () => {
    const sharedRootItem: ListFilesItemDto = {
      name: 'team-docs',
      path: `files/${OWNER_BUCKET}/team-docs/`,
      folderId: `${OWNER_BUCKET}:files/${OWNER_BUCKET}/team-docs/`,
      nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
      bucket: OWNER_BUCKET,
      permissions: ['READ', 'WRITE'],
      author: 'Owner User',
    };

    describe('uploadEnabled matrix', () => {
      it('is always false on Organization tab', async () => {
        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.Organization,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.uploadEnabled).toBe(false);
      });

      it('is false on Shared tab at root (folderPath = "")', async () => {
        mockListSharedFiles.mockResolvedValue({
          bucket: '',
          path: '',
          items: [sharedRootItem],
        });

        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.Shared,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.uploadEnabled).toBe(false);
      });

      it('is false on Shared tab in a nested folder without WRITE permission', async () => {
        mockListSharedFiles.mockResolvedValue({
          bucket: '',
          path: '',
          items: [{ ...sharedRootItem, permissions: ['READ'] }],
        });
        mockListFiles.mockResolvedValue({
          bucket: OWNER_BUCKET,
          path: 'team-docs/',
          items: [],
          permissions: ['READ'],
        });

        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.Shared,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => result.current.onPathChange('/My files/team-docs/'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.uploadEnabled).toBe(false);
      });

      it('is true on Shared tab in a nested folder with WRITE permission', async () => {
        mockListSharedFiles.mockResolvedValue({
          bucket: '',
          path: '',
          items: [sharedRootItem],
        });
        mockListFiles.mockResolvedValue({
          bucket: OWNER_BUCKET,
          path: 'team-docs/',
          items: [],
          permissions: ['READ', 'WRITE'],
        });

        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.Shared,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => result.current.onPathChange('/My files/team-docs/'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.uploadEnabled).toBe(true);
      });

      it('is true on MyFiles tab when the current folder has WRITE permission', async () => {
        mockListFiles.mockResolvedValue({
          bucket: BUCKET,
          path: '',
          items: [],
          permissions: ['READ', 'WRITE'],
        });

        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.MyFiles,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.uploadEnabled).toBe(true);
      });
    });

    describe('visibleColumns', () => {
      it('includes Author column on Shared tab', async () => {
        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.Shared,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.visibleColumns).toContain(
          FileManagerColumnKey.Author,
        );
      });

      it('keeps Author values on Shared tab root items', async () => {
        mockListSharedFiles.mockResolvedValue({
          bucket: '',
          path: '',
          items: [sharedRootItem],
        });

        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.Shared,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.items[0].items?.[0].author).toBe('Owner User');
      });

      it('omits Author column on MyFiles tab', async () => {
        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.MyFiles,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.visibleColumns).not.toContain(
          FileManagerColumnKey.Author,
        );
      });

      it('omits Author column on Organization tab', async () => {
        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.Organization,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.visibleColumns).not.toContain(
          FileManagerColumnKey.Author,
        );
      });
    });

    describe('actionLabels', () => {
      it('includes Delete on MyFiles tab', async () => {
        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.MyFiles,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(
          result.current.actionLabels[DialFileManagerActions.Delete],
        ).toBeDefined();
      });

      it('omits Delete on Shared tab', async () => {
        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.Shared,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(
          result.current.actionLabels[DialFileManagerActions.Delete],
        ).toBeUndefined();
      });

      it('omits Delete on Organization tab', async () => {
        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.Organization,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(
          result.current.actionLabels[DialFileManagerActions.Delete],
        ).toBeUndefined();
      });
    });

    describe('actionLabels — Duplicate', () => {
      it('includes Duplicate on MyFiles tab with WRITE permission and the Browse profile', async () => {
        mockListFiles.mockResolvedValue({
          bucket: BUCKET,
          path: '',
          items: [],
          permissions: ['READ', 'WRITE'],
        });

        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.MyFiles,
            actionProfile: DialFileManagerActionProfile.Browse,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(
          result.current.actionLabels[DialFileManagerActions.Duplicate],
        ).toBeDefined();
      });

      it('omits Duplicate on MyFiles tab without WRITE permission', async () => {
        mockListFiles.mockResolvedValue({
          bucket: BUCKET,
          path: '',
          items: [],
          permissions: ['READ'],
        });

        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.MyFiles,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(
          result.current.actionLabels[DialFileManagerActions.Duplicate],
        ).toBeUndefined();
      });

      it('omits Duplicate on Shared tab', async () => {
        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.Shared,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(
          result.current.actionLabels[DialFileManagerActions.Duplicate],
        ).toBeUndefined();
      });

      it('omits Duplicate on Organization tab', async () => {
        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.Organization,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(
          result.current.actionLabels[DialFileManagerActions.Duplicate],
        ).toBeUndefined();
      });
    });

    describe('actionLabels — Info', () => {
      it.each([
        DialFileManagerTabs.MyFiles,
        DialFileManagerTabs.Shared,
        DialFileManagerTabs.Organization,
      ])('includes Info on the %s tab with the Full profile', async (tab) => {
        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: tab,
            actionProfile: DialFileManagerActionProfile.Full,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(
          result.current.actionLabels[DialFileManagerActions.Info],
        ).toBeDefined();
      });

      it.each([
        DialFileManagerActionProfile.Browse,
        DialFileManagerActionProfile.Attach,
      ])('omits Info when actionProfile is %s', async (actionProfile) => {
        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.MyFiles,
            actionProfile,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(
          result.current.actionLabels[DialFileManagerActions.Info],
        ).toBeUndefined();
      });
    });

    describe('actionLabels — actionProfile gating (Copy/Move/Duplicate)', () => {
      it('excludes Copy/Move/Duplicate but includes Rename and Delete for Attach profile on MyFiles with WRITE', async () => {
        mockListFiles.mockResolvedValue({
          bucket: BUCKET,
          path: '',
          items: [],
          permissions: ['READ', 'WRITE'],
        });

        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.MyFiles,
            variant: DialFileManagerVariant.Attach,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(
          result.current.actionLabels[DialFileManagerActions.Rename],
        ).toBeDefined();
        expect(
          result.current.actionLabels[DialFileManagerActions.Delete],
        ).toBeDefined();
        expect(
          result.current.actionLabels[DialFileManagerActions.Copy],
        ).toBeUndefined();
        expect(
          result.current.actionLabels[DialFileManagerActions.Move],
        ).toBeUndefined();
        expect(
          result.current.actionLabels[DialFileManagerActions.Duplicate],
        ).toBeUndefined();
      });

      it('includes all six actions for the Standalone variant (Browse profile) on MyFiles with WRITE', async () => {
        mockListFiles.mockResolvedValue({
          bucket: BUCKET,
          path: '',
          items: [],
          permissions: ['READ', 'WRITE'],
        });

        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.MyFiles,
            variant: DialFileManagerVariant.Standalone,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(
          result.current.actionLabels[DialFileManagerActions.Download],
        ).toBeDefined();
        expect(
          result.current.actionLabels[DialFileManagerActions.Delete],
        ).toBeDefined();
        expect(
          result.current.actionLabels[DialFileManagerActions.Rename],
        ).toBeDefined();
        expect(
          result.current.actionLabels[DialFileManagerActions.Copy],
        ).toBeDefined();
        expect(
          result.current.actionLabels[DialFileManagerActions.Move],
        ).toBeDefined();
        expect(
          result.current.actionLabels[DialFileManagerActions.Duplicate],
        ).toBeDefined();
      });

      it.each([
        DialFileManagerActionProfile.Attach,
        DialFileManagerActionProfile.Browse,
      ])(
        'shows Download only on Shared tab regardless of actionProfile (%s)',
        async (actionProfile) => {
          const { result } = renderHook(() =>
            useDialFileManager({
              bucket: BUCKET,
              activeTab: DialFileManagerTabs.Shared,
              actionProfile,
            }),
          );
          await waitFor(() => expect(result.current.isLoading).toBe(false));

          expect(
            result.current.actionLabels[DialFileManagerActions.Download],
          ).toBeDefined();
          expect(
            result.current.actionLabels[DialFileManagerActions.Delete],
          ).toBeUndefined();
          expect(
            result.current.actionLabels[DialFileManagerActions.Rename],
          ).toBeUndefined();
          expect(
            result.current.actionLabels[DialFileManagerActions.Copy],
          ).toBeUndefined();
          expect(
            result.current.actionLabels[DialFileManagerActions.Move],
          ).toBeUndefined();
          expect(
            result.current.actionLabels[DialFileManagerActions.Duplicate],
          ).toBeUndefined();
        },
      );

      it.each([
        DialFileManagerActionProfile.Attach,
        DialFileManagerActionProfile.Browse,
      ])(
        'shows Download only on Organization tab regardless of actionProfile (%s)',
        async (actionProfile) => {
          const { result } = renderHook(() =>
            useDialFileManager({
              bucket: BUCKET,
              activeTab: DialFileManagerTabs.Organization,
              actionProfile,
            }),
          );
          await waitFor(() => expect(result.current.isLoading).toBe(false));

          expect(
            result.current.actionLabels[DialFileManagerActions.Download],
          ).toBeDefined();
          expect(
            result.current.actionLabels[DialFileManagerActions.Delete],
          ).toBeUndefined();
          expect(
            result.current.actionLabels[DialFileManagerActions.Rename],
          ).toBeUndefined();
          expect(
            result.current.actionLabels[DialFileManagerActions.Copy],
          ).toBeUndefined();
          expect(
            result.current.actionLabels[DialFileManagerActions.Move],
          ).toBeUndefined();
          expect(
            result.current.actionLabels[DialFileManagerActions.Duplicate],
          ).toBeUndefined();
        },
      );
    });

    describe.each([
      DialFileManagerTabs.Shared,
      DialFileManagerTabs.Organization,
    ])('actionLabels parity between attach and browse (%s tab)', (tab) => {
      it('produces identical actionLabels for actionProfile Attach and Browse', async () => {
        const { result: attachResult } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: tab,
            actionProfile: DialFileManagerActionProfile.Attach,
          }),
        );
        await waitFor(() => expect(attachResult.current.isLoading).toBe(false));

        const { result: browseResult } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: tab,
            actionProfile: DialFileManagerActionProfile.Browse,
          }),
        );
        await waitFor(() => expect(browseResult.current.isLoading).toBe(false));

        expect(browseResult.current.actionLabels).toEqual(
          attachResult.current.actionLabels,
        );
      });
    });
  });

  describe('isAnyOperationInProgress', () => {
    it('is true while a folder creation request is in flight', async () => {
      const mockCreateFolder = vi.mocked(filesApi.createFolder);
      mockCreateFolder.mockImplementation(() => new Promise(() => undefined));

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        void result.current.onCreateFolder(
          { name: HIDDEN_FILE, fileContent: new File([], HIDDEN_FILE) },
          '/My files/2026',
          `/My files/2026/${HIDDEN_FILE}`,
        );
      });

      await waitFor(() => expect(result.current.isCreatingFolder).toBe(true));
      expect(result.current.isAnyOperationInProgress).toBe(true);
    });

    it('is true while a download is in flight', async () => {
      mockDownloadArchive.mockImplementation(
        () => new Promise(() => undefined),
      );

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.onDownloadFiles([
          {
            id: '/My files/report-a.pdf',
            name: 'report-a.pdf',
            path: '/My files/report-a.pdf',
            parentPath: '/My files',
            nodeType: DialFileNodeType.ITEM,
            folderId: BUCKET,
            bucket: BUCKET,
          },
          {
            id: '/My files/report-b.pdf',
            name: 'report-b.pdf',
            path: '/My files/report-b.pdf',
            parentPath: '/My files',
            nodeType: DialFileNodeType.ITEM,
            folderId: BUCKET,
            bucket: BUCKET,
          },
        ]);
      });

      await waitFor(() => expect(result.current.isDownloading).toBe(true));
      expect(result.current.isAnyOperationInProgress).toBe(true);
    });

    it('is true while a delete request is in flight', async () => {
      mockDeleteFiles.mockImplementation(() => new Promise(() => undefined));

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.onDeleteFiles(
          [
            {
              sourceUrl: '/My files/reports/old.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files/reports',
        );
      });

      await waitFor(() => expect(result.current.isDeleting).toBe(true));
      expect(result.current.isAnyOperationInProgress).toBe(true);
    });

    it('is true while a same-folder rename request is in flight', async () => {
      const mockRenameFiles = vi.mocked(filesApi.renameFiles);
      mockRenameFiles.mockImplementation(() => new Promise(() => undefined));

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
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

      await waitFor(() => expect(result.current.isRenaming).toBe(true));
      expect(result.current.isAnyOperationInProgress).toBe(true);
    });

    it('is true while a cross-folder move request is in flight', async () => {
      mockMoveFiles.mockImplementation(() => new Promise(() => undefined));

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
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

      await waitFor(() => expect(result.current.isMoving).toBe(true));
      expect(result.current.isAnyOperationInProgress).toBe(true);
    });

    it('is true while a copy request is in flight', async () => {
      mockCopyFiles.mockImplementation(() => new Promise(() => undefined));

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

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
      expect(result.current.isAnyOperationInProgress).toBe(true);
    });

    it('is true while an unshare request is in flight', async () => {
      mockDiscardShared.mockImplementation(() => new Promise(() => undefined));

      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          activeTab: DialFileManagerTabs.Shared,
          actionProfile: DialFileManagerActionProfile.Full,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() =>
        result.current.onUnshareFiles([
          {
            id: `files/${OWNER_BUCKET}/team-docs/`,
            name: 'team-docs',
            path: '/Shared with me/team-docs/',
            parentPath: '/Shared with me',
            nodeType: DialFileNodeType.FOLDER,
            folderId: `${OWNER_BUCKET}:files/${OWNER_BUCKET}/team-docs/`,
            bucket: OWNER_BUCKET,
          },
        ]),
      );

      await waitFor(() => expect(result.current.isUnsharing).toBe(true));
      expect(result.current.isAnyOperationInProgress).toBe(true);
    });

    it('is true while a remove-access request is in flight', async () => {
      mockRevokeAccess.mockImplementation(() => new Promise(() => undefined));

      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          activeTab: DialFileManagerTabs.MyFiles,
          actionProfile: DialFileManagerActionProfile.Full,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() =>
        result.current.onRemoveFilesAccess([
          {
            id: `files/${BUCKET}/report.pdf`,
            name: 'report.pdf',
            path: '/My files/report.pdf',
            parentPath: '/My files',
            nodeType: DialFileNodeType.ITEM,
            folderId: `${BUCKET}:`,
            bucket: BUCKET,
          },
        ]),
      );

      await waitFor(() => expect(result.current.isRemovingAccess).toBe(true));
      expect(result.current.isAnyOperationInProgress).toBe(true);
    });

    it('is true while an upload batch is active', async () => {
      const mockUploadFile = vi.mocked(filesApi.uploadFile);
      mockUploadFile.mockImplementation(() => new Promise(() => undefined));
      mockListFiles.mockResolvedValue({
        bucket: BUCKET,
        path: '',
        items: [],
        permissions: ['READ', 'WRITE'],
      });

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.onUploadFiles(
          [
            {
              name: 'report.pdf',
              fileContent: new File(['data'], 'report.pdf'),
            },
          ],
          '/My files',
        );
      });

      await waitFor(() =>
        expect(result.current.uploadBatchState).not.toBeNull(),
      );
      expect(result.current.isAnyOperationInProgress).toBe(true);
    });

    it('is false while only isLoading is true (a folder listing is being fetched)', async () => {
      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAnyOperationInProgress).toBe(false);

      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it('is false while only isSearching is true (a search request is in flight)', async () => {
      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockListFiles.mockImplementation(() => new Promise(() => undefined));

      vi.useFakeTimers();
      try {
        act(() => result.current.onSearchFiles('/', 'report'));
        act(() => {
          vi.advanceTimersByTime(300);
        });
        await act(() => Promise.resolve());

        expect(result.current.isSearching).toBe(true);
        expect(result.current.isAnyOperationInProgress).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('is false while only isFileMetadataLoading is true', async () => {
      mockGetFileMetadata.mockResolvedValue({
        name: 'report.pdf',
        nodeType: 'item',
        bucket: BUCKET,
        contentLength: 1234,
        contentType: 'application/pdf',
        updatedAt: 1700000000000,
      });

      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          activeTab: DialFileManagerTabs.MyFiles,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() =>
        result.current.onGetInfo({
          id: `files/${BUCKET}/report.pdf`,
          name: 'report.pdf',
          path: '/My files/report.pdf',
          parentPath: '/My files',
          nodeType: DialFileNodeType.ITEM,
          folderId: `${BUCKET}:`,
          bucket: BUCKET,
        }),
      );

      expect(result.current.isFileMetadataLoading).toBe(true);
      expect(result.current.isAnyOperationInProgress).toBe(false);

      await waitFor(() =>
        expect(result.current.isFileMetadataLoading).toBe(false),
      );
    });

    it('is false when nothing is active', async () => {
      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isAnyOperationInProgress).toBe(false);
    });

    it('is false again immediately after cancelCopyMove clears isCopying', async () => {
      mockCopyFiles.mockImplementation(
        (_items, signal) =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      );

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

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
      expect(result.current.isAnyOperationInProgress).toBe(true);

      await act(async () => {
        result.current.cancelCopyMove();
      });

      await waitFor(() => expect(result.current.isCopying).toBe(false));
      expect(result.current.isAnyOperationInProgress).toBe(false);
    });

    it('is false again immediately after cancelCopyMove clears isMoving', async () => {
      mockMoveFiles.mockImplementation(
        (_items, signal) =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      );

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
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

      await waitFor(() => expect(result.current.isMoving).toBe(true));
      expect(result.current.isAnyOperationInProgress).toBe(true);

      await act(async () => {
        result.current.cancelCopyMove();
      });

      await waitFor(() => expect(result.current.isMoving).toBe(false));
      expect(result.current.isAnyOperationInProgress).toBe(false);
    });
  });
});
