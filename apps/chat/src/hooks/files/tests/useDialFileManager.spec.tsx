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
const mockDownloadArchive = vi.mocked(filesApi.downloadArchive);
const mockDeleteFiles = vi.mocked(filesApi.deleteFiles);

const BUCKET = 'test-bucket';

const OWNER_BUCKET = 'owner-bucket';

const emptySharedListResponse = { bucket: '', path: '', items: [] };
const emptyPublicListResponse = { bucket: 'public', path: '', items: [] };

beforeEach(() => {
  mockListFiles.mockResolvedValue({
    bucket: BUCKET,
    path: '',
    items: [],
    nextToken: undefined,
  });
  mockListSharedFiles.mockResolvedValue(emptySharedListResponse);
  mockListPublicFiles.mockResolvedValue(emptyPublicListResponse);
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

    describe.each([
      DialFileManagerTabs.MyFiles,
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
      it('is populated from root Shared listing items', async () => {
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
          `files/${OWNER_BUCKET}/team-docs/`,
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
      expect(msg).toBeTruthy();
    });

    it('returns invalid chars error for name containing backslash', async () => {
      const result = await renderAndWait();
      const msg = result.current.onRenameValidate('a\\b', dummyItem);
      expect(msg).toBeTruthy();
    });

    it('returns too-long error for name longer than 255 chars', async () => {
      const result = await renderAndWait();
      const msg = result.current.onRenameValidate('a'.repeat(256), dummyItem);
      expect(msg).toBeTruthy();
    });

    it('returns invalid chars error when name matches forbiddenSymbolsRegExp', async () => {
      const result = await renderAndWait({
        forbiddenSymbolsRegExp: /[<>]/,
      });
      const msg = result.current.onRenameValidate('file<name>', dummyItem);
      expect(msg).toBeTruthy();
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
});
