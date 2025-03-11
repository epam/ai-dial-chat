import { createSelector } from '@reduxjs/toolkit';

import {
  getFilteredFolders,
  getParentAndChildFolders,
  sortByName,
} from '@/src/utils/app/folders';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { doesEntityContainSearchTerm } from '@/src/utils/app/search';

import { EntityFilters } from '@/src/types/search';
import { RootState } from '@/src/types/store';

import { FilesState } from './files.types';

import { UploadStatus } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState): FilesState => state.files;

const selectFiles = createSelector([rootSelector], (state) => {
  return sortByName([...state.files]);
});
export const selectFilteredFiles = createSelector(
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
const selectSelectedFilesIds = createSelector([rootSelector], (state) => {
  return state.selectedFilesIds;
});
const selectFolders = createSelector([rootSelector], (state) => {
  return [...state.folders].sort((a, b) =>
    a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1,
  );
});
const selectFilteredFolders = createSelector(
  [
    selectFolders,
    selectFiles,
    (_state, filters: EntityFilters) => filters,
    (_state, _filters, searchTerm: string) => searchTerm,
  ],
  (allFolders, allFiles, filters, searchTerm) => {
    const filteredFiles = allFiles.filter((file) =>
      doesEntityContainSearchTerm(file, searchTerm),
    );

    return getFilteredFolders({
      allFolders,
      emptyFolderIds: [],
      filters,
      entities: filteredFiles,
      searchTerm,
    });
  },
);
const selectSelectedFiles = createSelector(
  [selectSelectedFilesIds, selectFiles],
  (selectedFilesIds, files): FilesState['files'] => {
    return selectedFilesIds
      .map((fileId) => files.find((file) => file.id === fileId))
      .filter(Boolean) as FilesState['files'];
  },
);

const selectSelectedFolders = createSelector(
  [selectSelectedFilesIds, selectFolders],
  (selectedFilesIds, folders): FilesState['folders'] => {
    return selectedFilesIds
      .map((fileId) => folders.find((folder) => `${folder.id}/` === fileId))
      .filter(Boolean) as FilesState['folders'];
  },
);
const selectIsUploadingFilePresent = createSelector(
  [selectSelectedFiles],
  (selectedFiles) =>
    selectedFiles.some((file) => file.status === UploadStatus.LOADING),
);

const selectAreFoldersLoading = createSelector([rootSelector], (state) => {
  return state.foldersStatus === UploadStatus.LOADING;
});
const selectAreFilesLoading = createSelector([rootSelector], (state) => {
  return state.filesStatus === UploadStatus.LOADING;
});
const selectLoadingFolderIds = createSelector([rootSelector], (state) => {
  return state.loadingFolderId ? [state.loadingFolderId] : [];
});
const selectNewAddedFolderId = createSelector([rootSelector], (state) => {
  return state.newAddedFolderId;
});
const selectFoldersWithSearchTerm = createSelector(
  [selectFolders, (_state, searchTerm: string) => searchTerm],
  (folders, searchTerm) => {
    const filtered = folders.filter((folder) =>
      folder.name.includes(searchTerm.toLowerCase()),
    );

    return getParentAndChildFolders(folders, filtered);
  },
);
const selectPublicationFolders = createSelector(
  [rootSelector],
  (state: FilesState) => {
    return state.folders.filter((f) => f.isPublicationFolder);
  },
);

const selectPublicFolders = createSelector(
  [rootSelector],
  (state: FilesState) => {
    return state.folders.filter((f) => isEntityIdPublic(f));
  },
);

const selectInitialized = createSelector(
  [rootSelector],
  (state) => state.initialized,
);

const selectFolderById = createSelector(
  [selectFolders, (_state, folderId: string) => folderId],
  (folders, folderId) => {
    return folders.find((folder) => folder.id == folderId);
  },
);

const selectLastRenamedParentFolder = (state: RootState) =>
  rootSelector(state).lastRenamedParentFolder;

export const FilesSelectors = {
  selectFiles,
  selectFilteredFiles,
  selectSelectedFilesIds,
  selectSelectedFiles,
  selectSelectedFolders,
  selectIsUploadingFilePresent,
  selectFolders,
  selectFilteredFolders,
  selectAreFoldersLoading,
  selectLoadingFolderIds,
  selectNewAddedFolderId,
  selectFolderById,
  selectFilesByIds,
  selectFileById,
  selectFoldersWithSearchTerm,
  selectPublicationFolders,
  selectPublicFolders,
  selectInitialized,
  selectAreFilesLoading,
  selectLastRenamedParentFolder,
};
