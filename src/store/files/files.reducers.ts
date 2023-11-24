import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { getPathNameId } from '@/src/utils/app/file';
import { getAvailableNameOnSameFolderLevel } from '@/src/utils/app/folders';

import { DialFile, FileFolderInterface } from '@/src/types/files';
import { FolderType } from '@/src/types/folder';

import { RootState } from '../index';

type Status = undefined | 'LOADING' | 'LOADED' | 'FAILED';

export interface FilesState {
  files: DialFile[];
  selectedFilesIds: string[];
  filesStatus: Status;

  folders: FileFolderInterface[];
  foldersStatus: Status;
  loadingFolder: string | undefined;
  newAddedFolderId: string | undefined;
}

const initialState: FilesState = {
  files: [],
  filesStatus: undefined,
  selectedFilesIds: [],

  folders: [],
  foldersStatus: undefined,
  loadingFolder: undefined,
  newAddedFolderId: undefined,
};

export const filesSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    init: (state) => state,
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
      state.files.push({
        id: payload.id,
        name: payload.name,
        relativePath: payload.relativePath,
        folderId: payload.relativePath || undefined,

        status: 'UPLOADING',
        percent: 0,
        fileContent: payload.fileContent,
        contentLength: payload.fileContent.size,
        contentType: payload.fileContent.type,
      });
    },
    reuploadFile: (state, { payload }: PayloadAction<{ fileId: string }>) => {
      const file = state.files.find((file) => payload.fileId === file.id);
      if (!file) {
        return state;
      }

      file.status = 'UPLOADING';
      file.percent = 0;
    },
    selectFiles: (state, { payload }: PayloadAction<{ ids: string[] }>) => {
      state.selectedFilesIds = Array.from(
        new Set(state.selectedFilesIds.concat(payload.ids)),
      );
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
        updatedFile.status = 'FAILED';
      }
    },
    getFiles: (
      state,
      _action: PayloadAction<{
        path?: string;
      }>,
    ) => {
      state.filesStatus = 'LOADING';
    },
    getFilesSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        relativePath?: string;
        files: DialFile[];
      }>,
    ) => {
      state.files = payload.files.concat(
        state.files.filter(
          (file) => file.relativePath !== payload.relativePath,
        ),
      );
      state.filesStatus = 'LOADED';
    },
    getFilesFail: (state) => {
      state.filesStatus = 'FAILED';
    },
    getFolders: (
      state,
      {
        payload,
      }: PayloadAction<{
        path?: string;
      }>,
    ) => {
      state.newAddedFolderId = undefined;
      state.foldersStatus = 'LOADING';
      state.loadingFolder = payload.path;
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
      }>,
    ) => {
      state.loadingFolder = undefined;
      state.foldersStatus = 'LOADED';
      state.folders = payload.folders.concat(
        state.folders.filter(
          (folder) =>
            !payload.folders.some(
              (payloadFolder) => payloadFolder.id === folder.id,
            ),
        ),
      );
    },
    getFoldersFail: (state) => {
      state.loadingFolder = undefined;
      state.foldersStatus = 'FAILED';
    },
    getFilesWithFolders: (
      state,
      _action: PayloadAction<{
        path?: string;
      }>,
    ) => state,
    addNewFolder: (
      state,
      {
        payload,
      }: PayloadAction<{
        relativePath?: string;
      }>,
    ) => {
      const folderName = getAvailableNameOnSameFolderLevel(
        state.folders,
        'New folder',
        payload.relativePath,
      );

      const folderId = getPathNameId(folderName, payload.relativePath);
      state.folders.push({
        id: folderId,
        name: folderName,
        type: FolderType.File,
        folderId: payload.relativePath,
      });
      state.newAddedFolderId = folderId;
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

        const oldFolderIdPath = folder.id.slice(
          0,
          folder.id.length - folder.name.length,
        );
        return {
          ...folder,
          name: payload.newName.trim(),
          id: getPathNameId(payload.newName, oldFolderIdPath),
        };
      });
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
  },
});

const rootSelector = (state: RootState): FilesState => state.files;

const selectFiles = createSelector([rootSelector], (state) => {
  return [...state.files].sort((a, b) =>
    a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1,
  );
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

const selectFolders = createSelector([rootSelector], (state) => {
  return [...state.folders].sort((a, b) =>
    a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1,
  );
});
const selectFoldersStatus = createSelector([rootSelector], (state) => {
  return state.foldersStatus;
});
const selectLoadingFolderId = createSelector([rootSelector], (state) => {
  return state.loadingFolder;
});
const selectNewAddedFolderId = createSelector([rootSelector], (state) => {
  return state.newAddedFolderId;
});

export const FilesSelectors = {
  selectFiles,
  selectSelectedFilesIds,
  selectSelectedFiles,
  selectFolders,
  selectFoldersStatus,
  selectLoadingFolderId,
  selectNewAddedFolderId,
  selectFilesByIds,
};

export const FilesActions = filesSlice.actions;
