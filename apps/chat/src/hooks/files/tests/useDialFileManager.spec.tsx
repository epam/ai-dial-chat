import { HIDDEN_FILE } from '@epam/ai-dial-chat-shared';
import { DialFilePermission } from '@epam/ai-dial-ui-kit';
import type { ListFilesItemDto } from '@epam/chat-api-client';
import { ListFilesItemDtoNodeTypeEnum } from '@epam/chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as filesApi from '../../../server-api/files.api';
import { useDialFileManager } from '../useDialFileManager';

vi.mock('../../../server-api/files.api');

const mockListFiles = vi.mocked(filesApi.listFiles);

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

  it('propagates createFolder rejection to the caller (e.g. 409 conflict)', async () => {
    const mockCreateFolder = vi.mocked(filesApi.createFolder);
    const conflict = new Error('Conflict');
    mockCreateFolder.mockRejectedValue(conflict);

    const { result } = renderHook(() => useDialFileManager({ bucket: BUCKET }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.onCreateFolder(
          {
            name: HIDDEN_FILE,
            fileContent: new File([], HIDDEN_FILE),
          },
          '/All files/2026',
          `/All files/2026/${HIDDEN_FILE}`,
        );
      }),
    ).rejects.toThrow('Conflict');
    expect(result.current.isCreatingFolder).toBe(false);
  });

  it('updates upload percent while a file is uploading', async () => {
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

  it('merges created folder into parent cache immediately', async () => {
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

    await waitFor(() =>
      expect(
        result.current.items[0].items?.some((item) => item.name === '2026'),
      ).toBe(true),
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
});
