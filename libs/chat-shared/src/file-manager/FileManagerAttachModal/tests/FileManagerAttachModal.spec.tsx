import {
  DialFileManagerTabs,
  DialFileNodeType,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachResult } from '../../attach-result';
import type { FileManagerController } from '../../file-manager-controller';
import {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
} from '../../file-manager-variant';
import {
  FileManagerAttachModal,
  type FileManagerAttachModalLabels,
} from '../FileManagerAttachModal';

vi.mock('../../DialFileManagerShell/DialFileManagerShell', async () => {
  const { DialFileManagerTabs: Tabs } =
    await import('@epam/ai-dial-react-file-manager');
  return {
    DialFileManagerShell: ({
      onSelectedPathsChange,
      onTabChange,
      selectedPaths,
    }: {
      onSelectedPathsChange: (paths: Set<string>) => void;
      onTabChange: (tab: DialFileManagerTabs) => void;
      selectedPaths: Set<string>;
    }) => (
      <div>
        <button
          onClick={() =>
            onSelectedPathsChange(new Set(['/My files/report.pdf']))
          }
        >
          select file
        </button>
        <button
          onClick={() => onSelectedPathsChange(new Set(['/My files/docs/']))}
        >
          select folder
        </button>
        <button onClick={() => onTabChange(Tabs.Shared)}>change tab</button>
        <span data-testid="selection-size">{selectedPaths.size}</span>
      </div>
    ),
  };
});

const makeFile = (overrides: Partial<DialFile> = {}): DialFile =>
  ({
    id: 'report.pdf',
    name: 'report.pdf',
    path: '/My files/report.pdf',
    nodeType: DialFileNodeType.ITEM,
    contentType: 'application/pdf',
    ...overrides,
  }) as DialFile;

const makeFolderFile = (overrides: Partial<DialFile> = {}): DialFile =>
  ({
    id: 'docs',
    name: 'docs',
    path: '/My files/docs/',
    nodeType: DialFileNodeType.FOLDER,
    ...overrides,
  }) as DialFile;

const makeController = (
  overrides: Partial<FileManagerController> = {},
): FileManagerController =>
  ({
    items: [makeFile(), makeFolderFile()],
    isLoading: false,
    error: null,
    path: '/My files',
    onPathChange: vi.fn(),
    retry: vi.fn(),
    onSearchFiles: vi.fn(),
    isSearching: false,
    searchResults: null,
    clearSearchResults: vi.fn(),
    expandedPaths: new Set<string>(),
    loadedPaths: new Set<string>(),
    onExpandedPathsChange: vi.fn(),
    onFolderPopupPathChange: vi.fn(),
    folderPopupLoadingPaths: new Set<string>(),
    onUploadFiles: vi.fn(),
    onUploadArchive: vi.fn(),
    onValidateUpload: vi.fn(),
    uploadBatchState: null,
    cancelUpload: vi.fn(),
    clearUploadBatch: vi.fn(),
    onCreateFolder: vi.fn(),
    onCreateFolderValidate: vi.fn(),
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
    sharedByMePaths: new Set<string>(),
    onUnshareFiles: vi.fn(),
    isUnsharing: false,
    onRemoveFilesAccess: vi.fn(),
    isRemovingAccess: false,
    fileMetadata: undefined,
    isFileMetadataLoading: false,
    onGetInfo: vi.fn(),
    clearMetadata: vi.fn(),
    ...overrides,
  }) satisfies FileManagerController;

const labels: FileManagerAttachModalLabels = {
  title: 'Attach files',
  attachLabel: 'Attach',
} as unknown as FileManagerAttachModalLabels;

interface RenderOptions {
  selectedPaths?: Set<string>;
  onSelectedPathsChange?: (paths: Set<string>) => void;
  onTabChange?: (tab: DialFileManagerTabs) => void;
  onAttach?: (result: AttachResult) => void;
  onCountLimitExceeded?: (total: number, limit: number) => void;
  onSkippedUnsupportedFiles?: () => void;
  controller?: FileManagerController;
  isAnyOperationInProgress?: boolean;
  resolveFolderPath?: (file: DialFile) => string | null;
  isFileTypeAllowed?: (contentType: string) => boolean;
  maximumAttachmentsAmount?: number;
  existingAttachmentsAmount?: number;
}

const renderModal = ({
  selectedPaths = new Set<string>(),
  onSelectedPathsChange = vi.fn(),
  onTabChange = vi.fn(),
  onAttach = vi.fn(),
  controller = makeController(),
  isAnyOperationInProgress = false,
  resolveFolderPath = () => null,
  ...rest
}: RenderOptions = {}) =>
  render(
    <FileManagerAttachModal
      isOpen
      onClose={vi.fn()}
      onAttach={onAttach}
      controller={controller}
      isAnyOperationInProgress={isAnyOperationInProgress}
      activeTab={DialFileManagerTabs.MyFiles}
      tabs={[] as never}
      onTabChange={onTabChange}
      labels={labels}
      variant={DialFileManagerVariant.Attach}
      actionProfile={DialFileManagerActionProfile.Attach}
      selectedPaths={selectedPaths}
      onSelectedPathsChange={onSelectedPathsChange}
      resolveFolderPath={resolveFolderPath}
      {...rest}
    />,
  );

describe('FileManagerAttachModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Attach button disabled state', () => {
    it('disables the Attach button when no paths are selected', () => {
      renderModal({ selectedPaths: new Set() });
      expect(
        screen.getByRole('button', { name: 'Attach' }).hasAttribute('disabled'),
      ).toBe(true);
    });

    it('disables the Attach button while the controller is loading', () => {
      renderModal({
        selectedPaths: new Set(['/My files/report.pdf']),
        controller: makeController({ isLoading: true }),
      });
      expect(
        screen.getByRole('button', { name: 'Attach' }).hasAttribute('disabled'),
      ).toBe(true);
    });

    it('disables the Attach button while an operation is in progress', () => {
      renderModal({
        selectedPaths: new Set(['/My files/report.pdf']),
        isAnyOperationInProgress: true,
      });
      expect(
        screen.getByRole('button', { name: 'Attach' }).hasAttribute('disabled'),
      ).toBe(true);
    });

    it('enables the Attach button when a file is selected and idle', () => {
      renderModal({ selectedPaths: new Set(['/My files/report.pdf']) });
      expect(
        screen.getByRole('button', { name: 'Attach' }).hasAttribute('disabled'),
      ).toBe(false);
    });
  });

  describe('Attach button click', () => {
    it('calls onAttach with the selected file when Attach is clicked', async () => {
      const onAttach = vi.fn();
      const fileItem = makeFile();
      renderModal({
        selectedPaths: new Set([fileItem.path]),
        controller: makeController({ items: [fileItem] }),
        onAttach,
      });

      await userEvent.click(screen.getByRole('button', { name: 'Attach' }));

      expect(onAttach).toHaveBeenCalledOnce();
      const result: AttachResult = vi.mocked(onAttach).mock.calls[0][0];
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe(fileItem.path);
      expect(result.folderPaths).toHaveLength(0);
    });

    it('calls onAttach with the resolved folder path when a folder is selected', async () => {
      const onAttach = vi.fn();
      const folderItem = makeFolderFile();
      const resolvedPath = 'files/my-bucket/docs/';
      renderModal({
        selectedPaths: new Set([folderItem.path]),
        controller: makeController({ items: [folderItem] }),
        resolveFolderPath: () => resolvedPath,
        onAttach,
      });

      await userEvent.click(screen.getByRole('button', { name: 'Attach' }));

      expect(onAttach).toHaveBeenCalledOnce();
      const result: AttachResult = vi.mocked(onAttach).mock.calls[0][0];
      expect(result.files).toHaveLength(0);
      expect(result.folderPaths).toEqual([resolvedPath]);
    });

    it('skips folders whose resolveFolderPath returns null', async () => {
      const onAttach = vi.fn();
      const folderItem = makeFolderFile();
      renderModal({
        selectedPaths: new Set([folderItem.path]),
        controller: makeController({ items: [folderItem] }),
        resolveFolderPath: () => null,
        onAttach,
      });

      await userEvent.click(screen.getByRole('button', { name: 'Attach' }));

      expect(onAttach).toHaveBeenCalledOnce();
      const result: AttachResult = vi.mocked(onAttach).mock.calls[0][0];
      expect(result.files).toHaveLength(0);
      expect(result.folderPaths).toHaveLength(0);
    });
  });

  describe('count limit exceeded', () => {
    it('calls onCountLimitExceeded and does not call onAttach when the limit is exceeded', async () => {
      const onAttach = vi.fn();
      const onCountLimitExceeded = vi.fn();
      const fileItem = makeFile();
      renderModal({
        selectedPaths: new Set([fileItem.path]),
        controller: makeController({ items: [fileItem] }),
        maximumAttachmentsAmount: 1,
        existingAttachmentsAmount: 1,
        onAttach,
        onCountLimitExceeded,
      });

      await userEvent.click(screen.getByRole('button', { name: 'Attach' }));

      expect(onCountLimitExceeded).toHaveBeenCalledOnce();
      expect(onCountLimitExceeded).toHaveBeenCalledWith(2, 1);
      expect(onAttach).not.toHaveBeenCalled();
    });
  });

  describe('unsupported file type', () => {
    it('calls onSkippedUnsupportedFiles when a file with a disallowed type is selected', async () => {
      const onAttach = vi.fn();
      const onSkippedUnsupportedFiles = vi.fn();
      const fileItem = makeFile({ contentType: 'video/mp4' });
      renderModal({
        selectedPaths: new Set([fileItem.path]),
        controller: makeController({ items: [fileItem] }),
        isFileTypeAllowed: (ct) => ct !== 'video/mp4',
        onAttach,
        onSkippedUnsupportedFiles,
      });

      await userEvent.click(screen.getByRole('button', { name: 'Attach' }));

      expect(onSkippedUnsupportedFiles).toHaveBeenCalledOnce();
      expect(onAttach).toHaveBeenCalledOnce();
      const result: AttachResult = vi.mocked(onAttach).mock.calls[0][0];
      expect(result.files).toHaveLength(0);
    });
  });

  describe('shell callback forwarding', () => {
    it('forwards onTabChange from the shell to the host', async () => {
      const onTabChange = vi.fn();
      renderModal({ onTabChange });

      await userEvent.click(screen.getByRole('button', { name: 'change tab' }));

      expect(onTabChange).toHaveBeenCalledOnce();
      expect(onTabChange).toHaveBeenCalledWith(DialFileManagerTabs.Shared);
    });

    it('forwards onSelectedPathsChange from the shell to the host', async () => {
      const onSelectedPathsChange = vi.fn();
      renderModal({ onSelectedPathsChange });

      await userEvent.click(
        screen.getByRole('button', { name: 'select file' }),
      );

      expect(onSelectedPathsChange).toHaveBeenCalledOnce();
      const paths: Set<string> = vi.mocked(onSelectedPathsChange).mock
        .calls[0][0];
      expect(paths.has('/My files/report.pdf')).toBe(true);
    });

    it('reflects the current selectedPaths in the shell', () => {
      renderModal({ selectedPaths: new Set(['/My files/report.pdf']) });
      expect(screen.getByTestId('selection-size').textContent).toBe('1');
    });
  });
});
