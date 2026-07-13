import {
  DialFileManagerActions,
  DialFileManagerTabs,
  DialFileNodeType,
} from '@epam/ai-dial-ui-kit';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as useDialFileManagerModule from '../../../hooks/files/useDialFileManager';
import type { UseDialFileManagerResult } from '../../../hooks/files/useDialFileManager';
import {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
} from '../../../types/file-manager-variant';
import DialFileManagerPage from '../DialFileManagerPage';

vi.mock('../../../hooks/files/useDialFileManager');

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({ showNotification: vi.fn() }),
}));

vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { bucket: 'test-bucket' } }),
}));

const { mockActiveTab, mockHandleTabChange } = vi.hoisted(() => ({
  mockActiveTab: { value: undefined as string | undefined },
  mockHandleTabChange: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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
        { id: Tabs.MyFiles, label: 'My files' },
        { id: Tabs.Shared, label: 'Shared with me' },
        { id: Tabs.Organization, label: 'Organization' },
      ],
    })),
    DialFileManager: ({
      items,
      gridOptions,
      bulkActionsToolbarOptions,
      toolbarOptions,
      autoSelectUploadedItems,
    }: {
      items?: { path: string }[];
      gridOptions?: {
        actionLabels?: Partial<Record<DialFileManagerActions, string>>;
      };
      bulkActionsToolbarOptions?: {
        actionLabels?: Partial<Record<DialFileManagerActions, string>>;
      };
      toolbarOptions?: {
        newActions?: { uploadArchive?: { label?: string } };
      };
      autoSelectUploadedItems?: boolean;
    }) => (
      <div
        role="region"
        aria-label="file manager"
        data-has-download={String(
          Actions.Download in (gridOptions?.actionLabels ?? {}),
        )}
        data-has-delete={String(
          Actions.Delete in (gridOptions?.actionLabels ?? {}),
        )}
        data-has-rename={String(
          Actions.Rename in (gridOptions?.actionLabels ?? {}),
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
        data-has-info={String(
          Actions.Info in (gridOptions?.actionLabels ?? {}),
        )}
        data-has-unshare={String(
          Actions.Unshare in (gridOptions?.actionLabels ?? {}),
        )}
        data-has-share={String(
          Actions.ManagePermissions in (gridOptions?.actionLabels ?? {}),
        )}
        data-has-remove-access={String(
          Actions.RemoveAccess in (gridOptions?.actionLabels ?? {}),
        )}
        data-has-upload-archive={String(
          toolbarOptions?.newActions?.uploadArchive != null,
        )}
        data-auto-select-uploaded-items={String(
          autoSelectUploadedItems ?? true,
        )}
      >
        {items?.length ?? 0} items
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
      id: 'report.pdf',
      name: 'report.pdf',
      path: '/My files/report.pdf',
      parentPath: '/My files',
      nodeType: DialFileNodeType.ITEM,
      folderId: 'test-bucket',
    },
  ],
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
  onUploadArchive: vi.fn(),
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
  actionLabels: {},
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

beforeEach(() => {
  mockActiveTab.value = undefined;
  mockUseDialFileManager.mockReturnValue(defaultHookResult);
});

describe('DialFileManagerPage', () => {
  it('renders the shell with items from the hook result', () => {
    render(<DialFileManagerPage />);
    expect(screen.getByRole('region', { name: 'file manager' })).toBeTruthy();
    expect(screen.getByText('1 items')).toBeTruthy();
  });

  it('calls useDialFileManager with standalone variant and full action profile on mount, without any user interaction', () => {
    render(<DialFileManagerPage />);
    expect(mockUseDialFileManager).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'test-bucket',
        variant: DialFileManagerVariant.Standalone,
        actionProfile: DialFileManagerActionProfile.Full,
      }),
    );
  });

  it('does not render an Attach button or attach footer', () => {
    render(<DialFileManagerPage />);
    expect(screen.queryByRole('button', { name: /attach/i })).toBeNull();
  });

  it('keeps uploaded items unselected', () => {
    render(<DialFileManagerPage />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-auto-select-uploaded-items')).toBe(
      'false',
    );
  });

  it('renders the tab navigation for My files, Shared, and Organization', () => {
    mockActiveTab.value = DialFileManagerTabs.MyFiles;
    render(<DialFileManagerPage />);
    expect(screen.getByRole('region', { name: 'file manager' })).toBeTruthy();
  });
});

describe('DialFileManagerPage — full action matrix on my_files', () => {
  it('surfaces the complete my_files matrix: Copy/Move/Duplicate/Rename/Delete, Share/Remove access, Info, and upload-archive', () => {
    mockActiveTab.value = DialFileManagerTabs.MyFiles;
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      actionLabels: {
        [DialFileManagerActions.Download]: 'Download',
        [DialFileManagerActions.Delete]: 'Delete',
        [DialFileManagerActions.Rename]: 'Rename',
        [DialFileManagerActions.Copy]: 'Copy',
        [DialFileManagerActions.Move]: 'Move',
        [DialFileManagerActions.Duplicate]: 'Duplicate',
        [DialFileManagerActions.ManagePermissions]: 'Share',
        [DialFileManagerActions.RemoveAccess]: 'Remove access',
        [DialFileManagerActions.Info]: 'Info',
      },
    });
    render(<DialFileManagerPage />);
    const manager = screen.getByRole('region', { name: 'file manager' });

    expect(manager.getAttribute('data-has-download')).toBe('true');
    expect(manager.getAttribute('data-has-delete')).toBe('true');
    expect(manager.getAttribute('data-has-rename')).toBe('true');
    expect(manager.getAttribute('data-has-copy')).toBe('true');
    expect(manager.getAttribute('data-has-move')).toBe('true');
    expect(manager.getAttribute('data-has-duplicate')).toBe('true');
    expect(manager.getAttribute('data-has-bulk-copy')).toBe('true');
    expect(manager.getAttribute('data-has-bulk-move')).toBe('true');
    expect(manager.getAttribute('data-has-bulk-duplicate')).toBe('true');
    expect(manager.getAttribute('data-has-share')).toBe('true');
    expect(manager.getAttribute('data-has-remove-access')).toBe('true');
    expect(manager.getAttribute('data-has-info')).toBe('true');
    expect(manager.getAttribute('data-has-upload-archive')).toBe('true');
  });

  it('surfaces Download only on the Shared tab', () => {
    mockActiveTab.value = DialFileManagerTabs.Shared;
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      actionLabels: {
        [DialFileManagerActions.Download]: 'Download',
      },
    });
    render(<DialFileManagerPage />);
    const manager = screen.getByRole('region', { name: 'file manager' });

    expect(manager.getAttribute('data-has-download')).toBe('true');
    expect(manager.getAttribute('data-has-delete')).toBe('false');
    expect(manager.getAttribute('data-has-rename')).toBe('false');
    expect(manager.getAttribute('data-has-copy')).toBe('false');
    expect(manager.getAttribute('data-has-move')).toBe('false');
    expect(manager.getAttribute('data-has-duplicate')).toBe('false');
  });

  it('surfaces Download only on the Organization tab', () => {
    mockActiveTab.value = DialFileManagerTabs.Organization;
    mockUseDialFileManager.mockReturnValue({
      ...defaultHookResult,
      actionLabels: {
        [DialFileManagerActions.Download]: 'Download',
      },
    });
    render(<DialFileManagerPage />);
    const manager = screen.getByRole('region', { name: 'file manager' });

    expect(manager.getAttribute('data-has-download')).toBe('true');
    expect(manager.getAttribute('data-has-delete')).toBe('false');
    expect(manager.getAttribute('data-has-copy')).toBe('false');
    expect(manager.getAttribute('data-has-move')).toBe('false');
    expect(manager.getAttribute('data-has-duplicate')).toBe('false');
  });
});
