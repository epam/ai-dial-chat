import { describe, expect, it } from 'vitest';
import type { FileManagerController } from '../file-manager-controller';
import { getParentFolderPath } from '../path';

describe('FileManagerController', () => {
  it('contains exactly the shell-consumed fields', () => {
    type ControllerKeys = keyof FileManagerController;

    const controllerKeys: Record<ControllerKeys, true> = {
      items: true,
      isLoading: true,
      error: true,
      path: true,
      onPathChange: true,
      retry: true,
      onSearchFiles: true,
      isSearching: true,
      searchResults: true,
      clearSearchResults: true,
      expandedPaths: true,
      loadedPaths: true,
      onExpandedPathsChange: true,
      onFolderPopupPathChange: true,
      folderPopupLoadingPaths: true,
      onUploadFiles: true,
      onUploadArchive: true,
      onValidateUpload: true,
      uploadBatchState: true,
      cancelUpload: true,
      cancelUploadFile: true,
      clearUploadBatch: true,
      onCreateFolder: true,
      onCreateFolderValidate: true,
      onDownloadFiles: true,
      isDownloading: true,
      downloadBatchState: true,
      cancelDownloadFile: true,
      cancelAllDownloads: true,
      clearDownloadBatch: true,
      onDeleteFiles: true,
      isDeleting: true,
      onRenameValidate: true,
      onMoveToFiles: true,
      isRenaming: true,
      onCopyFiles: true,
      isCopying: true,
      isMoving: true,
      cancelCopyMove: true,
      uploadEnabled: true,
      isNewButtonDisabled: true,
      disabledNewButtonTooltip: true,
      visibleColumns: true,
      dateLocale: true,
      dateOptions: true,
      actionLabels: true,
      sharedWithMeIds: true,
      sharedByMePaths: true,
      onUnshareFiles: true,
      isUnsharing: true,
      onRemoveFilesAccess: true,
      isRemovingAccess: true,
      fileMetadata: true,
      isFileMetadataLoading: true,
      onGetInfo: true,
      clearMetadata: true,
      sectionTab: true,
    } satisfies Record<ControllerKeys, true>;

    expect(Object.keys(controllerKeys)).toHaveLength(57);
  });
});

describe('getParentFolderPath', () => {
  it('returns the parent folder for a file in a subfolder', () => {
    expect(getParentFolderPath('reports/file.txt')).toBe('reports/');
  });

  it('returns the parent folder for a virtual folder path', () => {
    expect(getParentFolderPath('/My files/reports/')).toBe('/My files/');
  });

  it('returns empty string for a root-level file', () => {
    expect(getParentFolderPath('report.pdf')).toBe('');
  });

  it('returns empty string for a path with no parent', () => {
    expect(getParentFolderPath('file')).toBe('');
  });

  it('handles deeply nested paths', () => {
    expect(getParentFolderPath('/a/b/c/d.txt')).toBe('/a/b/c/');
  });
});
