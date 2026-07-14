import { HIDDEN_FILE } from '@epam/ai-dial-chat-shared';
import {
  DialFileManagerActions,
  DialFileManagerTabs,
  DialFileNodeType,
  DialFilePermission,
  FileManagerColumnKey,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import type { ListFilesItemDto } from '@epam/chat-api-client';
import { ListFilesItemDtoNodeTypeEnum } from '@epam/chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DialFileManagerI18nKeys } from '../../../constants/translation-keys';
import * as filesApi from '../../../server-api/files.api';
import {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
} from '../../../types/file-manager-variant';
import * as fileNameUtils from '../../../utils/file-name';
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
const mockShareFiles = vi.mocked(filesApi.shareFiles);
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

  describe('integration: sanitize → conflict resolution → upload mode', () => {
    it('sanitizes file names via onValidateUpload before upload', async () => {
      const mockSanitize = vi.mocked(fileNameUtils.sanitizeFileName);
      mockSanitize.mockImplementation((name) => name.replace(/[/:]/g, '_'));

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const files = [
        {
          name: 'report:final.pdf',
          fileContent: new File([], 'report:final.pdf'),
        },
        {
          name: 'data/export.csv',
          fileContent: new File([], 'data/export.csv'),
        },
      ];

      await act(async () => {
        await result.current.onValidateUpload(files, [], '/My files');
      });

      expect(files[0].name).toBe('report_final.pdf');
      expect(files[1].name).toBe('data_export.csv');
      expect(mockSanitize).toHaveBeenCalledTimes(2);
    });

    it('selects overwrite for a file whose sanitized name matches the cache, create-only otherwise', async () => {
      const mockUploadFile = vi.mocked(filesApi.uploadFile);
      mockUploadFile.mockResolvedValue({ url: `files/${BUCKET}/file.pdf` });

      const mockSanitize = vi.mocked(fileNameUtils.sanitizeFileName);
      mockSanitize.mockImplementation((name) => name);

      const cachedFile: ListFilesItemDto = {
        name: 'existing.pdf',
        path: 'existing.pdf',
        folderId: `${BUCKET}:`,
        nodeType: ListFilesItemDtoNodeTypeEnum.Item,
        bucket: BUCKET,
      };
      mockListFiles.mockResolvedValue({
        bucket: BUCKET,
        path: '',
        items: [cachedFile],
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
              name: 'existing.pdf',
              fileContent: new File(['data'], 'existing.pdf'),
            },
            {
              name: 'new-file.pdf',
              fileContent: new File(['data'], 'new-file.pdf'),
            },
          ],
          '/My files',
        );
      });

      await waitFor(() => expect(mockUploadFile).toHaveBeenCalledTimes(2));

      const calls = mockUploadFile.mock.calls;
      const existingCall = calls.find((c) => c[1] === 'existing.pdf');
      const newCall = calls.find((c) => c[1] === 'new-file.pdf');

      expect(existingCall?.[3]).toEqual(
        expect.objectContaining({ uploadMode: 'overwrite' }),
      );
      expect(newCall?.[3]).toEqual(
        expect.objectContaining({ uploadMode: 'create-only' }),
      );
    });

    it('onValidateUpload always returns valid:true regardless of name collisions', async () => {
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

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let validation:
        | Awaited<ReturnType<typeof result.current.onValidateUpload>>
        | undefined;
      await act(async () => {
        validation = await result.current.onValidateUpload(
          [{ name: 'report.pdf', fileContent: new File([], 'report.pdf') }],
          [existingFile as never],
          '/My files',
        );
      });

      expect(validation).toEqual({ valid: true });
    });
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

    it('switching tabs resets folderPath to root and clears the listing cache', async () => {
      mockListFiles.mockResolvedValue({
        bucket: BUCKET,
        path: 'reports/',
        items: [],
        permissions: ['READ', 'WRITE'],
      });

      const { result, rerender } = renderHook(
        ({ tab }: { tab: DialFileManagerTabs }) =>
          useDialFileManager({ bucket: BUCKET, activeTab: tab }),
        { initialProps: { tab: DialFileManagerTabs.MyFiles } },
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.onPathChange('/My files/reports/'));
      await waitFor(() =>
        expect(result.current.path).toBe('/My files/reports/'),
      );

      mockListPublicFiles.mockClear();

      rerender({ tab: DialFileManagerTabs.Organization });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.path).toBe('/My files');
      expect(mockListPublicFiles).toHaveBeenCalled();
    });

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

    describe('sharedWithMeIds', () => {
      it('is populated with virtual DialFile paths matching root Shared listing items', async () => {
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

        expect(result.current.sharedWithMeIds).toEqual([
          '/My files/team-docs/',
        ]);
      });

      it('is undefined on MyFiles tab', async () => {
        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.MyFiles,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.sharedWithMeIds).toBeUndefined();
      });

      it('is undefined on Organization tab', async () => {
        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.Organization,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.sharedWithMeIds).toBeUndefined();
      });

      it('matches the actual root item virtual path exposed via items', async () => {
        mockListSharedFiles.mockResolvedValue({
          bucket: '',
          path: '',
          items: [sharedRootItem],
        });

        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.Shared,
            rootLabel: 'Shared with me',
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const rootFolder = result.current.items[0];
        const teamDocsNode = rootFolder.items?.find(
          (i) => i.name === 'team-docs',
        );
        expect(teamDocsNode).toBeDefined();
        expect(result.current.sharedWithMeIds).toEqual([teamDocsNode?.path]);
      });
    });

    describe('sharedByMePaths', () => {
      it('is populated with virtual DialFile paths matching listSharedByMe items', async () => {
        mockListSharedByMe.mockResolvedValue({
          bucket: BUCKET,
          path: '',
          items: [
            {
              name: 'a.pdf',
              path: `files/${BUCKET}/a.pdf`,
              folderId: `${BUCKET}:`,
              nodeType: ListFilesItemDtoNodeTypeEnum.Item,
              bucket: BUCKET,
            },
            {
              name: 'nested.pdf',
              path: `files/${BUCKET}/reports/2024/nested.pdf`,
              folderId: `${BUCKET}:`,
              nodeType: ListFilesItemDtoNodeTypeEnum.Item,
              bucket: BUCKET,
            },
            {
              name: 'shared-folder',
              path: `files/${BUCKET}/shared-folder/`,
              folderId: `${BUCKET}:`,
              nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
              bucket: BUCKET,
            },
          ],
        });

        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.MyFiles,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        await waitFor(() =>
          expect(result.current.sharedByMePaths.size).toBe(3),
        );

        expect(result.current.sharedByMePaths).toEqual(
          new Set([
            '/My files/a.pdf',
            '/My files/reports/2024/nested.pdf',
            '/My files/shared-folder/',
          ]),
        );
      });

      it('is empty on the Shared tab', async () => {
        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.Shared,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.sharedByMePaths.size).toBe(0);
        expect(mockListSharedByMe).not.toHaveBeenCalled();
      });

      it('is empty on the Organization tab', async () => {
        const { result } = renderHook(() =>
          useDialFileManager({
            bucket: BUCKET,
            activeTab: DialFileManagerTabs.Organization,
          }),
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.sharedByMePaths.size).toBe(0);
      });
    });
  });

  describe('onRenameValidate', () => {
    const renderAndWait = async (opts?: object) => {
      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET, ...opts }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      return result;
    };

    const dummyItem = {
      id: 'file.pdf',
      name: 'file.pdf',
      path: '/My files/file.pdf',
      parentPath: '/My files',
      nodeType: DialFileNodeType.ITEM,
      folderId: BUCKET,
      bucket: BUCKET,
      items: [],
    };

    it('returns null for a valid name', async () => {
      const result = await renderAndWait();
      expect(
        result.current.onRenameValidate('report.pdf', dummyItem),
      ).toBeNull();
    });

    it('returns empty-name error for an empty name', async () => {
      const result = await renderAndWait();
      expect(result.current.onRenameValidate('', dummyItem)).toBeTruthy();
    });

    it('returns reserved name error for ".dial_folder"', async () => {
      const result = await renderAndWait();
      const msg = result.current.onRenameValidate(HIDDEN_FILE, dummyItem);
      expect(msg).toBeTruthy();
    });

    it('returns invalid chars error for name containing forward slash', async () => {
      const result = await renderAndWait();
      const msg = result.current.onRenameValidate('a/b', dummyItem);
      expect(msg).toBe(DialFileManagerI18nKeys.RenameInvalidChars);
    });

    it('returns invalid chars error for name containing backslash', async () => {
      const result = await renderAndWait();
      const msg = result.current.onRenameValidate('a\\b', dummyItem);
      expect(msg).toBe(DialFileManagerI18nKeys.RenameInvalidChars);
    });

    it('returns too-long error for name longer than 255 chars', async () => {
      const result = await renderAndWait();
      const msg = result.current.onRenameValidate('a'.repeat(256), dummyItem);
      expect(msg).toBeTruthy();
    });

    it('returns forbidden-symbols error when name matches forbiddenSymbolsRegExp', async () => {
      const result = await renderAndWait({
        forbiddenSymbolsRegExp: /[<>]/,
      });
      const msg = result.current.onRenameValidate('file<name>', dummyItem);
      expect(msg).toBe(DialFileManagerI18nKeys.ForbiddenSymbolsTooltip);
    });

    it('returns null when name does not match forbiddenSymbolsRegExp', async () => {
      const result = await renderAndWait({
        forbiddenSymbolsRegExp: /[<>]/,
      });
      expect(
        result.current.onRenameValidate('valid.pdf', dummyItem),
      ).toBeNull();
    });

    it('returns duplicate-name error for a sibling with the same name', async () => {
      mockListFiles.mockResolvedValue({
        bucket: BUCKET,
        path: '',
        items: [
          {
            name: 'report.pdf',
            path: 'report.pdf',
            folderId: `${BUCKET}:`,
            nodeType: ListFilesItemDtoNodeTypeEnum.Item,
            bucket: BUCKET,
          },
        ],
        nextToken: undefined,
      });

      const result = await renderAndWait();

      expect(
        result.current.onRenameValidate('REPORT.PDF', dummyItem),
      ).toBeTruthy();
    });
  });

  describe('onMoveToFiles', () => {
    const mockRenameFiles = vi.mocked(filesApi.renameFiles);
    const mockNotification = vi.fn();

    beforeEach(() => {
      mockRenameFiles.mockResolvedValue({ results: [] });
    });

    const renderAndWait = async () => {
      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          onNotification: mockNotification,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      return result;
    };

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

      const result = await renderAndWait();

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
      expect(mockListFiles).toHaveBeenCalledTimes(2);
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

      const result = await renderAndWait();

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
        expect(mockNotification).toHaveBeenCalledWith(
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

      const result = await renderAndWait();

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
        expect(mockNotification).toHaveBeenCalledWith(
          expect.objectContaining({ variant: NotificationVariant.Error }),
        ),
      );
    });

    it('navigates to the destination path after successfully renaming the current folder', async () => {
      mockListFiles.mockResolvedValue({
        bucket: BUCKET,
        path: '',
        items: [
          {
            name: 'reports',
            path: 'reports/',
            folderId: `${BUCKET}:reports/`,
            nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
            bucket: BUCKET,
          },
        ],
        nextToken: undefined,
      });
      mockRenameFiles.mockResolvedValue({
        results: [
          {
            sourcePath: 'reports/',
            destinationPath: 'archive/',
            success: true,
          },
        ],
      });

      const result = await renderAndWait();
      act(() => result.current.onPathChange('/My files/reports/'));
      await waitFor(() =>
        expect(result.current.path).toBe('/My files/reports/'),
      );

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

      await waitFor(() =>
        expect(result.current.path).toBe('/My files/archive/'),
      );
    });

    it('keeps the current path when a current-folder rename fails', async () => {
      mockListFiles.mockResolvedValue({
        bucket: BUCKET,
        path: '',
        items: [
          {
            name: 'reports',
            path: 'reports/',
            folderId: `${BUCKET}:reports/`,
            nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
            bucket: BUCKET,
          },
        ],
        nextToken: undefined,
      });
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

      const result = await renderAndWait();
      act(() => result.current.onPathChange('/My files/reports/'));
      await waitFor(() =>
        expect(result.current.path).toBe('/My files/reports/'),
      );

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
      expect(result.current.path).toBe('/My files/reports/');
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

      const result = await renderAndWait();

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

      const result = await renderAndWait();

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

      const result = await renderAndWait();

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
      expect(mockNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: NotificationVariant.Error }),
      );
    });
  });

  describe('onCopyFiles', () => {
    const mockNotification = vi.fn();

    const renderAndWait = async () => {
      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          onNotification: mockNotification,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      return result;
    };

    it('invalidates cache and shows no toast on full success', async () => {
      mockCopyFiles.mockResolvedValue({
        results: [
          {
            sourcePath: 'reports/q1.pdf',
            destinationPath: 'archive/q1.pdf',
            success: true,
          },
        ],
      });

      const result = await renderAndWait();

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
      expect(mockListFiles).toHaveBeenCalledTimes(2);
      expect(mockNotification).not.toHaveBeenCalled();
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

      const result = await renderAndWait();

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

      const result = await renderAndWait();

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

      const result = await renderAndWait();

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
        expect(mockNotification).toHaveBeenCalledWith(
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

      const result = await renderAndWait();

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
        expect(mockNotification).toHaveBeenCalledWith(
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

      const result = await renderAndWait();

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
      expect(mockListFiles).toHaveBeenCalledTimes(2);
      expect(mockNotification).not.toHaveBeenCalled();
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

      const result = await renderAndWait();

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
        expect(mockNotification).toHaveBeenCalledWith(
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

      const result = await renderAndWait();

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
      expect(mockNotification).not.toHaveBeenCalled();
    });
  });

  describe('onSearchFiles', () => {
    it('debounces search and calls listFiles only once after 300ms', async () => {
      mockListFiles.mockResolvedValue({
        bucket: BUCKET,
        path: '',
        items: [
          {
            name: 'report.pdf',
            path: 'report.pdf',
            folderId: `${BUCKET}:`,
            nodeType: ListFilesItemDtoNodeTypeEnum.Item,
            bucket: BUCKET,
          },
        ],
        nextToken: undefined,
      });

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const initialCallCount = mockListFiles.mock.calls.length;

      vi.useFakeTimers();
      try {
        act(() => result.current.onSearchFiles('/', 'rep'));
        act(() => result.current.onSearchFiles('/', 'repo'));
        act(() => result.current.onSearchFiles('/', 'repor'));

        expect(mockListFiles).toHaveBeenCalledTimes(initialCallCount);

        act(() => {
          vi.advanceTimersByTime(300);
        });
        await act(() => Promise.resolve());

        expect(mockListFiles).toHaveBeenCalledTimes(initialCallCount + 1);
        const lastCall =
          mockListFiles.mock.calls[mockListFiles.mock.calls.length - 1][0];
        expect(lastCall).toMatchObject({ recursive: true });
        expect(result.current.searchResults).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('cancels in-flight search when a second query arrives before the first resolves', async () => {
      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const initialCallCount = mockListFiles.mock.calls.length;

      let resolveFirst!: (value: {
        bucket: string;
        path: string;
        items: ListFilesItemDto[];
        nextToken: undefined;
      }) => void;
      const firstPromise = new Promise<{
        bucket: string;
        path: string;
        items: ListFilesItemDto[];
        nextToken: undefined;
      }>((res) => {
        resolveFirst = res;
      });
      mockListFiles.mockReturnValueOnce(firstPromise).mockResolvedValue({
        bucket: BUCKET,
        path: '',
        items: [],
        nextToken: undefined,
      });

      vi.useFakeTimers();
      try {
        act(() => result.current.onSearchFiles('/', 'first'));
        act(() => {
          vi.advanceTimersByTime(300);
        });

        act(() => result.current.onSearchFiles('/', 'second'));
        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Flush second fetch (empty result)
        await act(() => Promise.resolve());

        expect(mockListFiles).toHaveBeenCalledTimes(initialCallCount + 2);
        expect(result.current.isSearching).toBe(false);

        // Resolve the stale first fetch — its result should be ignored
        resolveFirst({
          bucket: BUCKET,
          path: '',
          items: [
            {
              name: 'first-only.pdf',
              path: 'first-only.pdf',
              folderId: `${BUCKET}:`,
              nodeType: ListFilesItemDtoNodeTypeEnum.Item,
              bucket: BUCKET,
            },
          ],
          nextToken: undefined,
        });
        await act(() => Promise.resolve());

        expect(
          result.current.searchResults?.some(
            (r) => r.name === 'first-only.pdf',
          ),
        ).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('reconstructs virtual path for a nested file returned by search', async () => {
      const nestedItem: ListFilesItemDto = {
        name: 'summary.pdf',
        path: 'reports/q1/summary.pdf',
        url: `files/${BUCKET}/reports/q1/summary.pdf`,
        folderId: `${BUCKET}:reports/q1/`,
        nodeType: ListFilesItemDtoNodeTypeEnum.Item,
        bucket: BUCKET,
      };
      mockListFiles.mockResolvedValue({
        bucket: BUCKET,
        path: '',
        items: [nestedItem],
        nextToken: undefined,
      });

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      vi.useFakeTimers();
      try {
        act(() => result.current.onSearchFiles('/', 'summary'));
        act(() => {
          vi.advanceTimersByTime(300);
        });
        await act(() => Promise.resolve());

        const found = result.current.searchResults?.find(
          (r) => r.name === 'summary.pdf',
        );
        expect(found).toBeDefined();
        expect(found?.path).toBe('/My files/reports/q1/summary.pdf');
        expect(found?.parentPath).toBe('/My files/reports/q1');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('onManagePermissions', () => {
    it('resolves the correct item and opens the share modal target', async () => {
      mockListFiles.mockResolvedValue({
        bucket: BUCKET,
        path: '',
        items: [
          {
            name: 'report.pdf',
            path: `files/${BUCKET}/report.pdf`,
            folderId: `${BUCKET}:`,
            nodeType: ListFilesItemDtoNodeTypeEnum.Item,
            bucket: BUCKET,
          },
        ],
        nextToken: undefined,
      });

      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          actionProfile: DialFileManagerActionProfile.Full,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.shareTarget).toBeNull();

      act(() =>
        result.current.onManagePermissions(`files/${BUCKET}/report.pdf`),
      );

      expect(result.current.shareTarget).toEqual({
        bucket: BUCKET,
        path: 'report.pdf',
        name: 'report.pdf',
      });
    });

    it('does nothing when path does not resolve to a loaded item', async () => {
      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          actionProfile: DialFileManagerActionProfile.Full,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.onManagePermissions('unknown-path'));

      expect(result.current.shareTarget).toBeNull();
    });

    it('onCloseShareModal clears the share target', async () => {
      mockListFiles.mockResolvedValue({
        bucket: BUCKET,
        path: '',
        items: [
          {
            name: 'report.pdf',
            path: `files/${BUCKET}/report.pdf`,
            folderId: `${BUCKET}:`,
            nodeType: ListFilesItemDtoNodeTypeEnum.Item,
            bucket: BUCKET,
          },
        ],
        nextToken: undefined,
      });

      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          actionProfile: DialFileManagerActionProfile.Full,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() =>
        result.current.onManagePermissions(`files/${BUCKET}/report.pdf`),
      );
      expect(result.current.shareTarget).not.toBeNull();

      act(() => result.current.onCloseShareModal());
      expect(result.current.shareTarget).toBeNull();
    });

    it('onCreateShareLink calls shareFiles with the resolved target and permission', async () => {
      mockListFiles.mockResolvedValue({
        bucket: BUCKET,
        path: '',
        items: [
          {
            name: 'report.pdf',
            path: `files/${BUCKET}/report.pdf`,
            folderId: `${BUCKET}:`,
            nodeType: ListFilesItemDtoNodeTypeEnum.Item,
            bucket: BUCKET,
          },
        ],
        nextToken: undefined,
      });
      mockShareFiles.mockResolvedValue({
        invitationLink: 'https://chat.example.com/share/abc',
      });

      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          actionProfile: DialFileManagerActionProfile.Full,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() =>
        result.current.onManagePermissions(`files/${BUCKET}/report.pdf`),
      );

      let link: string | undefined;
      await act(async () => {
        link = await result.current.onCreateShareLink('read');
      });

      expect(mockShareFiles).toHaveBeenCalledWith(
        [{ bucket: BUCKET, path: 'report.pdf' }],
        'read',
        expect.any(AbortSignal),
      );
      expect(link).toBe('https://chat.example.com/share/abc');
    });

    it('clears isSharing immediately when the modal is closed on a pending request', async () => {
      mockListFiles.mockResolvedValue({
        bucket: BUCKET,
        path: '',
        items: [
          {
            name: 'report.pdf',
            path: `files/${BUCKET}/report.pdf`,
            folderId: `${BUCKET}:`,
            nodeType: ListFilesItemDtoNodeTypeEnum.Item,
            bucket: BUCKET,
          },
        ],
        nextToken: undefined,
      });
      mockShareFiles.mockImplementation(
        (_items, _permission, signal) =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      );

      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          actionProfile: DialFileManagerActionProfile.Full,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() =>
        result.current.onManagePermissions(`files/${BUCKET}/report.pdf`),
      );

      let pendingRejection: Promise<string> | undefined;
      act(() => {
        pendingRejection = result.current.onCreateShareLink('read');
        pendingRejection.catch(() => undefined);
      });

      await waitFor(() => expect(result.current.isSharing).toBe(true));

      act(() => result.current.onCloseShareModal());

      expect(result.current.isSharing).toBe(false);
      expect(result.current.shareTarget).toBeNull();
      await expect(pendingRejection).rejects.toThrow('Aborted');
    });
  });

  describe('onUnshareFiles and onRemoveFilesAccess', () => {
    const sharedWithMeFile = {
      id: `files/${OWNER_BUCKET}/team-docs/`,
      name: 'team-docs',
      path: '/Shared with me/team-docs/',
      parentPath: '/Shared with me',
      nodeType: DialFileNodeType.FOLDER,
      folderId: `${OWNER_BUCKET}:files/${OWNER_BUCKET}/team-docs/`,
      bucket: OWNER_BUCKET,
    };

    const myOwnedFile = {
      id: `files/${BUCKET}/report.pdf`,
      name: 'report.pdf',
      path: '/My files/report.pdf',
      parentPath: '/My files',
      nodeType: DialFileNodeType.ITEM,
      folderId: `${BUCKET}:`,
      bucket: BUCKET,
    };

    it('onUnshareFiles calls discardShared and triggers a retry with no toast on success', async () => {
      mockDiscardShared.mockResolvedValue({ success: true });
      const onNotification = vi.fn();

      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          activeTab: DialFileManagerTabs.Shared,
          actionProfile: DialFileManagerActionProfile.Full,
          onNotification,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      mockListSharedFiles.mockClear();

      act(() => result.current.onUnshareFiles([sharedWithMeFile]));

      await waitFor(() =>
        expect(mockDiscardShared).toHaveBeenCalledWith([
          { bucket: OWNER_BUCKET, path: 'team-docs/' },
        ]),
      );
      await waitFor(() => expect(mockListSharedFiles).toHaveBeenCalled());
      expect(onNotification).not.toHaveBeenCalled();
    });

    it('onUnshareFiles shows an error toast on failure', async () => {
      mockDiscardShared.mockRejectedValue(new Error('failed'));
      const onNotification = vi.fn();

      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          activeTab: DialFileManagerTabs.Shared,
          actionProfile: DialFileManagerActionProfile.Full,
          onNotification,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.onUnshareFiles([sharedWithMeFile]));

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith(
          expect.objectContaining({ variant: NotificationVariant.Error }),
        ),
      );
    });

    it('onRemoveFilesAccess calls revokeAccess and triggers a retry with no toast on success', async () => {
      mockRevokeAccess.mockResolvedValue({ success: true });
      const onNotification = vi.fn();

      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          activeTab: DialFileManagerTabs.MyFiles,
          actionProfile: DialFileManagerActionProfile.Full,
          onNotification,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      mockListFiles.mockClear();

      act(() => result.current.onRemoveFilesAccess([myOwnedFile]));

      await waitFor(() =>
        expect(mockRevokeAccess).toHaveBeenCalledWith([
          { bucket: BUCKET, path: 'report.pdf' },
        ]),
      );
      await waitFor(() => expect(mockListFiles).toHaveBeenCalled());
      expect(onNotification).not.toHaveBeenCalled();
    });

    it('onRemoveFilesAccess shows an error toast on failure', async () => {
      mockRevokeAccess.mockRejectedValue(new Error('failed'));
      const onNotification = vi.fn();

      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          activeTab: DialFileManagerTabs.MyFiles,
          actionProfile: DialFileManagerActionProfile.Full,
          onNotification,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.onRemoveFilesAccess([myOwnedFile]));

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith(
          expect.objectContaining({ variant: NotificationVariant.Error }),
        ),
      );
    });

    it('resolves bucket/path correctly for a batch of items', async () => {
      mockDiscardShared.mockResolvedValue({ success: true });

      const secondSharedFile = {
        id: `files/${OWNER_BUCKET}/notes.txt`,
        name: 'notes.txt',
        path: '/Shared with me/notes.txt',
        parentPath: '/Shared with me',
        nodeType: DialFileNodeType.ITEM,
        folderId: `${OWNER_BUCKET}:`,
        bucket: OWNER_BUCKET,
      };

      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          activeTab: DialFileManagerTabs.Shared,
          actionProfile: DialFileManagerActionProfile.Full,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() =>
        result.current.onUnshareFiles([sharedWithMeFile, secondSharedFile]),
      );

      await waitFor(() =>
        expect(mockDiscardShared).toHaveBeenCalledWith([
          { bucket: OWNER_BUCKET, path: 'team-docs/' },
          { bucket: OWNER_BUCKET, path: 'notes.txt' },
        ]),
      );
    });
  });

  describe('onGetInfo and clearMetadata', () => {
    const myFilesItem = {
      id: `files/${BUCKET}/report.pdf`,
      name: 'report.pdf',
      path: '/My files/report.pdf',
      parentPath: '/My files',
      nodeType: DialFileNodeType.ITEM,
      folderId: `${BUCKET}:`,
      bucket: BUCKET,
    };

    const metadataResponse = {
      name: 'report.pdf',
      nodeType: 'item',
      bucket: BUCKET,
      contentLength: 1234,
      contentType: 'application/pdf',
      author: 'Jane Doe',
      permissions: ['READ', 'WRITE'],
      updatedAt: 1700000000000,
    };

    it('resolves the current user bucket for a my_files item', async () => {
      mockGetFileMetadata.mockResolvedValue(metadataResponse);

      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          activeTab: DialFileManagerTabs.MyFiles,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.onGetInfo(myFilesItem));
      expect(result.current.isFileMetadataLoading).toBe(true);

      await waitFor(() =>
        expect(mockGetFileMetadata).toHaveBeenCalledWith({
          bucket: BUCKET,
          path: 'report.pdf',
        }),
      );
      await waitFor(() =>
        expect(result.current.isFileMetadataLoading).toBe(false),
      );
      expect(result.current.fileMetadata).toMatchObject({
        path: '/My files/report.pdf',
        contentLength: 1234,
        author: 'Jane Doe',
      });
    });

    it('resolves the owner bucket for a root-level shared item', async () => {
      mockGetFileMetadata.mockResolvedValue(metadataResponse);
      const sharedRootFile = {
        id: `files/${OWNER_BUCKET}/notes.txt`,
        name: 'notes.txt',
        path: '/Shared with me/notes.txt',
        parentPath: '/Shared with me',
        nodeType: DialFileNodeType.ITEM,
        folderId: `${OWNER_BUCKET}:`,
        bucket: OWNER_BUCKET,
      };

      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          activeTab: DialFileManagerTabs.Shared,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.onGetInfo(sharedRootFile));

      await waitFor(() =>
        expect(mockGetFileMetadata).toHaveBeenCalledWith({
          bucket: OWNER_BUCKET,
          path: 'notes.txt',
        }),
      );
    });

    it('resolves the owner bucket for a nested shared item', async () => {
      mockGetFileMetadata.mockResolvedValue(metadataResponse);
      const nestedSharedFile = {
        id: `files/${OWNER_BUCKET}/team-docs/report.pdf`,
        name: 'report.pdf',
        path: '/Shared with me/team-docs/report.pdf',
        parentPath: '/Shared with me/team-docs',
        nodeType: DialFileNodeType.ITEM,
        folderId: `${OWNER_BUCKET}:files/${OWNER_BUCKET}/team-docs/`,
        bucket: OWNER_BUCKET,
      };

      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          activeTab: DialFileManagerTabs.Shared,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.onGetInfo(nestedSharedFile));

      await waitFor(() =>
        expect(mockGetFileMetadata).toHaveBeenCalledWith({
          bucket: OWNER_BUCKET,
          path: 'team-docs/report.pdf',
        }),
      );
    });

    it('resolves the item bucket for an organization item', async () => {
      mockGetFileMetadata.mockResolvedValue(metadataResponse);
      const publicBucket = 'public-bucket';
      const orgFile = {
        id: `files/${publicBucket}/guide.pdf`,
        name: 'guide.pdf',
        path: '/Organization/guide.pdf',
        parentPath: '/Organization',
        nodeType: DialFileNodeType.ITEM,
        folderId: `${publicBucket}:`,
        bucket: publicBucket,
      };

      const { result } = renderHook(() =>
        useDialFileManager({
          bucket: BUCKET,
          activeTab: DialFileManagerTabs.Organization,
        }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.onGetInfo(orgFile));

      await waitFor(() =>
        expect(mockGetFileMetadata).toHaveBeenCalledWith({
          bucket: publicBucket,
          path: 'guide.pdf',
        }),
      );
    });

    it('shows an error toast and clears loading when getFileMetadata rejects', async () => {
      mockGetFileMetadata.mockRejectedValue(new Error('failed'));
      const onNotification = vi.fn();

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET, onNotification }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.onGetInfo(myFilesItem));

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith(
          expect.objectContaining({ variant: NotificationVariant.Error }),
        ),
      );
      expect(result.current.isFileMetadataLoading).toBe(false);
    });

    it('clearMetadata resets fileMetadata and isFileMetadataLoading', async () => {
      mockGetFileMetadata.mockResolvedValue(metadataResponse);

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.onGetInfo(myFilesItem));
      await waitFor(() =>
        expect(result.current.fileMetadata).not.toBeUndefined(),
      );

      act(() => result.current.clearMetadata());

      expect(result.current.fileMetadata).toBeUndefined();
      expect(result.current.isFileMetadataLoading).toBe(false);
    });
  });

  describe('onUploadArchive', () => {
    const mockUploadArchive = vi.mocked(filesApi.uploadArchive);

    it('invalidates the destination cache and shows no toast on full success', async () => {
      mockUploadArchive.mockResolvedValue({
        results: [
          { path: 'reports/a.txt', success: true },
          { path: 'reports/b.txt', success: true },
        ],
      });
      const onNotification = vi.fn();

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET, onNotification }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.onUploadArchive(
          new File(['zip'], 'archive.zip'),
          'archive.zip',
          '/My files/reports',
        );
      });

      await waitFor(() => expect(result.current.uploadBatchState).toBeNull());
      expect(onNotification).not.toHaveBeenCalled();
    });

    it('shows a partial-failure toast with the failed count', async () => {
      mockUploadArchive.mockResolvedValue({
        results: [
          { path: 'reports/a.txt', success: true },
          { path: 'reports/b.txt', success: false, error: 'Conflict' },
        ],
      });
      const onNotification = vi.fn();

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET, onNotification }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.onUploadArchive(
          new File(['zip'], 'archive.zip'),
          'archive.zip',
          '/My files/reports',
        );
      });

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: NotificationVariant.Error,
            message: 'dialFileManager.uploadArchivePartialError',
          }),
        ),
      );
    });

    it('shows a full-failure toast when the request rejects', async () => {
      mockUploadArchive.mockRejectedValue(new Error('network error'));
      const onNotification = vi.fn();

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET, onNotification }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.onUploadArchive(
          new File(['zip'], 'archive.zip'),
          'archive.zip',
          '/My files/reports',
        );
      });

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: NotificationVariant.Error,
            message: 'dialFileManager.uploadArchiveError',
          }),
        ),
      );
    });

    it('resolves bucket and destinationPath relative to the destination folder', async () => {
      mockUploadArchive.mockResolvedValue({ results: [] });

      const { result } = renderHook(() =>
        useDialFileManager({ bucket: BUCKET }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const file = new File(['zip'], 'archive.zip');
      act(() => {
        result.current.onUploadArchive(
          file,
          'archive.zip',
          '/My files/reports',
        );
      });

      await waitFor(() =>
        expect(mockUploadArchive).toHaveBeenCalledWith(
          file,
          BUCKET,
          'reports/',
        ),
      );
    });
  });
});
