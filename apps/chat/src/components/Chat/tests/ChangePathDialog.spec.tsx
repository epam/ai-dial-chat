import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppAction } from '@/src/types/store';

import { FilesActions } from '@/src/store/actions';

import { ChangePathDialog } from '@/src/components/Chat/ChangePathDialog';

import { DialFileNodeType } from '@epam/ai-dial-ui-kit';

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

vi.mock('@/src/store/selectors', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/src/store/selectors')>();
  return {
    ...actual,
    FilesSelectors: {
      ...actual.FilesSelectors,
      selectFolders: vi.fn().mockReturnValue([]),
      selectLastRenamedParentFolder: vi.fn().mockReturnValue(null),
      selectPublicFolders: vi.fn().mockReturnValue([]),
    },
    ConversationsSelectors: {
      ...actual.ConversationsSelectors,
      selectPublicFolders: vi.fn().mockReturnValue([]),
    },
    PromptsSelectors: {
      ...actual.PromptsSelectors,
      selectPublicFolders: vi.fn().mockReturnValue([]),
    },
    ApplicationSelectors: {
      ...actual.ApplicationSelectors,
      selectPublicFolders: vi.fn().mockReturnValue([]),
    },
    ToolsetSelectors: {
      ...actual.ToolsetSelectors,
      selectPublicFolders: vi.fn().mockReturnValue([]),
    },
  };
});

const handleRenameValidationMock = vi.fn();
const isMaxFolderDepthReachedMock = vi.fn().mockReturnValue(false);

vi.mock('@/src/components/FileManager/hooks/useFileManager', () => ({
  useFileManager: () => ({
    currentPath: 'files/bucket/root',
    setCurrentPath: vi.fn(),
    areFoldersLoading: false,
    fileTreeItems: [],
    rootFolder: {
      id: 'files/bucket/root',
      path: 'files/bucket/root',
      name: 'Root',
      folderId: 'files/bucket/root',
      nodeType: DialFileNodeType.FOLDER,
      items: [],
      permissions: [],
    },
    treeOptions: { actionLabels: {}, loadedPaths: new Set() },
    gridOptions: {},
    navigationPanelOptions: {},
    handleRenameValidation: handleRenameValidationMock,
    isMaxFolderDepthReached: isMaxFolderDepthReachedMock,
    showMaxDepthError: vi.fn(),
    resetGridEditing: vi.fn(),
    emptyStateTitle: '',
    emptyStateDescription: '',
    deleteConfirmationOptions: {},
  }),
}));

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    DialDestinationFolderPopup: (props: any) => (
      <div>
        <button
          type="button"
          onClick={() =>
            props.onCreateFolder(
              { name: 'in/valid', fileContent: new File([], 'in/valid') },
              'files/bucket/root/in/valid',
              'file-invalid',
            )
          }
        >
          create-invalid
        </button>
        <button
          type="button"
          onClick={() =>
            props.onCreateFolder(
              {
                name: 'Valid Folder',
                fileContent: new File([], 'Valid Folder'),
              },
              'files/bucket/root/Valid Folder',
              'file-valid',
            )
          }
        >
          create-valid
        </button>
      </div>
    ),
  };
});

const wasAddFoldersDispatched = () =>
  dispatchMock.mock.calls.some(
    ([action]: [AppAction]) => action.type === FilesActions.addFolders.type,
  );

describe('ChangePathDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMaxFolderDepthReachedMock.mockReturnValue(false);
  });

  const renderDialog = () =>
    render(
      <ChangePathDialog isOpen onClose={vi.fn()} onRenamePath={vi.fn()} />,
    );

  it('does not create a folder when the name fails validation', async () => {
    handleRenameValidationMock.mockReturnValue('Invalid folder name');

    renderDialog();

    await userEvent.click(
      screen.getByRole('button', { name: 'create-invalid' }),
    );

    expect(handleRenameValidationMock).toHaveBeenCalledWith(
      'in/valid',
      expect.objectContaining({ nodeType: DialFileNodeType.FOLDER }),
    );
    expect(wasAddFoldersDispatched()).toBe(false);
  });

  it('creates a folder when the name passes validation', async () => {
    handleRenameValidationMock.mockReturnValue(null);

    renderDialog();

    await userEvent.click(
      screen.getByRole('button', { name: 'create-valid' }),
    );

    expect(wasAddFoldersDispatched()).toBe(true);
  });
});
