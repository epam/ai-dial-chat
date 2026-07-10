import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DialFileManagerActions,
  DialFileManagerTabs,
} from '@epam/ai-dial-ui-kit';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { UseDialFileManagerResult } from '../../../hooks/files/useDialFileManager';
import { FileUploadStatus } from '../../DialFileManagerModal/types/upload';
import DialFileManagerShell from '../DialFileManagerShell';
import type { DialFileManagerShellLabels } from '../types/labels';

interface CapturedActionLabels {
  actionLabels?: Partial<Record<DialFileManagerActions, string>>;
}

const capturedDialFileManagerProps: {
  current: {
    onCreateFolder?: unknown;
    onGetInfo?: unknown;
    gridOptions?: CapturedActionLabels;
    treeOptions?: CapturedActionLabels;
    bulkActionsToolbarOptions?: CapturedActionLabels;
    fileMetadataPopupOptions?: {
      fileMetadata?: unknown;
      loading?: boolean;
      clearMetadata?: unknown;
      header?: string;
      nameLabel?: string;
      pathLabel?: string;
      modifiedDateLabel?: string;
      sizeLabel?: string;
      authorLabel?: string;
    };
  } | null;
} = { current: null };

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    DialFileManager: (props: {
      emptyStateTitle?: string;
      destinationFolderPopupOptions?: { sourceFolder?: string };
      onCreateFolder?: unknown;
      onGetInfo?: unknown;
      gridOptions?: CapturedActionLabels;
      treeOptions?: CapturedActionLabels;
      bulkActionsToolbarOptions?: CapturedActionLabels;
      fileMetadataPopupOptions?: {
        fileMetadata?: unknown;
        loading?: boolean;
        clearMetadata?: unknown;
        header?: string;
        nameLabel?: string;
        pathLabel?: string;
        modifiedDateLabel?: string;
        sizeLabel?: string;
        authorLabel?: string;
      };
    }) => {
      capturedDialFileManagerProps.current = props;
      return (
        <div role="region" aria-label="file manager">
          {props.emptyStateTitle}
          <span aria-label="source-folder">
            {props.destinationFolderPopupOptions?.sourceFolder ?? ''}
          </span>
        </div>
      );
    },
  };
});

const baseHookResult: UseDialFileManagerResult = {
  items: [],
  isLoading: false,
  error: null,
  path: '/My files',
  onPathChange: vi.fn(),
  retry: vi.fn(),
  onSearchFiles: vi.fn(),
  isSearching: false,
  searchResults: null,
  clearSearchResults: vi.fn(),
  expandedPaths: new Set(),
  loadedPaths: new Set(),
  onExpandedPathsChange: vi.fn(),
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
  uploadEnabled: true,
  isNewButtonDisabled: false,
  disabledNewButtonTooltip: '',
  visibleColumns: [],
  dateLocale: 'en',
  dateOptions: {},
  actionLabels: { [DialFileManagerActions.Download]: 'Download' },
  sharedWithMeIds: undefined,
  sharedByMePaths: new Set(),
  shareTarget: null,
  onManagePermissions: vi.fn(),
  onCloseShareModal: vi.fn(),
  onCreateShareLink: vi.fn(),
  isSharing: false,
  onUnshareFiles: vi.fn(),
  isUnsharing: false,
  onRemoveFilesAccess: vi.fn(),
  isRemovingAccess: false,
  fileMetadata: undefined,
  isFileMetadataLoading: false,
  onGetInfo: vi.fn(),
  clearMetadata: vi.fn(),
};

const emptyStateCopy = { title: 'No files', description: 'Nothing here yet' };

const baseLabels: DialFileManagerShellLabels = {
  errorMessage: 'Something went wrong',
  retryLabel: 'Retry',
  hiddenFilesLabel: 'Hidden files',
  showHiddenFilesLabel: 'Show hidden',
  hideHiddenFilesLabel: 'Hide hidden',
  getSelectionLabel: (count) => `${count} selected`,
  uploadFilesLabel: 'Upload files',
  newFolderLabel: 'New folder',
  downloadLabel: 'Download',
  downloadingLabel: 'Downloading…',
  deleteLabel: 'Delete',
  deletingLabel: 'Deleting…',
  renameLabel: 'Rename',
  renamingLabel: 'Renaming…',
  copyLabel: 'Copy',
  moveLabel: 'Move',
  duplicateLabel: 'Duplicate',
  addFolderLabel: 'Add folder',
  hiddenFilesSwitcherLabel: 'Show hidden files',
  getCopyHeader: (count, name) =>
    count === 1 ? `Copy "${name}"` : `Copy ${count} items`,
  getMoveHeader: (count, name) =>
    count === 1 ? `Move "${name}"` : `Move ${count} items`,
  moveSourceDisabledTooltip: 'Unavailable for the original location',
  folderPickerEmptyStateTitle: 'No folders here',
  folderPickerEmptyStateDescription: 'Create a folder or choose another',
  copyingLabel: 'Copying…',
  movingLabel: 'Moving…',
  operationLoaderCopyTitle: 'Copying files',
  operationLoaderMoveTitle: 'Moving files',
  operationLoaderCancelLabel: 'Cancel',
  deleteConfirmTitle: (names) => `Delete ${names.join(', ')}?`,
  deleteConfirmBody: () => 'This cannot be undone.',
  deleteConfirmLabel: 'Delete',
  deleteCancelLabel: 'Cancel',
  uploadProgressTitle: 'Uploading files',
  cancelLabel: 'Cancel',
  getUploadProgressText: (done, total) => `${done} of ${total}`,
  searchEmptyStateTitle: 'No results',
  forbiddenSymbolsTooltip: 'Forbidden symbols',
  emptyStateByTab: {
    [DialFileManagerTabs.MyFiles]: emptyStateCopy,
    [DialFileManagerTabs.Shared]: emptyStateCopy,
    [DialFileManagerTabs.Organization]: emptyStateCopy,
    [DialFileManagerTabs.Review]: emptyStateCopy,
  },
  treeHeaderByTab: {
    [DialFileManagerTabs.MyFiles]: 'My files',
    [DialFileManagerTabs.Shared]: 'Shared with me',
    [DialFileManagerTabs.Organization]: 'Organization',
    [DialFileManagerTabs.Review]: '',
  },
  renameValidationMessages: { emptyName: 'Required', duplicateName: 'Taken' },
  conflictResolutionPopupOptions: {
    singleFileTitle: 'Conflict',
    multipleFilesTitle: 'Conflicts',
    actionLabels: {
      replace: 'Replace',
      duplicate: 'Duplicate',
      cancel: 'Cancel',
    },
    strategyLabels: {
      replaceAll: 'Replace all',
      duplicateAll: 'Duplicate all',
      decideForEach: 'Decide for each',
    },
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
  },
  shareLabel: 'Share',
  unshareLabel: 'Unshare',
  removeAccessLabel: 'Remove access',
  getShareModalTitle: (name) => `Share "${name}"`,
  shareModalReadPermissionLabel: 'Can view',
  shareModalReadWritePermissionLabel: 'Can edit',
  shareModalCreateLinkButtonLabel: 'Create link',
  shareModalCopyLinkButtonLabel: 'Copy link',
  shareModalLinkCopiedConfirmation: 'Link copied',
  shareModalCancelLabel: 'Cancel',
  shareErrorMessage: 'Failed to create the share link',
  infoLabel: 'Info',
  metadataHeader: 'Information',
  metadataNameLabel: 'Name:',
  metadataPathLabel: 'Path:',
  metadataModifiedDateLabel: 'Modified Date:',
  metadataSizeLabel: 'Size:',
  metadataAuthorLabel: 'Author:',
};

const renderShell = (
  hookResultOverrides?: Partial<UseDialFileManagerResult>,
  selectedPaths: Set<string> = new Set(),
) =>
  render(
    <DialFileManagerShell
      hookResult={{ ...baseHookResult, ...hookResultOverrides }}
      labels={baseLabels}
      activeTab={DialFileManagerTabs.MyFiles}
      tabs={[{ id: DialFileManagerTabs.MyFiles, label: 'My files' }]}
      onTabChange={vi.fn()}
      selectedPaths={selectedPaths}
      onSelectedPathsChange={vi.fn()}
    />,
  );

describe('DialFileManagerShell', () => {
  it('renders DialFileManager (ui-kit) with hook result data', () => {
    renderShell();
    expect(screen.getByRole('region', { name: 'file manager' })).toBeTruthy();
  });

  it('shows the empty-state title from the current tab when items are empty', () => {
    renderShell();
    expect(screen.getByText(emptyStateCopy.title)).toBeTruthy();
  });

  it('shows the error/retry panel and calls retry on click', async () => {
    const retry = vi.fn();
    renderShell({ error: 'boom', retry });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(baseLabels.errorMessage);

    const retryButton = screen.getByRole('button', { name: 'Retry' });
    retryButton.click();
    expect(retry).toHaveBeenCalledOnce();
  });

  it('shows the upload progress modal when an upload batch is active', () => {
    renderShell({
      uploadBatchState: {
        isOpen: true,
        files: [{ id: '1', name: 'a.pdf', status: FileUploadStatus.Uploading }],
      },
    });
    expect(screen.getByText(baseLabels.uploadProgressTitle)).toBeTruthy();
  });

  it('does not render the upload progress modal when there is no active batch', () => {
    renderShell({ uploadBatchState: null });
    expect(screen.queryByText(baseLabels.uploadProgressTitle)).toBeNull();
  });

  it('sets destinationFolderPopupOptions.sourceFolder to the common parent when all selected items share one', () => {
    renderShell(
      undefined,
      new Set(['/My files/reports/a.pdf', '/My files/reports/b.pdf']),
    );
    expect(screen.getByLabelText('source-folder').textContent).toBe(
      '/My files/reports/',
    );
  });

  it('leaves destinationFolderPopupOptions.sourceFolder undefined when selected items have different parents', () => {
    renderShell(
      undefined,
      new Set(['/My files/reports/a.pdf', '/My files/notes/b.pdf']),
    );
    expect(screen.getByLabelText('source-folder').textContent).toBe('');
  });

  it('passes the hook result onCreateFolder straight through to DialFileManager without wrapping it, so the destination-folder popup targets its own browsed path via the same fallback', () => {
    const onCreateFolder = vi.fn();
    renderShell({ onCreateFolder });
    expect(capturedDialFileManagerProps.current?.onCreateFolder).toBe(
      onCreateFolder,
    );
  });

  it('passes Duplicate through to DialFileManager action labels when the hook result includes it', () => {
    renderShell({
      actionLabels: {
        [DialFileManagerActions.Download]: 'Download',
        [DialFileManagerActions.Duplicate]: 'Duplicate',
      },
    });
    expect(
      capturedDialFileManagerProps.current?.gridOptions?.actionLabels?.[
        DialFileManagerActions.Duplicate
      ],
    ).toBe(baseLabels.duplicateLabel);
  });

  it('omits Duplicate from DialFileManager action labels when the hook result excludes it', () => {
    renderShell({
      actionLabels: { [DialFileManagerActions.Download]: 'Download' },
    });
    expect(
      capturedDialFileManagerProps.current?.gridOptions?.actionLabels?.[
        DialFileManagerActions.Duplicate
      ],
    ).toBeUndefined();
  });

  it('includes Info in gridOptions action labels when the hook result includes it', () => {
    renderShell({
      actionLabels: {
        [DialFileManagerActions.Download]: 'Download',
        [DialFileManagerActions.Info]: 'Info',
      },
    });
    expect(
      capturedDialFileManagerProps.current?.gridOptions?.actionLabels?.[
        DialFileManagerActions.Info
      ],
    ).toBe(baseLabels.infoLabel);
  });

  it('omits Info from gridOptions action labels when the hook result excludes it', () => {
    renderShell({
      actionLabels: { [DialFileManagerActions.Download]: 'Download' },
    });
    expect(
      capturedDialFileManagerProps.current?.gridOptions?.actionLabels?.[
        DialFileManagerActions.Info
      ],
    ).toBeUndefined();
  });

  it('never includes Info in treeOptions or bulkActionsToolbarOptions action labels, even when the hook result includes it', () => {
    renderShell({
      actionLabels: {
        [DialFileManagerActions.Download]: 'Download',
        [DialFileManagerActions.Info]: 'Info',
      },
    });
    expect(
      capturedDialFileManagerProps.current?.treeOptions?.actionLabels?.[
        DialFileManagerActions.Info
      ],
    ).toBeUndefined();
    expect(
      capturedDialFileManagerProps.current?.bulkActionsToolbarOptions
        ?.actionLabels?.[DialFileManagerActions.Info],
    ).toBeUndefined();
  });

  it('passes onGetInfo straight through to DialFileManager', () => {
    const onGetInfo = vi.fn();
    renderShell({ onGetInfo });
    expect(capturedDialFileManagerProps.current?.onGetInfo).toBe(onGetInfo);
  });

  it('builds fileMetadataPopupOptions from hook state and translated labels', () => {
    const fileMetadata = {
      name: 'report.pdf',
    } as UseDialFileManagerResult['fileMetadata'];
    const clearMetadata = vi.fn();
    renderShell({ fileMetadata, isFileMetadataLoading: true, clearMetadata });

    expect(
      capturedDialFileManagerProps.current?.fileMetadataPopupOptions,
    ).toEqual({
      fileMetadata,
      loading: true,
      clearMetadata,
      header: baseLabels.metadataHeader,
      nameLabel: baseLabels.metadataNameLabel,
      pathLabel: baseLabels.metadataPathLabel,
      modifiedDateLabel: baseLabels.metadataModifiedDateLabel,
      sizeLabel: baseLabels.metadataSizeLabel,
      authorLabel: baseLabels.metadataAuthorLabel,
    });
  });

  it('never imports useTranslation from react-i18next', () => {
    const source = readFileSync(
      join(__dirname, '../DialFileManagerShell.tsx'),
      'utf-8',
    );
    expect(source).not.toContain('react-i18next');
  });
});
