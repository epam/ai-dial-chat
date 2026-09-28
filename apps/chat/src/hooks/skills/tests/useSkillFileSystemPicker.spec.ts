import type { AttachResult } from '@epam/ai-dial-chat-shared';
import {
  DialFileNodeType,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillEditorI18nKeys } from '../../../constants/translation-keys';
import { useNotification } from '../../../context/NotificationContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import * as filesApi from '../../../server-api/files.api';
import { useSkillFileSystemPicker } from '../useSkillFileSystemPicker';

vi.mock('../../../server-api/files.api');
vi.mock('../../../context/NotificationContext');

const mockShowNotification = vi.fn();
const mockDownloadFile = vi.mocked(filesApi.downloadFile);

const dialFile = (overrides: Partial<DialFile> = {}): DialFile => ({
  id: 'files/other-bucket/docs/notes.md',
  path: '/My files/docs/notes.md',
  folderId: 'docs',
  name: 'notes.md',
  nodeType: DialFileNodeType.ITEM,
  bucket: 'other-bucket',
  contentType: 'text/markdown',
  ...overrides,
});

const attach = (files: DialFile[]): AttachResult => ({
  files,
  folderPaths: [],
});

describe('useSkillFileSystemPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(mockShowNotification),
    );
  });

  it('opens the modal when a pick starts', () => {
    const { result } = renderHook(() => useSkillFileSystemPicker('my-bucket'));

    act(() => {
      void result.current.pickFromFileSystem();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('resolves with the downloaded files from their own bucket', async () => {
    mockDownloadFile.mockResolvedValue(
      new Response('# Notes', { headers: { 'content-type': 'text/markdown' } }),
    );
    const { result } = renderHook(() => useSkillFileSystemPicker('my-bucket'));

    let pick!: ReturnType<typeof result.current.pickFromFileSystem>;
    act(() => {
      pick = result.current.pickFromFileSystem();
    });
    act(() => result.current.handleAttach(attach([dialFile()])));
    const entries = await pick;

    expect(mockDownloadFile).toHaveBeenCalledWith(
      'other-bucket',
      'docs/notes.md',
    );
    expect(result.current.isOpen).toBe(false);
    expect(entries?.map((entry) => entry.path)).toEqual(['notes.md']);
    expect(entries?.[0].file.type).toBe('text/markdown');
    expect(await entries?.[0].file.text()).toBe('# Notes');
  });

  it('ignores picked folders', async () => {
    const { result } = renderHook(() => useSkillFileSystemPicker('my-bucket'));

    let pick!: ReturnType<typeof result.current.pickFromFileSystem>;
    act(() => {
      pick = result.current.pickFromFileSystem();
    });
    act(() =>
      result.current.handleAttach(
        attach([dialFile({ nodeType: DialFileNodeType.FOLDER })]),
      ),
    );

    expect(await pick).toEqual([]);
    expect(mockDownloadFile).not.toHaveBeenCalled();
  });

  it('resolves as cancelled when the modal closes', async () => {
    const { result } = renderHook(() => useSkillFileSystemPicker('my-bucket'));

    let pick!: ReturnType<typeof result.current.pickFromFileSystem>;
    act(() => {
      pick = result.current.pickFromFileSystem();
    });
    act(() => result.current.handleClose());

    expect(await pick).toBeUndefined();
    expect(result.current.isOpen).toBe(false);
  });

  it('notifies and resolves as cancelled when a download fails', async () => {
    mockDownloadFile.mockResolvedValue(new Response(null, { status: 500 }));
    const { result } = renderHook(() => useSkillFileSystemPicker('my-bucket'));

    let pick!: ReturnType<typeof result.current.pickFromFileSystem>;
    act(() => {
      pick = result.current.pickFromFileSystem();
    });
    act(() => result.current.handleAttach(attach([dialFile()])));

    expect(await pick).toBeUndefined();
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: NotificationVariant.Error,
        message: SkillEditorI18nKeys.FileSystemDownloadError,
      }),
    );
  });

  it('resolves a pending pick as cancelled on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useSkillFileSystemPicker('my-bucket'),
    );

    let pick!: ReturnType<typeof result.current.pickFromFileSystem>;
    act(() => {
      pick = result.current.pickFromFileSystem();
    });
    unmount();

    expect(await pick).toBeUndefined();
  });
});
