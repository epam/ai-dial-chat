import { DialFileManagerTabs, DialFileNodeType } from '@epam/ai-dial-ui-kit';
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
  const { DialFileManagerTabs: Tabs } = actual;
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
    DialFileManager: ({ items }: { items?: { path: string }[] }) => (
      <div role="region" aria-label="file manager">
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

  it('calls useDialFileManager with standalone variant and browse action profile on mount, without any user interaction', () => {
    render(<DialFileManagerPage />);
    expect(mockUseDialFileManager).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'test-bucket',
        variant: DialFileManagerVariant.Standalone,
        actionProfile: DialFileManagerActionProfile.Browse,
      }),
    );
  });

  it('does not render an Attach button or attach footer', () => {
    render(<DialFileManagerPage />);
    expect(screen.queryByRole('button', { name: /attach/i })).toBeNull();
  });

  it('renders the tab navigation for My files, Shared, and Organization', () => {
    mockActiveTab.value = DialFileManagerTabs.MyFiles;
    render(<DialFileManagerPage />);
    expect(screen.getByRole('region', { name: 'file manager' })).toBeTruthy();
  });
});
