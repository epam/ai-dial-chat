import { DialFileManagerTabs, NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { ListFilesItemDto } from '@epam/chat-api-client';
import { ListFilesItemDtoNodeTypeEnum } from '@epam/chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as filesApi from '../../../../server-api/files.api';
import * as fileNameUtils from '../../../../utils/file-name';
import type { SharedRootMeta } from '../../dial-file-manager.model';
import type { UseDialFileUploadBatchOptions } from '../../useDialFileUploadBatch';
import { useDialFileUploadBatch } from '../../useDialFileUploadBatch';

vi.mock('../../../../server-api/files.api');
vi.mock('../../../../utils/file-name', () => ({
  sanitizeFileName: vi.fn((name: string) => name),
}));

const mockUploadFile = vi.mocked(filesApi.uploadFile);
const mockUploadArchive = vi.mocked(filesApi.uploadArchive);

const BUCKET = 'test-bucket';

const renderUploadBatch = (
  overrides: Partial<UseDialFileUploadBatchOptions> = {},
) => {
  const invalidateFolders = vi.fn();
  const bumpRetry = vi.fn();
  const onNotification = vi.fn();
  const sharedRootMetaRef = { current: new Map<string, SharedRootMeta>() };

  const { result } = renderHook(() =>
    useDialFileUploadBatch({
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

  return { result, invalidateFolders, bumpRetry, onNotification };
};

beforeEach(() => {
  mockUploadFile.mockResolvedValue({ url: `files/${BUCKET}/file.pdf` });
  mockUploadArchive.mockResolvedValue({ results: [] });
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
      const mockSanitize = vi.mocked(fileNameUtils.sanitizeFileName);
      mockSanitize.mockImplementation((name) => name);

      const cachedFile: ListFilesItemDto = {
        name: 'existing.pdf',
        path: 'existing.pdf',
        folderId: `${BUCKET}:`,
        nodeType: ListFilesItemDtoNodeTypeEnum.Item,
        bucket: BUCKET,
      };
      const cache = new Map<string, ListFilesItemDto[]>([['', [cachedFile]]]);

      const { result } = renderUploadBatch({ cache });

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

      const { result } = renderUploadBatch();

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

  describe('onUploadArchive', () => {
    it('invalidates the destination cache and shows no toast on full success', async () => {
      mockUploadArchive.mockResolvedValue({
        results: [
          { path: 'reports/a.txt', success: true },
          { path: 'reports/b.txt', success: true },
        ],
      });

      const { result, invalidateFolders, bumpRetry, onNotification } =
        renderUploadBatch();

      act(() => {
        result.current.onUploadArchive(
          new File(['zip'], 'archive.zip'),
          'archive.zip',
          '/My files/reports',
        );
      });

      await waitFor(() => expect(result.current.uploadBatchState).toBeNull());
      expect(onNotification).not.toHaveBeenCalled();
      expect(invalidateFolders).toHaveBeenCalledWith(['reports/']);
      expect(bumpRetry).toHaveBeenCalled();
    });

    it('shows a partial-failure toast with the failed count', async () => {
      mockUploadArchive.mockResolvedValue({
        results: [
          { path: 'reports/a.txt', success: true },
          { path: 'reports/b.txt', success: false, error: 'Conflict' },
        ],
      });

      const { result, onNotification } = renderUploadBatch();

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

    it('shows a file-list failure toast when all returned archive entries fail', async () => {
      mockUploadArchive.mockResolvedValue({
        results: [
          { path: 'reports/a.txt', success: false, error: 'Invalid path' },
        ],
      });

      const { result, onNotification } = renderUploadBatch();

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
            message: 'dialFileManager.uploadArchiveFilesError',
          }),
        ),
      );
    });

    it('shows a full-failure toast when the request rejects', async () => {
      mockUploadArchive.mockRejectedValue(new Error('network error'));

      const { result, onNotification } = renderUploadBatch();

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

      const { result } = renderUploadBatch();

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
