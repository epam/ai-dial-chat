import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { combineEntities } from '@/src/utils/app/common';
import { constructPath } from '@/src/utils/app/file';
import {
  addGeneratedFolderId,
  getNextDefaultName,
  getParentAndChildFolders,
  sortByName,
} from '@/src/utils/app/folders';
import { getRootId } from '@/src/utils/app/id';

import { UploadStatus } from '@/src/types/common';
import { DialFile, FileFolderInterface } from '@/src/types/files';
import { FolderType } from '@/src/types/folder';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';

import { RootState } from '../index';

import uniq from 'lodash-es/uniq';

export interface FilesState {
  files: DialFile[];
  selectedFilesIds: string[];
  filesStatus: UploadStatus;

  folders: FileFolderInterface[];
  foldersStatus: UploadStatus;
  loadingFolderId?: string;
  newAddedFolderId?: string;
}

const initialState: FilesState = {
  files: [],
  filesStatus: UploadStatus.UNINITIALIZED,
  selectedFilesIds: [],

  folders: [],
  foldersStatus: UploadStatus.UNINITIALIZED,
};

export const filesSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    uploadFile: (
      state,
      {
        payload,
      }: PayloadAction<{
        fileContent: File;
        id: string;
        relativePath?: string;
        name: string;
      }>,
    ) => {
      state.files = state.files.filter((file) => file.id !== payload.id);
      state.files.push({
        id: payload.id,
        name: payload.name,
        relativePath: payload.relativePath,
        folderId: constructPath(getRootId(), payload.relativePath),

        status: UploadStatus.LOADING,
        percent: 0,
        fileContent: payload.fileContent,
        contentLength: payload.fileContent.size,
        contentType: payload.fileContent.type,
      });
    },
    uploadFileCancel: (
      state,
      _action: PayloadAction<{
        id: string;
      }>,
    ) => state,
    reuploadFile: (state, { payload }: PayloadAction<{ fileId: string }>) => {
      const file = state.files.find((file) => payload.fileId === file.id);
      if (!file) {
        return state;
      }

      file.status = UploadStatus.LOADING;
      file.percent = 0;
    },
    selectFiles: (state, { payload }: PayloadAction<{ ids: string[] }>) => {
      state.selectedFilesIds = uniq(state.selectedFilesIds.concat(payload.ids));
    },
    resetSelectedFiles: (state) => {
      state.selectedFilesIds = [];
    },
    unselectFiles: (state, { payload }: PayloadAction<{ ids: string[] }>) => {
      state.selectedFilesIds = state.selectedFilesIds.filter(
        (id) => !payload.ids.includes(id),
      );
    },
    uploadFileSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        apiResult: DialFile;
      }>,
    ) => {
      state.files = state.files.map((file) => {
        return file.id === payload.apiResult.id ? payload.apiResult : file;
      });
    },
    uploadFileTick: (
      state,
      {
        payload,
      }: PayloadAction<{
        id: string;
        percent: number;
      }>,
    ) => {
      const updatedFile = state.files.find((file) => file.id === payload.id);
      if (updatedFile) {
        updatedFile.percent = payload.percent;
      }
    },
    uploadFileFail: (
      state,
      {
        payload,
      }: PayloadAction<{
        id: string;
      }>,
    ) => {
      const updatedFile = state.files.find((file) => file.id === payload.id);
      if (updatedFile) {
        updatedFile.status = UploadStatus.FAILED;
      }
    },
    getFiles: (
      state,
      _action: PayloadAction<{
        id?: string;
      }>,
    ) => {
      state.filesStatus = UploadStatus.LOADING;
    },
    getFilesSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        files: DialFile[];
      }>,
    ) => {
      state.files = payload.files.concat(
        state.files.filter(
          (file) =>
            !payload.files.find((stateFile) => stateFile.id === file.id),
        ),
      );
      state.filesStatus = UploadStatus.LOADED;
    },
    getFilesFail: (state) => {
      state.filesStatus = UploadStatus.FAILED;
    },
    getFolders: (
      state,
      {
        payload,
      }: PayloadAction<{
        id?: string;
      }>,
    ) => {
      state.foldersStatus = UploadStatus.LOADING;
      state.loadingFolderId = payload.id;
    },
    getFoldersList: (
      state,
      _action: PayloadAction<{
        paths?: (string | undefined)[];
      }>,
    ) => state,
    getFoldersSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        folders: FileFolderInterface[];
        folderId?: string;
      }>,
    ) => {
      state.loadingFolderId = undefined;
      state.foldersStatus = UploadStatus.LOADED;
      state.folders = combineEntities(
        payload.folders,
        state.folders.map((f) =>
          f.id === payload.folderId ? { ...f, status: UploadStatus.LOADED } : f,
        ),
      );
    },
    getFoldersFail: (
      state,
      {
        payload,
      }: PayloadAction<{
        folderId?: string;
      }>,
    ) => {
      state.loadingFolderId = undefined;
      state.foldersStatus = UploadStatus.FAILED;
      state.folders = state.folders.map((f) =>
        f.id === payload.folderId ? { ...f, status: UploadStatus.FAILED } : f,
      );
    },
    getFilesWithFolders: (
      state,
      _action: PayloadAction<{
        id?: string;
      }>,
    ) => state,
    addNewFolder: (
      state,
      {
        payload,
      }: PayloadAction<{
        parentId?: string;
      }>,
    ) => {
      const rootFileId = getRootId();
      const folderName = getNextDefaultName(
        DEFAULT_FOLDER_NAME,
        state.folders.filter(
          (folder) => folder.folderId === (payload.parentId ?? rootFileId), // only folders on the same level
        ),
        0,
        false,
        false,
        payload.parentId,
      );

      const newAddedFolderId = constructPath(payload.parentId, folderName);
      state.folders.push(
        addGeneratedFolderId({
          name: folderName,
          type: FolderType.File,
          folderId: payload.parentId || getRootId(),
          status: UploadStatus.LOADED,
        }),
      );
      state.newAddedFolderId = newAddedFolderId;
    },
    renameFolder: (
      state,
      {
        payload,
      }: PayloadAction<{
        folderId: string;
        newName: string;
      }>,
    ) => {
      state.newAddedFolderId = undefined;
      state.folders = state.folders.map((folder) => {
        if (folder.id !== payload.folderId) {
          return folder;
        }

        const slashIndex = folder.id.lastIndexOf('/');
        const oldFolderIdPath = folder.id.slice(
          0,
          slashIndex === -1 ? 0 : slashIndex,
        );
        return {
          ...folder,
          name: payload.newName.trim(),
          id: constructPath(oldFolderIdPath, payload.newName),
        };
      });
    },
    resetNewFolderId: (state) => {
      state.newAddedFolderId = undefined;
    },
    removeFilesList: (
      state,
      _action: PayloadAction<{
        fileIds: string[];
      }>,
    ) => state,
    removeFile: (
      state,
      _action: PayloadAction<{
        fileId: string;
      }>,
    ) => state,
    removeFileSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        fileId: string;
      }>,
    ) => {
      state.files = state.files.filter((file) => file.id !== payload.fileId);
      state.selectedFilesIds.filter((id) => id !== payload.fileId);
    },
    removeFileFail: (
      state,
      _action: PayloadAction<{
        fileName: string;
      }>,
    ) => state,
    downloadFilesList: (
      state,
      _action: PayloadAction<{
        fileIds: string[];
      }>,
    ) => state,
    updateFileInfo: (
      state,
      { payload }: PayloadAction<{ file: Partial<DialFile>; id: string }>,
    ) => {
      state.files = state.files.map((file) => {
        if (file.id === payload.id) {
          return {
            ...file,
            ...payload.file,
          };
        }

        return file;
      });
    },
    unpublishFile: (state, { payload }: PayloadAction<{ id: string }>) => {
      state.files = state.files.map((file) => {
        if (file.id === payload.id) {
          return {
            ...file,
            //TODO: unpublish file by API
            isPublished: false,
          };
        }

        return file;
      });
    },
  },
});

const rootSelector = (state: RootState): FilesState => state.files;

const selectFiles = createSelector([rootSelector], (state) => {
  return sortByName([...state.files]);
});

const selectFilesByIds = createSelector(
  [selectFiles, (_state, fileIds: string[]) => fileIds],
  (files, fileIds) => {
    return files.filter((file) => fileIds.includes(file.id));
  },
);
const selectSelectedFilesIds = createSelector([rootSelector], (state) => {
  return state.selectedFilesIds;
});
const selectSelectedFiles = createSelector(
  [selectSelectedFilesIds, selectFiles],
  (selectedFilesIds, files): FilesState['files'] => {
    return selectedFilesIds
      .map((fileId) => files.find((file) => file.id === fileId))
      .filter(Boolean) as FilesState['files'];
  },
);
const selectIsUploadingFilePresent = createSelector(
  [selectSelectedFiles],
  (selectedFiles) =>
    selectedFiles.some((file) => file.status === UploadStatus.LOADING),
);

const selectFolders = createSelector([rootSelector], (state) => {
  return [...state.folders].sort((a, b) =>
    a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1,
  );
});
const selectAreFoldersLoading = createSelector([rootSelector], (state) => {
  return state.foldersStatus === UploadStatus.LOADING;
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

export const FilesSelectors = {
  selectFiles,
  selectSelectedFilesIds,
  selectSelectedFiles,
  selectIsUploadingFilePresent,
  selectFolders,
  selectAreFoldersLoading,
  selectLoadingFolderIds,
  selectNewAddedFolderId,
  selectFilesByIds,
  selectFoldersWithSearchTerm,
};

export const FilesActions = filesSlice.actions;
