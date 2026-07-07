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

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    DialFileManager: ({ emptyStateTitle }: { emptyStateTitle?: string }) => (
      <div role="region" aria-label="file manager">
        {emptyStateTitle}
      </div>
    ),
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
  uploadEnabled: true,
  isNewButtonDisabled: false,
  disabledNewButtonTooltip: '',
  visibleColumns: [],
  dateLocale: 'en',
  dateOptions: {},
  actionLabels: { [DialFileManagerActions.Download]: 'Download' },
  sharedWithMeIds: undefined,
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
};

const renderShell = (hookResultOverrides?: Partial<UseDialFileManagerResult>) =>
  render(
    <DialFileManagerShell
      hookResult={{ ...baseHookResult, ...hookResultOverrides }}
      labels={baseLabels}
      activeTab={DialFileManagerTabs.MyFiles}
      tabs={[{ id: DialFileManagerTabs.MyFiles, label: 'My files' }]}
      onTabChange={vi.fn()}
      selectedPaths={new Set()}
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

  it('never imports useTranslation from react-i18next', () => {
    const source = readFileSync(
      join(__dirname, '../DialFileManagerShell.tsx'),
      'utf-8',
    );
    expect(source).not.toContain('react-i18next');
  });
});
