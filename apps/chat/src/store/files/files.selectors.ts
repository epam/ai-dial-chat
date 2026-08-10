import { createSelector } from '@reduxjs/toolkit';

import {
  getFilteredFolders,
  getParentAndChildFolders,
  getPartialAndFullyChosenFolders,
  isFolderEmpty,
  sortByName,
} from '@/src/utils/app/folders';
import { getEntityBucket } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { doesEntityContainSearchTerm } from '@/src/utils/app/search';

import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import { EntityFilters } from '@/src/types/search';
import { RootState } from '@/src/types/store';

import { UploadStatus } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState) => state.files;

const _selectFiles = (state: RootState) => rootSelector(state).files;

const selectFiles = createSelector([_selectFiles], (files) => {
  return sortByName(files);
});

const selectReviewBucketFiles = createSelector(
  [selectFiles, (_state, bucket: string) => bucket],
  (files, bucket) => {
    return files.filter((file) => getEntityBucket(file) === bucket);
  },
);

const selectFilteredFiles = createSelector(
  [
    selectFiles,
    (_state, filters: EntityFilters) => filters,
    (_state, _filters, searchTerm: string) => searchTerm,
  ],
  (files, filters, searchTerm) => {
    return files.filter(
      (file) =>
        doesEntityContainSearchTerm(file, searchTerm) &&
        (filters.searchFilter?.(file) ?? true) &&
        (filters.sectionFilter?.(file) ?? true),
    );
  },
);
const selectFilesByIds = createSelector(
  [selectFiles, (_state, fileIds: string[]) => fileIds],
  (files, fileIds) => {
    return files.filter((file) => fileIds.includes(file.id));
  },
);
const selectFileById = createSelector(
  [selectFiles, (_state, fileId: string) => fileId],
  (files, fileId) => {
    return files.find((file) => fileId === file.id);
  },
);
const selectSelectedFilesIds = (state: RootState) =>
  rootSelector(state).selectedFilesIds;

const _selectFolders = (state: RootState) => rootSelector(state).folders;

const selectFolders = createSelector([_selectFolders], (folders) => {
  return sortByName(folders);
});
const selectFolderById = createSelector(
  [selectFolders, (_state, folderId: string) => folderId],
  (folders, folderId) => {
    return folders.find((folder) => folderId === folder.id);
  },
);
const selectFolderStatusById = createSelector([selectFolderById], (folder) => {
  return folder?.status;
});
const selectFilteredFolders = createSelector(
  [
    selectFolders,
    selectFiles,
    (_state, filters: EntityFilters) => filters,
    (_state, _filters, searchTerm: string) => searchTerm,
    (_state, _filters, _searchTerm, showHidden?: boolean) => showHidden,
  ],
  (allFolders, allFiles, filters, searchTerm, showHidden) => {
    const filteredFiles = allFiles.filter((file) =>
      doesEntityContainSearchTerm(file, searchTerm),
    );

    return getFilteredFolders({
      allFolders,
      emptyFolderIds: [],
      filters,
      entities: filteredFiles,
      searchTerm,
      includeHiddenFolders: showHidden,
    });
  },
);
const selectSelectedFiles = createSelector(
  [selectSelectedFilesIds, selectFiles],
  (selectedFilesIds, files): DialFile[] => {
    return selectedFilesIds
      .map((fileId) => files.find((file) => file.id === fileId))
      .filter(Boolean) as DialFile[];
  },
);

const selectSelectedFolders = createSelector(
  [selectSelectedFilesIds, selectFolders],
  (selectedFilesIds, folders): FolderInterface[] => {
    return selectedFilesIds
      .map((fileId) => folders.find((folder) => `${folder.id}/` === fileId))
      .filter(Boolean) as FolderInterface[];
  },
);
const selectIsUploadingFilePresent = createSelector(
  [selectSelectedFiles],
  (selectedFiles) =>
    selectedFiles.some((file) => file.status === UploadStatus.LOADING),
);

const selectAreFoldersLoading = (state: RootState) =>
  rootSelector(state).foldersStatus === UploadStatus.LOADING;

const selectAreFilesLoading = (state: RootState) =>
  rootSelector(state).filesStatus === UploadStatus.LOADING;

const selectLoadingFolderId = (state: RootState) =>
  rootSelector(state).loadingFolderId;

const selectLoadingFolderIds = createSelector(
  [selectLoadingFolderId],
  (loadingFolderId) => {
    return loadingFolderId ? [loadingFolderId] : [];
  },
);
const selectNewAddedFolderId = (state: RootState) =>
  rootSelector(state).newAddedFolderId;

const selectFoldersWithSearchTerm = createSelector(
  [selectFolders, (_state, searchTerm: string) => searchTerm],
  (folders, searchTerm) => {
    const filteredFolders = folders.filter((folder) =>
      doesEntityContainSearchTerm(folder, searchTerm),
    );

    return getParentAndChildFolders(folders, filteredFolders);
  },
);

const selectPublicFolders = createSelector([_selectFolders], (folders) => {
  return folders.filter((f) => isEntityIdPublic(f));
});

const selectReviewBucketFolders = createSelector(
  [
    selectFolders,
    (_state, searchTerm: string) => searchTerm,
    (_state, _searchTerm, bucket: string) => bucket,
  ],
  (folders, searchTerm, bucket) => {
    return folders.filter(
      (folder) =>
        doesEntityContainSearchTerm(folder, searchTerm) &&
        getEntityBucket(folder) === bucket,
    );
  },
);

const selectInitialized = (state: RootState) => rootSelector(state).initialized;

const selectLastRenamedParentFolder = (state: RootState) =>
  rootSelector(state).lastRenamedParentFolder;

const selectChosenItems = (state: RootState) =>
  rootSelector(state).chosenFileIds;

const selectEmptyFolderIds = createSelector(
  [selectFolders, selectFiles],
  (folders, files) => {
    return folders
      .filter(({ id }) => isFolderEmpty({ id, folders, entities: files }))
      .map(({ id }) => id);
  },
);

const selectChosenEmptyFolderIds = (state: RootState) =>
  rootSelector(state).chosenEmptyFoldersIds;

const selectChosenFolderIds = createSelector(
  [
    selectFiles,
    selectChosenItems,
    selectFolders,
    selectEmptyFolderIds,
    selectChosenEmptyFolderIds,
  ],
  (files, chosenItems, folders, emptyFolderIds, chosenEmptyFolderIds) => {
    return getPartialAndFullyChosenFolders(
      folders,
      files,
      chosenItems,
      emptyFolderIds,
      chosenEmptyFolderIds,
    );
  },
);

const selectIsAnyFileOperationInProgress = createSelector(
  [rootSelector],
  (state) => {
    return (
      state.isCopyingFiles ||
      state.isMovingFiles ||
      state.isDeletingFiles ||
      state.isDownloadingArchive ||
      state.isUploadingFiles ||
      state.isUploadingArchive
    );
  },
);

const selectIsUploadingFiles = createSelector(
  [rootSelector],
  (state) => state.isUploadingFiles,
);

const selectIsCopyingFiles = createSelector(
  [rootSelector],
  (state) => state.isCopyingFiles,
);

const selectIsMovingFiles = createSelector(
  [rootSelector],
  (state) => state.isMovingFiles,
);

const selectIsDeletingFiles = createSelector(
  [rootSelector],
  (state) => state.isDeletingFiles,
);

const selectLoadingFileMetadata = (state: RootState) =>
  rootSelector(state).loadingFileMetadata;

const selectFileMetadata = (state: RootState) =>
  rootSelector(state).fileMetadata;

const selectIsLoadingSearchListing = (state: RootState) =>
  rootSelector(state).isLoadingSearchListing;

const selectSearchListingMetadata = (state: RootState) =>
  rootSelector(state).searchListingMetadata;

const selectIsSearchListingLoaded = createSelector(
  [
    selectSearchListingMetadata,
    (_state: RootState, folderPath: string) => folderPath,
  ],
  (metadata, folderPath) => {
    return metadata[folderPath]?.isFullyLoaded ?? false;
  },
);

const selectSearchResultsForFolder = createSelector(
  [
    selectFiles,
    selectFolders,
    (_state: RootState, folderPath?: string) => folderPath,
    (_state: RootState, _folder, isSharedFilter?: boolean) => isSharedFilter,
  ],
  (files, folders, folderPath, isSharedFilter) => {
    let filteredFiles = files;
    let filteredFolders = folders;

    if (isSharedFilter && !folderPath) {
      const sharedRootFolderIds = folders
        .filter((f) => f.sharedWithMe)
        .map((f) => f.id);

      filteredFiles = filteredFiles.filter(
        (file) =>
          file.sharedWithMe ||
          sharedRootFolderIds.some(
            (rootId) =>
              file.folderId === rootId ||
              file.folderId?.startsWith(`${rootId}/`),
          ),
      );
      filteredFolders = filteredFolders.filter(
        (folder) =>
          folder.sharedWithMe ||
          sharedRootFolderIds.some(
            (rootId) =>
              folder.folderId === rootId ||
              folder.folderId?.startsWith(`${rootId}/`),
          ),
      );
    } else if (folderPath) {
      filteredFiles = filteredFiles.filter(
        (file) =>
          file.folderId === folderPath ||
          file.folderId?.startsWith(`${folderPath}/`),
      );
      filteredFolders = filteredFolders.filter(
        (folder) =>
          folder.folderId === folderPath ||
          folder.folderId?.startsWith(`${folderPath}/`),
      );
    }

    return { files: filteredFiles, folders: filteredFolders };
  },
);

const selectSharedWithMeFilesAndFoldersIds = (state: RootState) =>
  rootSelector(state).sharedWithMeFilesAndFoldersIds;

const selectUploadReplaceDialog = (state: RootState) =>
  rootSelector(state).uploadReplaceDialog;

const selectIsShowUploadReplaceDialog = (state: RootState) =>
  !!rootSelector(state).uploadReplaceDialog?.isOpen;

const selectDuplicatedUploadFiles = (state: RootState) =>
  rootSelector(state).uploadReplaceDialog?.duplicatedFiles ?? [];

const selectResolvedUploadIds = (state: RootState) =>
  rootSelector(state).resolvedUploadIds;

export const FilesSelectors = {
  selectFiles,
  selectReviewBucketFiles,
  selectFilteredFiles,
  selectSelectedFilesIds,
  selectSelectedFiles,
  selectSelectedFolders,
  selectIsUploadingFilePresent,
  selectFolders,
  selectFolderById,
  selectFolderStatusById,
  selectFilteredFolders,
  selectAreFoldersLoading,
  selectLoadingFolderIds,
  selectNewAddedFolderId,
  selectFilesByIds,
  selectFileById,
  selectFoldersWithSearchTerm,
  selectPublicFolders,
  selectInitialized,
  selectAreFilesLoading,
  selectLastRenamedParentFolder,
  selectReviewBucketFolders,
  selectChosenItems,
  selectEmptyFolderIds,
  selectChosenEmptyFolderIds,
  selectChosenFolderIds,
  selectIsAnyFileOperationInProgress,
  selectLoadingFileMetadata,
  selectFileMetadata,
  selectIsLoadingSearchListing,
  selectSearchListingMetadata,
  selectIsSearchListingLoaded,
  selectSearchResultsForFolder,
  selectIsMovingFiles,
  selectIsCopyingFiles,
  selectIsUploadingFiles,
  selectIsDeletingFiles,
  selectSharedWithMeFilesAndFoldersIds,
  selectUploadReplaceDialog,
  selectIsShowUploadReplaceDialog,
  selectDuplicatedUploadFiles,
  selectResolvedUploadIds,
};
