import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from '@testing-library/react';

import { AppAction } from '@/src/types/store';

import { FilesActions } from '@/src/store/actions';

import { useFileManager } from '@/src/components/FileManager/hooks/useFileManager';

import { DialFileManagerTabs } from '@epam/ai-dial-ui-kit';

vi.mock('next/router', () => ({
  useRouter: () => ({ locale: 'en' }),
}));

vi.mock('next-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      getResourceBundle: () => ({}),
      addResourceBundle: vi.fn(),
    },
  }),
  i18n: {
    t: (key: string) => key,
    getResourceBundle: () => ({}),
    addResourceBundle: vi.fn(),
  },
}));

const dispatchMock = vi.fn();

vi.mock('@/src/store/hooks', () => ({
  useAppDispatch: () => dispatchMock,
  useAppSelector: (selector: (state: unknown) => unknown) => selector({}),
}));

vi.mock('@/src/store/files/files.selectors', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/src/store/files/files.selectors')>();
  return {
    ...actual,
    FilesSelectors: {
      ...actual.FilesSelectors,
      selectLoadingFileMetadata: vi.fn().mockReturnValue(false),
      selectAreFilesLoading: vi.fn().mockReturnValue(false),
      selectAreFoldersLoading: vi.fn().mockReturnValue(false),
      selectIsAnyFileOperationInProgress: vi.fn().mockReturnValue(false),
      selectIsCopyingFiles: vi.fn().mockReturnValue(false),
      selectIsMovingFiles: vi.fn().mockReturnValue(false),
      selectIsDeletingFiles: vi.fn().mockReturnValue(false),
      selectFileMetadata: vi.fn().mockReturnValue(null),
      selectFiles: vi.fn().mockReturnValue([]),
      selectFolders: vi.fn().mockReturnValue([
        {
          id: 'files/bucket/root',
          name: 'Root Folder',
          folderId: '',
        },
      ]),
      selectSharedWithMeFilesAndFoldersIds: vi.fn().mockReturnValue([]),
      selectIsUploadingFiles: vi.fn().mockReturnValue(false),
      selectIsLoadingSearchListing: vi.fn().mockReturnValue(false),
      selectSearchResultsForFolder: vi
        .fn()
        .mockReturnValue({ files: [], folders: [] }),
    },
  };
});

const parentFolderId = 'files/bucket/root';

const wasCreateNewFolderDispatched = () =>
  dispatchMock.mock.calls.some(
    ([action]: [AppAction]) =>
      action.type === FilesActions.createNewFolder.type,
  );

describe('useFileManager — handleCreateFolder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderUseFileManager = () =>
    renderHook(() =>
      useFileManager({
        initialTab: DialFileManagerTabs.MyFiles,
        availableTabs: new Set([DialFileManagerTabs.MyFiles]),
      }),
    );

  it('does not create a folder when the name fails validation', () => {
    const { result } = renderUseFileManager();

    result.current.handleCreateFolder(
      { name: '/invalid', fileContent: new File([], '/invalid') },
      `${parentFolderId}/invalid`,
      'file-invalid',
    );

    expect(wasCreateNewFolderDispatched()).toBe(false);
  });

  it('creates a folder when the name passes validation', () => {
    const { result } = renderUseFileManager();

    result.current.handleCreateFolder(
      { name: 'Valid Folder', fileContent: new File([], 'Valid Folder') },
      `${parentFolderId}/Valid Folder`,
      'file-valid',
    );

    expect(wasCreateNewFolderDispatched()).toBe(true);
  });
});
