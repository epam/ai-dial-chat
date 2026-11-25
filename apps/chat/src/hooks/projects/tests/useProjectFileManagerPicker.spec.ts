import {
  AttachmentType,
  type AttachResult,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import {
  DialFileNodeType,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsI18nKeys } from '../../../constants/translation-keys';
import { useNotification } from '../../../context/NotificationContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import * as filesApi from '../../../server-api/files.api';
import { useProjectFileManagerPicker } from '../useProjectFileManagerPicker';

vi.mock('../../../server-api/files.api');
vi.mock('../../../context/NotificationContext');

const mockShowNotification = vi.fn();
const mockDownloadFile = vi.mocked(filesApi.downloadFile);
const limits = { maxFileBytes: 5, maxTotalBytes: 8 };

const dialFile = (overrides: Partial<DialFile> = {}): DialFile => ({
  id: 'files/other-bucket/data/tickets.csv',
  path: '/My files/data/tickets.csv',
  folderId: 'data',
  name: 'tickets.csv',
  nodeType: DialFileNodeType.ITEM,
  bucket: 'other-bucket',
  contentType: 'text/csv',
  ...overrides,
});

const attach = (files: DialFile[]): AttachResult => ({
  files,
  folderPaths: [],
});

describe('useProjectFileManagerPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(mockShowNotification),
    );
  });

  it('opens the modal when a pick starts', () => {
    const { result } = renderHook(() =>
      useProjectFileManagerPicker('my-bucket', [], limits),
    );

    act(() => {
      void result.current.pickFromFileManager();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('resolves with copies of the picked files downloaded from their own bucket', async () => {
    mockDownloadFile.mockResolvedValue(new Response('a,b'));
    const { result } = renderHook(() =>
      useProjectFileManagerPicker('my-bucket', [], limits),
    );

    let pick!: ReturnType<typeof result.current.pickFromFileManager>;
    act(() => {
      pick = result.current.pickFromFileManager();
    });
    act(() =>
      result.current.handleAttach(
        attach([
          dialFile(),
          dialFile({ name: 'data', nodeType: DialFileNodeType.FOLDER }),
        ]),
      ),
    );
    const files = await pick;

    expect(mockDownloadFile).toHaveBeenCalledOnce();
    expect(mockDownloadFile).toHaveBeenCalledWith(
      'other-bucket',
      'data/tickets.csv',
      expect.any(AbortSignal),
    );
    expect(files?.map((file) => file.name)).toEqual(['tickets.csv']);
    expect(files?.[0].type).toBe('text/csv');
    expect(await files?.[0].text()).toBe('a,b');
    expect(result.current.isOpen).toBe(false);
  });

  it('keeps an over-budget selection open without downloading and accepts an exact-fit retry', async () => {
    const { result } = renderHook(() =>
      useProjectFileManagerPicker(
        'my-bucket',
        [
          {
            id: 'stored',
            name: 'stored.csv',
            contentType: 'text/csv',
            type: AttachmentType.File,
            status: RequestStatus.Idle,
            isStored: true,
            size: 5,
          },
        ],
        limits,
      ),
    );
    let pick!: ReturnType<typeof result.current.pickFromFileManager>;
    act(() => {
      pick = result.current.pickFromFileManager();
    });
    act(() =>
      result.current.handleAttach(attach([dialFile({ contentLength: 4 })])),
    );
    expect(mockDownloadFile).not.toHaveBeenCalled();
    expect(result.current.isOpen).toBe(true);
    mockDownloadFile.mockResolvedValue(new Response('123'));
    act(() =>
      result.current.handleAttach(attach([dialFile({ contentLength: 3 })])),
    );
    expect((await pick)?.[0].size).toBe(3);
  });

  it.each([
    { bodies: ['123456'], error: ProjectsI18nKeys.CreateErrorTooLarge },
    {
      bodies: ['1234', '12345'],
      error: ProjectsI18nKeys.CreateErrorCapacityExceeded,
    },
  ])(
    'checks actual bytes when metadata understates the download',
    async ({ bodies, error }) => {
      for (const body of bodies)
        mockDownloadFile.mockResolvedValueOnce(new Response(body));
      const { result } = renderHook(() =>
        useProjectFileManagerPicker('my-bucket', [], limits),
      );
      let pick!: ReturnType<typeof result.current.pickFromFileManager>;
      act(() => {
        pick = result.current.pickFromFileManager();
      });
      act(() =>
        result.current.handleAttach(
          attach(
            bodies.map((_, i) =>
              dialFile({ name: i + '.csv', contentLength: 1 }),
            ),
          ),
        ),
      );
      await expect(pick).resolves.toBeUndefined();
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({ message: error }),
      );
      expect(mockDownloadFile.mock.calls[0][2]?.aborted).toBe(true);
    },
  );

  it('resolves undefined when the modal is closed', async () => {
    const { result } = renderHook(() =>
      useProjectFileManagerPicker('my-bucket', [], limits),
    );

    let pick!: ReturnType<typeof result.current.pickFromFileManager>;
    act(() => {
      pick = result.current.pickFromFileManager();
    });
    act(() => result.current.handleClose());

    await expect(pick).resolves.toBeUndefined();
  });

  it('shows an error and resolves undefined when a download fails', async () => {
    mockDownloadFile.mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);
    const { result } = renderHook(() =>
      useProjectFileManagerPicker('my-bucket', [], limits),
    );

    let pick!: ReturnType<typeof result.current.pickFromFileManager>;
    act(() => {
      pick = result.current.pickFromFileManager();
    });
    act(() => result.current.handleAttach(attach([dialFile()])));

    await expect(pick).resolves.toBeUndefined();
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: NotificationVariant.Error,
        message: ProjectsI18nKeys.CreateToastFileManagerError,
      }),
    );
  });

  it('settles a pending pick on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useProjectFileManagerPicker('my-bucket', [], limits),
    );

    let pick!: ReturnType<typeof result.current.pickFromFileManager>;
    act(() => {
      pick = result.current.pickFromFileManager();
    });
    unmount();

    await expect(pick).resolves.toBeUndefined();
  });
});
