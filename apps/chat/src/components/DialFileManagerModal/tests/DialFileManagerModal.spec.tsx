import { DialFileNodeType } from '@epam/ai-dial-ui-kit';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as useDialFileManagerModule from '../../../hooks/files/useDialFileManager';
import type { UseDialFileManagerResult } from '../../../hooks/files/useDialFileManager';
import DialFileManagerModal from '../DialFileManagerModal';

vi.mock('../../../hooks/files/useDialFileManager');
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({ showNotification: vi.fn() }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (
        key === 'dialFileManager.unsupportedFileTypeTooltip' &&
        params?.allowedExtensions != null
      ) {
        return `Unsupported file type. Supported types: ${params.allowedExtensions}.`;
      }

      return key;
    },
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}));
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    DialFileManager: ({
      className,
      gridClassName,
      gridOptions,
      uploadEnabled,
      toolbarOptions,
      bulkActionsToolbarOptions,
      filesLoading,
      allowedFileTypes,
      maxSelectableFileSize,
      unsupportedFileTypeTooltip,
      selectedPaths,
      onSelectedPathsChange,
    }: {
      className?: string;
      gridClassName?: string;
      gridOptions?: {
        additionalGridOptions?: { domLayout?: string };
      };
      uploadEnabled?: boolean;
      toolbarOptions?: {
        showHiddenFilesToggle?: boolean;
        hiddenFilesSwitcherLabel?: string;
        showHiddenFilesLabel?: string;
        hideHiddenFilesLabel?: string;
        isNewButtonDisabled?: boolean;
        disabledNewButtonTooltip?: string;
      };
      bulkActionsToolbarOptions?: {
        getSelectionLabel: (count: number) => string;
      };
      filesLoading?: boolean;
      allowedFileTypes?: string[];
      maxSelectableFileSize?: number;
      unsupportedFileTypeTooltip?: string;
      selectedPaths?: Set<string>;
      onSelectedPathsChange?: (paths: Set<string>) => void;
    }) => (
      <div
        className={className}
        role="region"
        aria-label="file manager"
        data-grid-class={gridClassName}
        data-grid-layout={gridOptions?.additionalGridOptions?.domLayout}
        data-loading={filesLoading}
        data-allowed-file-types={allowedFileTypes?.join(',')}
        data-max-selectable-file-size={maxSelectableFileSize}
        data-unsupported-file-type-tooltip={unsupportedFileTypeTooltip}
        data-upload-enabled={uploadEnabled}
        data-new-button-disabled={toolbarOptions?.isNewButtonDisabled}
        data-new-button-tooltip={toolbarOptions?.disabledNewButtonTooltip}
        data-show-hidden-files-toggle={toolbarOptions?.showHiddenFilesToggle}
        data-hidden-files-label={toolbarOptions?.hiddenFilesSwitcherLabel}
        data-show-hidden-files-label={toolbarOptions?.showHiddenFilesLabel}
        data-hide-hidden-files-label={toolbarOptions?.hideHiddenFilesLabel}
      >
        {selectedPaths?.size ? (
          <>
            <span>
              {bulkActionsToolbarOptions?.getSelectionLabel(selectedPaths.size)}
            </span>
            <button
              type="button"
              onClick={() => onSelectedPathsChange?.(new Set())}
            >
              Clear selection
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() =>
            onSelectedPathsChange?.(new Set(['/All files/report.pdf']))
          }
        >
          Select report
        </button>
      </div>
    ),
  };
});

const mockUseDialFileManager = vi.mocked(
  useDialFileManagerModule.useDialFileManager,
);

const defaultHookResult: UseDialFileManagerResult = {
  items: [
    {
      id: 'bucket-root',
      name: 'All files',
      path: '/All files',
      parentPath: '',
      nodeType: DialFileNodeType.FOLDER,
      folderId: 'test-bucket',
      items: [
        {
          id: 'report.pdf',
          name: 'report.pdf',
          path: '/All files/report.pdf',
          parentPath: '/All files',
          nodeType: DialFileNodeType.ITEM,
          folderId: 'test-bucket',
          contentType: 'application/pdf',
        },
      ],
    },
  ],
  isLoading: false,
  error: null,
  path: '/All files',
  onPathChange: vi.fn(),
  retry: vi.fn(),
  onUploadFiles: vi.fn(),
  onValidateUpload: vi.fn(),
  uploadBatchState: null,
  cancelUpload: vi.fn(),
  clearUploadBatch: vi.fn(),
  onCreateFolder: vi.fn(),
  onCreateFolderValidate: vi.fn(),
  isCreatingFolder: false,
  onDownloadFiles: vi.fn(),
  isDownloading: false,
  downloadError: null,
  clearDownloadError: vi.fn(),
  onDeleteFiles: vi.fn(),
  isDeleting: false,
  deleteError: null,
  clearDeleteError: vi.fn(),
  uploadEnabled: true,
  isNewButtonDisabled: false,
  disabledNewButtonTooltip: 'No permission',
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onAttach: vi.fn(),
  bucket: 'test-bucket',
  title: 'DIAL file system',
  attachLabel: 'Attach',
  emptyTitle: 'This folder is empty',
  emptyDescription: '',
  errorMessage: 'Failed to load files',
  retryLabel: 'Retry',
  hiddenFilesLabel: 'Hidden files',
  showHiddenFilesLabel: 'Show hidden files',
  hideHiddenFilesLabel: 'Hide hidden files',
  getSelectionLabel: (count: number) =>
    `${count} ${count === 1 ? 'item' : 'items'} selected`,
  uploadFilesLabel: 'Upload files',
  newFolderLabel: 'New folder',
  downloadLabel: 'Download',
  downloadingLabel: 'Preparing download…',
  deleteLabel: 'Delete',
  deletingLabel: 'Deleting…',
  deleteConfirmTitle: (names: string[]) =>
    names.length === 1 ? 'Confirm deleting' : 'Confirm deleting items',
  deleteConfirmBody: (names: string[]) =>
    `Delete ${names.length} ${names.length === 1 ? 'item' : 'items'}?`,
  deleteConfirmLabel: 'Delete',
  deleteCancelLabel: 'Cancel',
  uploadProgressTitle: 'Uploading files',
  cancelLabel: 'Cancel',
};

describe('DialFileManagerModal', () => {
  it('renders with the given title when isOpen is true', () => {
    mockUseDialFileManager.mockReturnValue(defaultHookResult);
    render(<DialFileManagerModal {...defaultProps} />);
    expect(screen.getByText('DIAL file system')).toBeTruthy();
  });

  it('renders error card with role="alert" when error is set', () => {
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      error: 'dialFileManager.error',
    });
    render(<DialFileManagerModal {...defaultProps} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Failed to load files')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('calls retry when the retry button is clicked', () => {
    const retry = vi.fn();
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      error: 'dialFileManager.error',
      retry,
    });
    render(<DialFileManagerModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('renders DialFileManager when error is null', () => {
    mockUseDialFileManager.mockReturnValue(defaultHookResult);
    render(<DialFileManagerModal {...defaultProps} />);
    const fileManager = screen.getByRole('region', { name: 'file manager' });
    expect(fileManager.classList.contains('grow')).toBe(true);
    expect(fileManager.classList.contains('bg-layer-2')).toBe(true);
    expect(fileManager.getAttribute('data-grid-class')).toBe('size-full');
    expect(fileManager.getAttribute('data-grid-layout')).toBe('normal');
    expect(fileManager.getAttribute('data-show-hidden-files-toggle')).toBe(
      'true',
    );
    expect(fileManager.getAttribute('data-hidden-files-label')).toBe(
      'Hidden files',
    );
    expect(fileManager.getAttribute('data-show-hidden-files-label')).toBe(
      'Show hidden files',
    );
    expect(fileManager.getAttribute('data-hide-hidden-files-label')).toBe(
      'Hide hidden files',
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps a fixed modal height and pads the footer', () => {
    mockUseDialFileManager.mockReturnValue(defaultHookResult);
    render(<DialFileManagerModal {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog.classList.contains('!h-[min(800px,100dvh)]')).toBe(true);
    expect(dialog.classList.contains('!bg-layer-2')).toBe(true);
    expect(
      dialog.classList.contains("[&>[aria-label='popup-description']]:min-h-0"),
    ).toBe(true);

    const footer = screen.getByRole('button', { name: 'Attach' }).parentElement;
    expect(footer?.classList.contains('px-6')).toBe(true);
    expect(footer?.classList.contains('py-4')).toBe(true);
  });

  it('attaches selected files', () => {
    const onAttach = vi.fn();
    mockUseDialFileManager.mockReturnValue(defaultHookResult);
    render(<DialFileManagerModal {...defaultProps} onAttach={onAttach} />);

    expect(
      screen.getByRole('button', { name: 'Attach' }).hasAttribute('disabled'),
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Select report' }));
    fireEvent.click(screen.getByRole('button', { name: 'Attach' }));

    expect(onAttach).toHaveBeenCalledWith({
      files: [expect.objectContaining({ name: 'report.pdf' })],
      folderPaths: [],
    });
  });

  it('shows the selection count and clears the selection', () => {
    mockUseDialFileManager.mockReturnValue(defaultHookResult);
    render(<DialFileManagerModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select report' }));

    expect(screen.getByText('1 item selected')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Attach' }).hasAttribute('disabled'),
    ).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));

    expect(screen.queryByText('1 item selected')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Attach' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('does not render content when isOpen is false', () => {
    mockUseDialFileManager.mockReturnValue(defaultHookResult);
    render(<DialFileManagerModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('DIAL file system')).toBeNull();
  });

  it('shows a loader while an archive is being prepared', () => {
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      isDownloading: true,
    });

    render(<DialFileManagerModal {...defaultProps} />);

    expect(
      screen.getByRole('img', { name: 'Preparing download…' }),
    ).toBeTruthy();
    expect(screen.queryByText('Preparing download…')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Attach' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('shows and dismisses a download error', () => {
    const clearDownloadError = vi.fn();
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      downloadError: 'Download failed',
      clearDownloadError,
    });

    render(<DialFileManagerModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('alert'));
    expect(clearDownloadError).toHaveBeenCalledOnce();
  });

  it('disables upload and new folder when the hook reports no WRITE permission', () => {
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      uploadEnabled: false,
      isNewButtonDisabled: true,
      disabledNewButtonTooltip:
        "You don't have permission to create items in this folder",
    });

    render(<DialFileManagerModal {...defaultProps} />);

    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-upload-enabled')).toBe('false');
    expect(manager.getAttribute('data-new-button-disabled')).toBe('true');
    expect(manager.getAttribute('data-new-button-tooltip')).toBe(
      "You don't have permission to create items in this folder",
    );
  });

  it('passes unsupported attachment constraints to the file manager', () => {
    mockUseDialFileManager.mockReturnValue(defaultHookResult);

    render(
      <DialFileManagerModal
        {...defaultProps}
        allowedTypes={['application/pdf']}
        maxSelectableFileSize={1024}
      />,
    );

    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-allowed-file-types')).toBe(
      'application/pdf',
    );
    expect(manager.getAttribute('data-max-selectable-file-size')).toBe('1024');
    expect(manager.getAttribute('data-unsupported-file-type-tooltip')).toBe(
      'Unsupported file type. Supported types: .pdf.',
    );
  });
});
