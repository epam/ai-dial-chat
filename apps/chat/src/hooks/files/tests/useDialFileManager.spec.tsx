import { HIDDEN_FILE } from '@epam/ai-dial-chat-shared';
import {
  DialFileNodeType,
  DialFilePermission,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import type { ListFilesItemDto } from '@epam/chat-api-client';
import { ListFilesItemDtoNodeTypeEnum } from '@epam/chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as filesApi from '../../../server-api/files.api';
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
const mockDownloadArchive = vi.mocked(filesApi.downloadArchive);
const mockDeleteFiles = vi.mocked(filesApi.deleteFiles);

const BUCKET = 'test-bucket';

beforeEach(() => {
  mockListFiles.mockResolvedValue({
    bucket: BUCKET,
    path: '',
    items: [],
    nextToken: undefined,
  });
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

  it('navigates to a subfolder via onPathChange', async () => {
    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.onPathChange('/All files/reports/'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'reports/' }),
    );
    expect(result.current.path).toBe('/All files/reports/');
  });

  it('navigates via onPathChange without leading slash (DialFileManager breadcrumb format)', async () => {
    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // DialFileManager breadcrumb calls onPathChange with "All files/reports"
    // (no leading /, no trailing /)
    act(() => result.current.onPathChange('All files/reports'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'reports/' }),
    );
    expect(result.current.path).toBe('/All files/reports/');
  });

  it('resets folderPath to root when onPathChange receives the root label path', async () => {
    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.onPathChange('/All files/reports/'));
    await waitFor(() =>
      expect(result.current.path).toBe('/All files/reports/'),
    );

    act(() => result.current.onPathChange('/All files'));
    await waitFor(() => expect(result.current.path).toBe('/All files'));
    expect(mockListFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: '' }),
    );
  });

  it('resets to root when onPathChange receives root label without leading slash', async () => {
    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.onPathChange('All files/reports/'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.onPathChange('All files'));
    await waitFor(() => expect(result.current.path).toBe('/All files'));
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

    act(() => result.current.onPathChange('/All files/reports/'));
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
        '/All files/2026',
        `/All files/2026/${HIDDEN_FILE}`,
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
        '/All files',
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
        '/All files/2026',
        `/All files/2026/${HIDDEN_FILE}`,
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
        '/All files/2026',
        `/All files/2026/${HIDDEN_FILE}`,
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
        '/All files/2026',
        `/All files/2026/${HIDDEN_FILE}`,
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
          id: '/All files/report-a.pdf',
          name: 'report-a.pdf',
          path: '/All files/report-a.pdf',
          parentPath: '/All files',
          nodeType: DialFileNodeType.ITEM,
          folderId: BUCKET,
          bucket: BUCKET,
        },
        {
          id: '/All files/report-b.pdf',
          name: 'report-b.pdf',
          path: '/All files/report-b.pdf',
          parentPath: '/All files',
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
          id: '/All files/report-a.pdf',
          name: 'report-a.pdf',
          path: '/All files/report-a.pdf',
          parentPath: '/All files',
          nodeType: DialFileNodeType.ITEM,
          folderId: BUCKET,
          bucket: BUCKET,
        },
        {
          id: '/All files/report-b.pdf',
          name: 'report-b.pdf',
          path: '/All files/report-b.pdf',
          parentPath: '/All files',
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
            sourceUrl: '/All files/reports/old.pdf',
            nodeType: DialFileNodeType.ITEM,
          },
          {
            sourceUrl: '/All files/reports/locked.pdf',
            nodeType: DialFileNodeType.ITEM,
          },
        ],
        '/All files/reports',
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
        '/All files',
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
        '/All files',
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
        await result.current.onValidateUpload(files, [], '/All files');
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
          '/All files',
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
          '/All files',
        );
      });

      expect(validation).toEqual({ valid: true });
    });
  });
});
