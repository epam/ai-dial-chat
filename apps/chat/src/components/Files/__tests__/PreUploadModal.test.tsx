import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { Provider } from 'react-redux';

import { configureStore } from '@reduxjs/toolkit';

import { ReplaceOptions } from '@/src/types/common';

import { FilesActions } from '@/src/store/actions';
import { filesSlice } from '@/src/store/files/files.reducers';

import { PreUploadDialog } from '@/src/components/Files/PreUploadModal';

const folderId = 'files/test-bucket/uploads';
const folderPath = 'uploads';

const detectUploadFileConflictsMock = vi.fn();
const applyUploadReplaceActionsMock = vi.fn();

vi.mock('@/src/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/src/utils/app/prepare-files-for-upload', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/src/utils/app/prepare-files-for-upload')
    >();

  return {
    ...actual,
    detectUploadFileConflicts: (...args: unknown[]) =>
      detectUploadFileConflictsMock(...args),
    applyUploadReplaceActions: (...args: unknown[]) =>
      applyUploadReplaceActionsMock(...args),
  };
});

vi.mock(
  '@/src/components/Common/ReplaceConfirmationModal/ReplaceConfirmationModal',
  () => ({
    ReplaceConfirmationModal: ({
      onConfirm,
      onCancel,
    }: {
      onConfirm: (mappedActions: Record<string, ReplaceOptions>) => void;
      onCancel: () => void;
    }) => (
      <div data-qa="replace-confirmation-modal">
        <button
          type="button"
          data-qa="continue-upload"
          onClick={() =>
            onConfirm({
              [`${folderId}/sun.jpg`]: ReplaceOptions.Postfix,
            })
          }
        >
          Continue
        </button>
        <button type="button" data-qa="cancel-upload" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ),
  }),
);

vi.mock('@/src/components/Files/SelectFolderModal', () => ({
  SelectFolderModal: () => null,
}));

const createStore = () =>
  configureStore({
    reducer: {
      files: filesSlice.reducer,
    },
    preloadedState: {
      files: {
        ...filesSlice.getInitialState(),
        files: [
          {
            id: `${folderId}/sun.jpg`,
            name: 'sun.jpg',
            folderId,
          },
        ],
      },
    },
  });

describe('PreUploadDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderDialog = (onUploadFiles = vi.fn(), onClose = vi.fn()) => {
    const store = createStore();
    const showUploadReplaceDialogSpy = vi.spyOn(
      FilesActions,
      'showUploadReplaceDialog',
    );

    render(
      <Provider store={store}>
        <PreUploadDialog
          isOpen
          allowedTypes={['*/*']}
          maximumAttachmentsAmount={10}
          uploadFolderId={folderId}
          onUploadFiles={onUploadFiles}
          onClose={onClose}
        />
      </Provider>,
    );

    return { onUploadFiles, onClose, showUploadReplaceDialogSpy };
  };

  const selectFile = (fileName = 'sun.jpg') => {
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['content'], fileName, { type: 'image/jpeg' });

    fireEvent.change(input, { target: { files: [file] } });
  };

  it('routes duplicate device uploads through onUploadFiles instead of the global replace dialog', async () => {
    const file = new File(['content'], 'sun.jpg', { type: 'image/jpeg' });
    const duplicatedFile = {
      id: `${folderId}/sun.jpg`,
      name: 'sun.jpg',
      folderId,
      fileContent: file,
    };
    const resolvedFile = {
      id: `${folderId}/sun (1).jpg`,
      name: 'sun (1).jpg',
      fileContent: file,
    };

    detectUploadFileConflictsMock.mockReturnValue({
      duplicatedFiles: [duplicatedFile],
      nonDuplicatedFiles: [],
      errorMsg: '',
    });
    applyUploadReplaceActionsMock.mockReturnValue([resolvedFile]);

    const { onUploadFiles, onClose, showUploadReplaceDialogSpy } =
      renderDialog();

    selectFile();
    fireEvent.click(screen.getByTestId('upload'));

    expect(
      await screen.findByTestId('replace-confirmation-modal'),
    ).toBeInTheDocument();
    expect(showUploadReplaceDialogSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('continue-upload'));

    await waitFor(() => {
      expect(applyUploadReplaceActionsMock).toHaveBeenCalled();
      expect(onUploadFiles).toHaveBeenCalledWith([resolvedFile], folderPath);
      expect(onClose).toHaveBeenCalledWith(true);
    });
  });

  it('dismisses the local replace modal on cancel without uploading', async () => {
    const file = new File(['content'], 'sun.jpg', { type: 'image/jpeg' });

    detectUploadFileConflictsMock.mockReturnValue({
      duplicatedFiles: [
        {
          id: `${folderId}/sun.jpg`,
          name: 'sun.jpg',
          folderId,
          fileContent: file,
        },
      ],
      nonDuplicatedFiles: [],
      errorMsg: '',
    });

    const { onUploadFiles, onClose } = renderDialog();

    selectFile();
    fireEvent.click(screen.getByTestId('upload'));

    expect(
      await screen.findByTestId('replace-confirmation-modal'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cancel-upload'));

    await waitFor(() => {
      expect(
        screen.queryByTestId('replace-confirmation-modal'),
      ).not.toBeInTheDocument();
    });

    expect(onUploadFiles).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
