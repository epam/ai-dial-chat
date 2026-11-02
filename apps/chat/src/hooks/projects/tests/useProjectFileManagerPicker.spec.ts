import type { AttachResult } from '@epam/ai-dial-chat-shared';
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
      useProjectFileManagerPicker('my-bucket'),
    );

    act(() => {
      void result.current.pickFromFileManager();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('resolves with copies of the picked files downloaded from their own bucket', async () => {
    /* A test-realm Blob, for the jsdom `File` constructor (see the skill picker spec). */
    mockDownloadFile.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['a,b'], { type: 'text/csv' }),
    } as unknown as Response);
    const { result } = renderHook(() =>
      useProjectFileManagerPicker('my-bucket'),
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
    );
    expect(files?.map((file) => file.name)).toEqual(['tickets.csv']);
    expect(files?.[0].type).toBe('text/csv');
    expect(await files?.[0].text()).toBe('a,b');
    expect(result.current.isOpen).toBe(false);
  });

  it('resolves undefined when the modal is closed', async () => {
    const { result } = renderHook(() =>
      useProjectFileManagerPicker('my-bucket'),
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
      useProjectFileManagerPicker('my-bucket'),
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
      useProjectFileManagerPicker('my-bucket'),
    );

    let pick!: ReturnType<typeof result.current.pickFromFileManager>;
    act(() => {
      pick = result.current.pickFromFileManager();
    });
    unmount();

    await expect(pick).resolves.toBeUndefined();
  });
});
