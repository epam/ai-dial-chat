import type { ListFilesItemDto } from '@epam/ai-dial-chat-api-client';
import { ListFilesItemDtoNodeTypeEnum } from '@epam/ai-dial-chat-api-client';
import { DialFileManagerTabs } from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SharedRootMeta } from '../../dial-file-manager.model';
import { FileManagerNotificationReason } from '../../dial-file-manager.types';
import type { DialFilesApi } from '../../dial-files-api';
import * as fileNameUtils from '../../file-name';
import type { UseDialFileUploadBatchOptions } from '../useDialFileUploadBatch';
import { useDialFileUploadBatch } from '../useDialFileUploadBatch';

vi.mock('../../file-name', () => ({
  sanitizeFileName: vi.fn((name: string) => name),
}));

const BUCKET = 'test-bucket';

const makeFilesApi = (): DialFilesApi =>
  ({
    uploadFile: vi.fn().mockResolvedValue({ url: `files/${BUCKET}/file.pdf` }),
    uploadArchive: vi.fn().mockResolvedValue({ results: [] }),
  }) as unknown as DialFilesApi;

const renderUploadBatch = (
  overrides: Partial<UseDialFileUploadBatchOptions> = {},
) => {
  const invalidateFolders = vi.fn();
  const bumpRetry = vi.fn();
  const onNotification = vi.fn();
  const sharedRootMetaRef = { current: new Map<string, SharedRootMeta>() };
  const filesApi = overrides.filesApi ?? makeFilesApi();

  const { result } = renderHook(() =>
    useDialFileUploadBatch({
      filesApi,
      bucket: BUCKET,
      rootLabel: 'My files',
      activeTab: DialFileManagerTabs.MyFiles,
      cache: new Map<string, ListFilesItemDto[]>(),
      sharedRootMetaRef,
      invalidateFolders,
      bumpRetry,
      onNotification,
      ...overrides,
    }),
  );

  return { result, invalidateFolders, bumpRetry, onNotification, filesApi };
};

beforeEach(() => {
  vi.mocked(fileNameUtils.sanitizeFileName).mockImplementation(
    (name: string) => name,
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useDialFileUploadBatch', () => {
  describe('sanitize -> conflict resolution -> upload mode', () => {
    it('sanitizes file names via onValidateUpload before upload', async () => {
      const mockSanitize = vi.mocked(fileNameUtils.sanitizeFileName);
      mockSanitize.mockImplementation((name) => name.replace(/[/:]/g, '_'));

      const { result } = renderUploadBatch();

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
      const cachedFile: ListFilesItemDto = {
        name: 'existing.pdf',
        path: 'existing.pdf',
        folderId: `${BUCKET}:`,
        nodeType: ListFilesItemDtoNodeTypeEnum.Item,
        bucket: BUCKET,
      };
      const cache = new Map<string, ListFilesItemDto[]>([['', [cachedFile]]]);

      const { result, filesApi } = renderUploadBatch({ cache });

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

      await waitFor(() => expect(filesApi.uploadFile).toHaveBeenCalledTimes(2));

      const calls = vi.mocked(filesApi.uploadFile).mock.calls;
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

      const { result } = renderUploadBatch();

      let validation:
        Awaited<ReturnType<typeof result.current.onValidateUpload>> | undefined;
      await act(async () => {
        validation = await result.current.onValidateUpload(
          [{ name: 'report.pdf', fileContent: new File([], 'report.pdf') }],
          [existingFile as never],
          '/My files',
        );
      });

      expect(validation).toEqual({ valid: true });
    });

    it('routes an archive conflict fallback back through archive upload', async () => {
      const { result, invalidateFolders, filesApi } = renderUploadBatch();
      const file = new File(['zip'], 'archive.zip');

      act(() => {
        result.current.onUploadFiles(
          [{ name: 'archive', fileContent: file }],
          '/My files/reports',
        );
      });

      await waitFor(() =>
        expect(filesApi.uploadArchive).toHaveBeenCalledWith(
          file,
          BUCKET,
          'reports/archive/',
        ),
      );
      expect(filesApi.uploadFile).not.toHaveBeenCalled();
      expect(invalidateFolders).toHaveBeenCalledWith(['reports/']);
    });

    it('keeps ordinary ZIP file uploads on the normal file-upload path', async () => {
      const { result, filesApi } = renderUploadBatch();
      const file = new File(['zip'], 'archive.zip');

      act(() => {
        result.current.onUploadFiles(
          [{ name: 'archive.zip', fileContent: file }],
          '/My files/reports',
        );
      });

      await waitFor(() =>
        expect(filesApi.uploadFile).toHaveBeenCalledWith(
          BUCKET,
          'reports/archive.zip',
          file,
          expect.objectContaining({ uploadMode: 'create-only' }),
        ),
      );
      expect(filesApi.uploadArchive).not.toHaveBeenCalled();
    });

    it('uploads at most three files concurrently for a batch of five', async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      const filesApi = makeFilesApi();
      vi.mocked(filesApi.uploadFile).mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight -= 1;
        return { url: `files/${BUCKET}/file.pdf` };
      });

      const { result } = renderUploadBatch({ filesApi });
      const files = Array.from({ length: 5 }, (_, i) => ({
        name: `file-${i}.pdf`,
        fileContent: new File(['data'], `file-${i}.pdf`),
      }));

      act(() => {
        result.current.onUploadFiles(files, '/My files');
      });

      await waitFor(() => expect(filesApi.uploadFile).toHaveBeenCalledTimes(5));
      expect(maxInFlight).toBeLessThanOrEqual(3);
    });

    it('marks queued and in-flight files Cancelled when the batch is cancelled', async () => {
      const filesApi = makeFilesApi();
      vi.mocked(filesApi.uploadFile).mockImplementation(
        (_bucket, _path, _file, options) =>
          new Promise((_resolve, reject) => {
            const opts = options as { signal?: AbortSignal };
            opts.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      );

      const { result } = renderUploadBatch({ filesApi });
      const files = Array.from({ length: 3 }, (_, i) => ({
        name: `file-${i}.pdf`,
        fileContent: new File(['data'], `file-${i}.pdf`),
      }));

      act(() => {
        result.current.onUploadFiles(files, '/My files');
      });

      await waitFor(() =>
        expect(result.current.uploadBatchState?.files.length).toBe(3),
      );

      act(() => {
        result.current.cancelUpload();
      });

      await waitFor(() => expect(result.current.uploadBatchState).toBeNull());
    });
  });

  describe('batch completion notifications', () => {
    it('reports UploadFailed when every file in the batch fails', async () => {
      const filesApi = makeFilesApi();
      vi.mocked(filesApi.uploadFile).mockRejectedValue(new Error('failed'));

      const { result, onNotification } = renderUploadBatch({ filesApi });

      act(() => {
        result.current.onUploadFiles(
          [{ name: 'a.pdf', fileContent: new File([], 'a.pdf') }],
          '/My files',
        );
      });

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: NotificationVariant.Error,
            reason: FileManagerNotificationReason.UploadFailed,
          }),
        ),
      );
    });

    it('reports UploadCompleted when the batch fully succeeds', async () => {
      const { result, onNotification } = renderUploadBatch();

      act(() => {
        result.current.onUploadFiles(
          [{ name: 'a.pdf', fileContent: new File([], 'a.pdf') }],
          '/My files',
        );
      });

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: NotificationVariant.Success,
            reason: FileManagerNotificationReason.UploadCompleted,
          }),
        ),
      );
    });

    it('always invalidates the destination folder and clears batch state on completion', async () => {
      const { result, invalidateFolders, bumpRetry } = renderUploadBatch();

      act(() => {
        result.current.onUploadFiles(
          [{ name: 'a.pdf', fileContent: new File([], 'a.pdf') }],
          '/My files/reports',
        );
      });

      await waitFor(() => expect(result.current.uploadBatchState).toBeNull());
      expect(invalidateFolders).toHaveBeenCalledWith(['reports/']);
      expect(bumpRetry).toHaveBeenCalled();
    });
  });

  describe('onUploadArchive', () => {
    it('invalidates the destination cache and shows no notification on full success', async () => {
      const filesApi = makeFilesApi();
      vi.mocked(filesApi.uploadArchive).mockResolvedValue({
        results: [
          { path: 'reports/archive/a.txt', success: true },
          { path: 'reports/archive/b.txt', success: true },
        ],
      });

      const { result, invalidateFolders, bumpRetry, onNotification } =
        renderUploadBatch({ filesApi });

      act(() => {
        result.current.onUploadArchive(
          new File(['zip'], 'archive.zip'),
          'archive',
          '/My files/reports',
        );
      });

      await waitFor(() => expect(result.current.uploadBatchState).toBeNull());
      expect(onNotification).not.toHaveBeenCalled();
      expect(invalidateFolders).toHaveBeenCalledWith(['reports/']);
      expect(bumpRetry).toHaveBeenCalled();
    });

    it('shows a partial-failure notification with the failed count', async () => {
      const filesApi = makeFilesApi();
      vi.mocked(filesApi.uploadArchive).mockResolvedValue({
        results: [
          { path: 'reports/a.txt', success: true },
          { path: 'reports/b.txt', success: false, error: 'Conflict' },
        ],
      });

      const { result, onNotification } = renderUploadBatch({ filesApi });

      act(() => {
        result.current.onUploadArchive(
          new File(['zip'], 'archive.zip'),
          'archive',
          '/My files/reports',
        );
      });

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: NotificationVariant.Error,
            reason: FileManagerNotificationReason.UploadArchivePartiallyFailed,
            count: 1,
          }),
        ),
      );
    });

    it('lists up to 5 failed entry names on full failure', async () => {
      const filesApi = makeFilesApi();
      const results = Array.from({ length: 7 }, (_, i) => ({
        path: `reports/file-${i}.txt`,
        success: false,
        error: 'Invalid path',
      }));
      vi.mocked(filesApi.uploadArchive).mockResolvedValue({ results });

      const { result, onNotification } = renderUploadBatch({ filesApi });

      act(() => {
        result.current.onUploadArchive(
          new File(['zip'], 'archive.zip'),
          'archive',
          '/My files/reports',
        );
      });

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: NotificationVariant.Error,
            reason: FileManagerNotificationReason.UploadArchiveFailed,
            restCount: 2,
          }),
        ),
      );
      const call = vi
        .mocked(onNotification)
        .mock.calls.find(
          (c) =>
            c[0].reason === FileManagerNotificationReason.UploadArchiveFailed,
        );
      expect(call?.[0].names).toHaveLength(5);
    });

    it('shows a request-level failure notification when the request rejects', async () => {
      const filesApi = makeFilesApi();
      vi.mocked(filesApi.uploadArchive).mockRejectedValue(
        new Error('network error'),
      );

      const { result, onNotification } = renderUploadBatch({ filesApi });

      act(() => {
        result.current.onUploadArchive(
          new File(['zip'], 'archive.zip'),
          'archive',
          '/My files/reports',
        );
      });

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: NotificationVariant.Error,
            reason: FileManagerNotificationReason.UploadArchiveRequestFailed,
          }),
        ),
      );
    });

    it('resolves bucket and destinationPath to an archive-named child folder', async () => {
      const { result, filesApi } = renderUploadBatch();

      const file = new File(['zip'], 'archive.zip');
      act(() => {
        result.current.onUploadArchive(file, 'archive', '/My files/reports');
      });

      await waitFor(() =>
        expect(filesApi.uploadArchive).toHaveBeenCalledWith(
          file,
          BUCKET,
          'reports/archive/',
        ),
      );
    });
  });
});
