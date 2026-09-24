import {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
  type UseDialFileManagerResult,
} from '@epam/ai-dial-chat-hooks';
import * as chatHooksModule from '@epam/ai-dial-chat-hooks';
import {
  DialFileManagerActions,
  DialFileManagerTabs,
  DialFileNodeType,
} from '@epam/ai-dial-ui-kit';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppConfig as mockUseAppConfig } from '../../../context/tests/app-config-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import DialFileManagerPage from '../DialFileManagerPage';

vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return {
    ...actual,
    useDialFileManager: vi.fn(),
  };
});

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => createNotificationContextValue(vi.fn()),
}));

vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { bucket: 'test-bucket' } }),
}));

const { mockActiveTab, mockHandleTabChange, mockFileManagerTabs } = vi.hoisted(
  () => ({
    mockActiveTab: { value: undefined as string | undefined },
    mockHandleTabChange: vi.fn(),
    mockFileManagerTabs: {
      value: ['my_files', 'shared', 'organization'] as string[],
    },
  }),
);

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);
mockUseAppConfig.mockImplementation(() => ({
  config: {
    fileManagerTabs: mockFileManagerTabs.value,
    maxAttachmentFileSizeBytes: 536_870_912,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@epam/ai-dial-react-file-manager', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-react-file-manager')>();
  const { DialFileManagerActions: Actions, DialFileManagerTabs: Tabs } = actual;
  return {
    ...actual,
    useDialFileManagerTabs: vi.fn().mockImplementation(() => ({
      activeTab: mockActiveTab.value ?? Tabs.MyFiles,
      handleTabChange: mockHandleTabChange,
      tabs: [
        { value: Tabs.MyFiles, label: 'My Files' },
        { value: Tabs.Shared, label: 'Shared with Me' },
        { value: Tabs.Organization, label: 'Organization' },
      ],
    })),
    DialFileManager: ({
      items,
      gridOptions,
      bulkActionsToolbarOptions,
      toolbarOptions,
      treeOptions,
      autoSelectUploadedItems,
      maxSelectableFileSize,
      maxFileSize,
      uploadValidationMessages,
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
      treeOptions?: {
        tabs?: Array<{ value: string; label: string }>;
      };
      autoSelectUploadedItems?: boolean;
      maxSelectableFileSize?: number;
      maxFileSize?: number;
      uploadValidationMessages?: { oversizedFiles?: string };
    }) => (
      <div
        role="region"
        aria-label="file manager"
        data-tab-count={treeOptions?.tabs?.length}
        data-max-selectable-file-size={maxSelectableFileSize}
        data-max-file-size={maxFileSize}
        data-oversized-files-message={uploadValidationMessages?.oversizedFiles}
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

const mockUseDialFileManager = vi.mocked(chatHooksModule.useDialFileManager);

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
  onFolderPopupPathChange: vi.fn(),
  folderPopupLoadingPaths: new Set(),
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
  onUnshareFiles: vi.fn(),
  isUnsharing: false,
  onRemoveFilesAccess: vi.fn(),
  isRemovingAccess: false,
  fileMetadata: undefined,
  isFileMetadataLoading: false,
  onGetInfo: vi.fn(),
  clearMetadata: vi.fn(),
  isAnyOperationInProgress: false,
};

beforeEach(() => {
  mockActiveTab.value = undefined;
  mockFileManagerTabs.value = ['my_files', 'shared', 'organization'];
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

  it('renders the tab navigation for My Files, Shared, and Organization', () => {
    mockActiveTab.value = DialFileManagerTabs.MyFiles;
    render(<DialFileManagerPage />);
    expect(screen.getByRole('region', { name: 'file manager' })).toBeTruthy();
    expect(
      screen
        .getByRole('region', { name: 'file manager' })
        .getAttribute('data-tab-count'),
    ).toBe('3');
  });

  it('renders only the tabs allowed by the deployment-configured fileManagerTabs', () => {
    mockFileManagerTabs.value = ['my_files', 'organization'];
    mockActiveTab.value = DialFileManagerTabs.MyFiles;
    render(<DialFileManagerPage />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-tab-count')).toBe('2');
  });

  it('forwards the AppConfig-sourced size limit as both maxSelectableFileSize and the ui-kit maxFileSize prop, with a translated oversized-upload message', () => {
    render(<DialFileManagerPage />);
    const manager = screen.getByRole('region', { name: 'file manager' });
    expect(manager.getAttribute('data-max-selectable-file-size')).toBe(
      '536870912',
    );
    expect(manager.getAttribute('data-max-file-size')).toBe('536870912');
    expect(manager.getAttribute('data-oversized-files-message')).toBe(
      'dialFileManager.uploadFileTooLarge',
    );
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
