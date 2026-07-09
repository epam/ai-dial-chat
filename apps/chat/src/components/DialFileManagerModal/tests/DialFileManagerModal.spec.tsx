import {
  DialFileManagerActions,
  DialFileManagerTabs,
  DialFileNodeType,
  FileManagerColumnKey,
} from '@epam/ai-dial-ui-kit';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as useDialFileManagerModule from '../../../hooks/files/useDialFileManager';
import type { UseDialFileManagerResult } from '../../../hooks/files/useDialFileManager';
import { DialFileManagerVariant } from '../../../types/file-manager-variant';
import DialFileManagerModal from '../DialFileManagerModal';

vi.mock('../../../hooks/files/useDialFileManager');

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({ showNotification: mockShowNotification }),
}));

const { mockActiveTab, mockHandleTabChange } = vi.hoisted(() => ({
  mockActiveTab: { value: undefined as string | undefined },
  mockHandleTabChange: vi.fn(),
}));

const { mockShowNotification } = vi.hoisted(() => ({
  mockShowNotification: vi.fn(),
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
  const { DialFileManagerTabs: Tabs, DialFileManagerActions: Actions } = actual;
  return {
    ...actual,
    useDialFileManagerTabs: vi.fn().mockImplementation(() => ({
      activeTab: mockActiveTab.value ?? Tabs.MyFiles,
      handleTabChange: mockHandleTabChange,
      tabs: [
        { id: Tabs.MyFiles, name: 'My files' },
        { id: Tabs.Shared, name: 'Shared with me' },
        { id: Tabs.Organization, name: 'Organization' },
      ],
    })),
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
      sharedWithMeIds,
      conflictResolutionPopupOptions,
      emptyStateTitle,
      emptyStateDescription,
      autoSelectUploadedItems,
    }: {
      className?: string;
      gridClassName?: string;
      gridOptions?: {
        additionalGridOptions?: {
          domLayout?: string;
          rowSelection?: {
            isRowSelectable?: (node: {
              data?: { nodeType?: string; path?: string } | null;
            }) => boolean;
          };
        };
        actionLabels?: Partial<Record<DialFileManagerActions, string>>;
        visibleColumns?: FileManagerColumnKey[];
      };
      uploadEnabled?: boolean;
      toolbarOptions?: {
        tabs?: Array<{ id: string; name: string }>;
        activeTab?: string;
        onTabChange?: (id: DialFileManagerTabs) => void;
        showHiddenFilesToggle?: boolean;
        hiddenFilesSwitcherLabel?: string;
        showHiddenFilesLabel?: string;
        hideHiddenFilesLabel?: string;
        isNewButtonDisabled?: boolean;
        disabledNewButtonTooltip?: string;
      };
      bulkActionsToolbarOptions?: {
        getSelectionLabel: (count: number) => string;
        actionLabels?: Partial<Record<DialFileManagerActions, string>>;
      };
      filesLoading?: boolean;
      allowedFileTypes?: string[];
      maxSelectableFileSize?: number;
      unsupportedFileTypeTooltip?: string;
      selectedPaths?: Set<string>;
      onSelectedPathsChange?: (paths: Set<string>) => void;
      sharedWithMeIds?: string[];
      conflictResolutionPopupOptions?: {
        singleFileTitle?: string;
        multipleFilesTitle?: string;
        actionLabels?: {
          replace?: string;
          duplicate?: string;
          cancel?: string;
        };
        strategyLabels?: {
          replaceAll?: string;
          duplicateAll?: string;
          decideForEach?: string;
        };
        confirmLabel?: string;
        cancelLabel?: string;
      };
      emptyStateTitle?: string;
      emptyStateDescription?: string;
      autoSelectUploadedItems?: boolean;
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
        data-active-tab={toolbarOptions?.activeTab}
        data-tab-count={toolbarOptions?.tabs?.length}
        data-has-delete={String(
          Actions.Delete in (gridOptions?.actionLabels ?? {}),
        )}
        data-has-bulk-delete={String(
          Actions.Delete in (bulkActionsToolbarOptions?.actionLabels ?? {}),
        )}
        data-has-copy={String(
          Actions.Copy in (gridOptions?.actionLabels ?? {}),
        )}
        data-has-move={String(
          Actions.Move in (gridOptions?.actionLabels ?? {}),
        )}
        data-has-duplicate={String(
          Actions.Duplicate in (gridOptions?.actionLabels ?? {}),
        )}
        data-has-bulk-copy={String(
          Actions.Copy in (bulkActionsToolbarOptions?.actionLabels ?? {}),
        )}
        data-has-bulk-move={String(
          Actions.Move in (bulkActionsToolbarOptions?.actionLabels ?? {}),
        )}
        data-has-bulk-duplicate={String(
          Actions.Duplicate in (bulkActionsToolbarOptions?.actionLabels ?? {}),
        )}
        data-visible-columns={gridOptions?.visibleColumns?.join(',')}
        data-shared-with-me-ids={
          sharedWithMeIds != null ? sharedWithMeIds.join(',') : 'none'
        }
        data-conflict-single-title={
          conflictResolutionPopupOptions?.singleFileTitle
        }
        data-conflict-multiple-title={
          conflictResolutionPopupOptions?.multipleFilesTitle
        }
        data-conflict-replace={
          conflictResolutionPopupOptions?.actionLabels?.replace
        }
        data-conflict-duplicate={
          conflictResolutionPopupOptions?.actionLabels?.duplicate
        }
        data-conflict-replace-all={
          conflictResolutionPopupOptions?.strategyLabels?.replaceAll
        }
        data-conflict-confirm-label={
          conflictResolutionPopupOptions?.confirmLabel
        }
        data-empty-state-title={emptyStateTitle}
        data-empty-state-description={emptyStateDescription}
        data-auto-select-uploaded-items={String(
          autoSelectUploadedItems ?? true,
        )}
      >
        {toolbarOptions?.tabs?.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() =>
              toolbarOptions.onTabChange?.(tab.id as DialFileManagerTabs)
            }
          >
            {tab.name}
          </button>
        ))}
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
            onSelectedPathsChange?.(new Set(['/My files/report.pdf']))
          }
        >
          Select report
        </button>
        <button
          type="button"
          data-folder-selectable={String(
            gridOptions?.additionalGridOptions?.rowSelection?.isRowSelectable?.(
              {
                data: {
                  nodeType: DialFileNodeType.FOLDER,
                  path: '/My files/docs/',
                },
              },
            ) ?? false,
          )}
          onClick={() => onSelectedPathsChange?.(new Set(['/My files/docs/']))}
        >
          Select docs folder
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
      name: 'My files',
      path: '/My files',
      parentPath: '',
      nodeType: DialFileNodeType.FOLDER,
      folderId: 'test-bucket',
      items: [
        {
          id: 'report.pdf',
          name: 'report.pdf',
          path: '/My files/report.pdf',
          parentPath: '/My files',
          nodeType: DialFileNodeType.ITEM,
          folderId: 'test-bucket',
          contentType: 'application/pdf',
        },
        {
          id: 'docs/',
          name: 'docs',
          path: '/My files/docs/',
          parentPath: '/My files',
          nodeType: DialFileNodeType.FOLDER,
          folderId: 'test-bucket',
        },
      ],
    },
  ],
  isLoading: false,
  error: null,
  path: '/My files',
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
  onDeleteFiles: vi.fn(),
  isDeleting: false,
  onRenameValidate: vi.fn(),
  onMoveToFiles: vi.fn(),
  isRenaming: false,
  onCopyFiles: vi.fn(),
  isCopying: false,
  isMoving: false,
  cancelCopyMove: vi.fn(),
  onSearchFiles: vi.fn(),
  isSearching: false,
  searchResults: null,
  clearSearchResults: vi.fn(),
  expandedPaths: new Set<string>(),
  loadedPaths: new Set<string>(),
  onExpandedPathsChange: vi.fn(),
  uploadEnabled: true,
  isNewButtonDisabled: false,
  disabledNewButtonTooltip: 'No permission',
  visibleColumns: [
    FileManagerColumnKey.Name,
    FileManagerColumnKey.UpdatedAt,
    FileManagerColumnKey.Size,
    FileManagerColumnKey.Actions,
  ],
  dateLocale: 'en',
  dateOptions: { year: 'numeric', month: 'short', day: '2-digit' },
  actionLabels: {
    [DialFileManagerActions.Download]: 'Download',
    [DialFileManagerActions.Delete]: 'Delete',
  },
  sharedWithMeIds: undefined,
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

beforeEach(() => {
  mockActiveTab.value = undefined;
  mockHandleTabChange.mockClear();
  mockShowNotification.mockClear();
  mockUseDialFileManager.mockClear();
  mockUseDialFileManager.mockReturnValue(defaultHookResult);
});

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

  it('passes conflictResolutionPopupOptions to DialFileManager', () => {
    mockUseDialFileManager.mockReturnValue(defaultHookResult);
    render(<DialFileManagerModal {...defaultProps} />);

    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-conflict-single-title')).toBe(
      'dialFileManager.conflictSingleTitle',
    );
    expect(manager.getAttribute('data-conflict-multiple-title')).toBe(
      'dialFileManager.conflictMultipleTitle',
    );
    expect(manager.getAttribute('data-conflict-replace')).toBe(
      'dialFileManager.conflictReplace',
    );
    expect(manager.getAttribute('data-conflict-duplicate')).toBe(
      'dialFileManager.conflictDuplicate',
    );
    expect(manager.getAttribute('data-conflict-replace-all')).toBe(
      'dialFileManager.conflictReplaceAll',
    );
    expect(manager.getAttribute('data-conflict-confirm-label')).toBe(
      'buttons.confirm',
    );
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

  it('attaches selected folder as DIAL Core path when canAttachFolders is true', () => {
    const onAttach = vi.fn();
    mockUseDialFileManager.mockReturnValue(defaultHookResult);
    render(
      <DialFileManagerModal
        {...defaultProps}
        onAttach={onAttach}
        canAttachFolders
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select docs folder' }));
    fireEvent.click(screen.getByRole('button', { name: 'Attach' }));

    expect(onAttach).toHaveBeenCalledWith({
      files: [],
      folderPaths: ['files/test-bucket/docs/'],
    });
  });

  it('skips selected folder when DIAL Core source path is missing', () => {
    const onAttach = vi.fn();
    const root = defaultHookResult.items[0];
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      items: [
        {
          ...root,
          items: root.items?.map((item) =>
            item.nodeType === DialFileNodeType.FOLDER
              ? { ...item, id: '', url: undefined }
              : item,
          ),
        },
      ],
    });
    render(
      <DialFileManagerModal
        {...defaultProps}
        onAttach={onAttach}
        canAttachFolders
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select docs folder' }));
    fireEvent.click(screen.getByRole('button', { name: 'Attach' }));

    expect(onAttach).toHaveBeenCalledWith({
      files: [],
      folderPaths: [],
    });
  });

  it('marks folder rows as selectable when canAttachFolders is true', () => {
    mockUseDialFileManager.mockReturnValue(defaultHookResult);
    render(<DialFileManagerModal {...defaultProps} canAttachFolders />);

    expect(
      screen.getByRole('button', { name: 'Select docs folder' }).dataset
        .folderSelectable,
    ).toBe('true');
  });

  it('marks folder rows as not selectable when canAttachFolders is false (default)', () => {
    mockUseDialFileManager.mockReturnValue(defaultHookResult);
    render(<DialFileManagerModal {...defaultProps} />);

    expect(
      screen.getByRole('button', { name: 'Select docs folder' }).dataset
        .folderSelectable,
    ).toBe('false');
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

  it('passes global notification handler to the file manager hook', () => {
    render(<DialFileManagerModal {...defaultProps} />);

    expect(mockUseDialFileManager).toHaveBeenCalledWith(
      expect.objectContaining({ onNotification: mockShowNotification }),
    );
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

describe('DialFileManagerModal — tab navigation', () => {
  it('renders three tabs in the toolbar', () => {
    mockUseDialFileManager.mockReturnValue(defaultHookResult);
    render(<DialFileManagerModal {...defaultProps} />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-tab-count')).toBe('3');
    expect(screen.getByRole('button', { name: 'My files' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Shared with me' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Organization' })).toBeTruthy();
  });

  it('passes the activeTab from useDialFileManagerTabs to toolbarOptions', () => {
    mockUseDialFileManager.mockReturnValue(defaultHookResult);
    render(<DialFileManagerModal {...defaultProps} />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-active-tab')).toBe(
      DialFileManagerTabs.MyFiles,
    );
  });

  it('passes My files as rootLabel for the My files tab', () => {
    mockActiveTab.value = DialFileManagerTabs.MyFiles;
    mockUseDialFileManager.mockReturnValue(defaultHookResult);

    render(<DialFileManagerModal {...defaultProps} />);

    expect(mockUseDialFileManager).toHaveBeenCalledWith(
      expect.objectContaining({
        activeTab: DialFileManagerTabs.MyFiles,
        rootLabel: 'dialFileManager.tab.myFiles',
      }),
    );
  });

  it('passes Shared with me as rootLabel for the Shared tab', () => {
    mockActiveTab.value = DialFileManagerTabs.Shared;
    mockUseDialFileManager.mockReturnValue(defaultHookResult);

    render(<DialFileManagerModal {...defaultProps} />);

    expect(mockUseDialFileManager).toHaveBeenCalledWith(
      expect.objectContaining({
        activeTab: DialFileManagerTabs.Shared,
        rootLabel: 'dialFileManager.tab.shared',
      }),
    );
  });

  it('passes Organization as rootLabel for the Organization tab', () => {
    mockActiveTab.value = DialFileManagerTabs.Organization;
    mockUseDialFileManager.mockReturnValue(defaultHookResult);

    render(<DialFileManagerModal {...defaultProps} />);

    expect(mockUseDialFileManager).toHaveBeenCalledWith(
      expect.objectContaining({
        activeTab: DialFileManagerTabs.Organization,
        rootLabel: 'dialFileManager.tab.organization',
      }),
    );
  });

  it('calls handleTabChange and clears selectedPaths on tab switch', () => {
    mockUseDialFileManager.mockReturnValue(defaultHookResult);
    render(<DialFileManagerModal {...defaultProps} />);

    // Select a file first
    fireEvent.click(screen.getByRole('button', { name: 'Select report' }));
    expect(screen.getByText('1 item selected')).toBeTruthy();

    // Switch tab — this should clear selectedPaths and call handleTabChange
    fireEvent.click(screen.getByRole('button', { name: 'Shared with me' }));

    expect(mockHandleTabChange).toHaveBeenCalledWith(
      DialFileManagerTabs.Shared,
    );
    // After tab switch, selection should be cleared (no "1 item selected" text)
    expect(screen.queryByText('1 item selected')).toBeNull();
  });
});

describe('DialFileManagerModal — per-tab Delete action visibility', () => {
  it('includes Delete in actionLabels on my_files tab', () => {
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      actionLabels: {
        [DialFileManagerActions.Download]: 'Download',
        [DialFileManagerActions.Delete]: 'Delete',
      },
    });
    render(<DialFileManagerModal {...defaultProps} />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-has-delete')).toBe('true');
    expect(manager.getAttribute('data-has-bulk-delete')).toBe('true');
  });

  it('omits Delete from actionLabels on shared tab', () => {
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      actionLabels: {
        [DialFileManagerActions.Download]: 'Download',
      },
    });
    render(<DialFileManagerModal {...defaultProps} />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-has-delete')).toBe('false');
    expect(manager.getAttribute('data-has-bulk-delete')).toBe('false');
  });

  it('omits Delete from actionLabels on organization tab', () => {
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      actionLabels: {
        [DialFileManagerActions.Download]: 'Download',
      },
    });
    render(<DialFileManagerModal {...defaultProps} />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-has-delete')).toBe('false');
  });
});

describe('DialFileManagerModal — Copy/Move/Duplicate excluded (Attach profile)', () => {
  it('does not surface Copy/Move/Duplicate in row/tree/bulk menus on my_files', () => {
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      actionLabels: {
        [DialFileManagerActions.Download]: 'Download',
        [DialFileManagerActions.Delete]: 'Delete',
        [DialFileManagerActions.Rename]: 'Rename',
      },
    });
    render(<DialFileManagerModal {...defaultProps} />);
    const manager = screen.getByRole('region', { name: 'file manager' });

    expect(manager.getAttribute('data-has-copy')).toBe('false');
    expect(manager.getAttribute('data-has-move')).toBe('false');
    expect(manager.getAttribute('data-has-duplicate')).toBe('false');
    expect(manager.getAttribute('data-has-bulk-copy')).toBe('false');
    expect(manager.getAttribute('data-has-bulk-move')).toBe('false');
    expect(manager.getAttribute('data-has-bulk-duplicate')).toBe('false');
    expect(manager.getAttribute('data-has-delete')).toBe('true');
  });

  it('passes variant Attach to useDialFileManager so actionProfile resolves to Attach', () => {
    render(<DialFileManagerModal {...defaultProps} />);

    expect(mockUseDialFileManager).toHaveBeenCalledWith(
      expect.objectContaining({ variant: DialFileManagerVariant.Attach }),
    );
  });
});

describe('DialFileManagerModal — per-tab uploadEnabled', () => {
  it('passes uploadEnabled=false when organization tab is active', () => {
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      uploadEnabled: false,
      isNewButtonDisabled: true,
    });
    render(<DialFileManagerModal {...defaultProps} />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-upload-enabled')).toBe('false');
    expect(manager.getAttribute('data-new-button-disabled')).toBe('true');
  });

  it('passes uploadEnabled=false when on shared root', () => {
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      uploadEnabled: false,
      isNewButtonDisabled: true,
    });
    render(<DialFileManagerModal {...defaultProps} />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-upload-enabled')).toBe('false');
  });

  it('passes uploadEnabled=true when my_files tab has WRITE permission', () => {
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      uploadEnabled: true,
      isNewButtonDisabled: false,
    });
    render(<DialFileManagerModal {...defaultProps} />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-upload-enabled')).toBe('true');
  });
});

describe('DialFileManagerModal — sharedWithMeIds', () => {
  it('passes sharedWithMeIds to DialFileManager when on Shared tab', () => {
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      sharedWithMeIds: ['shared/file1.pdf', 'shared/folder1/'],
    });
    render(<DialFileManagerModal {...defaultProps} />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-shared-with-me-ids')).toBe(
      'shared/file1.pdf,shared/folder1/',
    );
  });

  it('passes undefined sharedWithMeIds on My files tab', () => {
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      sharedWithMeIds: undefined,
    });
    render(<DialFileManagerModal {...defaultProps} />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-shared-with-me-ids')).toBe('none');
  });
});

describe('DialFileManagerModal — per-tab visibleColumns', () => {
  it('does not include Author column on my_files tab', () => {
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      visibleColumns: [
        FileManagerColumnKey.Name,
        FileManagerColumnKey.UpdatedAt,
        FileManagerColumnKey.Size,
        FileManagerColumnKey.Actions,
      ],
    });
    render(<DialFileManagerModal {...defaultProps} />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    const cols = manager.getAttribute('data-visible-columns') ?? '';
    expect(cols).not.toContain(FileManagerColumnKey.Author);
  });

  it('includes Author column on Shared tab', () => {
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      visibleColumns: [
        FileManagerColumnKey.Name,
        FileManagerColumnKey.UpdatedAt,
        FileManagerColumnKey.Size,
        FileManagerColumnKey.Author,
        FileManagerColumnKey.Actions,
      ],
    });
    render(<DialFileManagerModal {...defaultProps} />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    const cols = manager.getAttribute('data-visible-columns') ?? '';
    expect(cols).toContain(FileManagerColumnKey.Author);
  });
});

describe('DialFileManagerModal — autoSelectUploadedItems', () => {
  it('passes autoSelectUploadedItems=true by default', () => {
    render(<DialFileManagerModal {...defaultProps} />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-auto-select-uploaded-items')).toBe(
      'true',
    );
  });

  it('passes autoSelectUploadedItems=false when prop is false', () => {
    render(
      <DialFileManagerModal
        {...defaultProps}
        autoSelectUploadedItems={false}
      />,
    );
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-auto-select-uploaded-items')).toBe(
      'false',
    );
  });
});

describe('DialFileManagerModal — tab-specific empty states', () => {
  it('shows MyFiles empty state on the MyFiles tab', () => {
    mockActiveTab.value = DialFileManagerTabs.MyFiles;
    render(<DialFileManagerModal {...defaultProps} />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-empty-state-title')).toBe(
      'dialFileManager.myFiles.emptyStateTitle',
    );
    expect(manager.getAttribute('data-empty-state-description')).toBe(
      'dialFileManager.myFiles.emptyStateDescription',
    );
  });

  it('shows Shared empty state on the Shared tab', () => {
    mockActiveTab.value = DialFileManagerTabs.Shared;
    render(<DialFileManagerModal {...defaultProps} />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-empty-state-title')).toBe(
      'dialFileManager.shared.emptyStateTitle',
    );
    expect(manager.getAttribute('data-empty-state-description')).toBe(
      'dialFileManager.shared.emptyStateDescription',
    );
  });

  it('shows Organization empty state on the Organization tab', () => {
    mockActiveTab.value = DialFileManagerTabs.Organization;
    render(<DialFileManagerModal {...defaultProps} />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-empty-state-title')).toBe(
      'dialFileManager.organization.emptyStateTitle',
    );
    expect(manager.getAttribute('data-empty-state-description')).toBe(
      'dialFileManager.organization.emptyStateDescription',
    );
  });
});
