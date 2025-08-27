import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import {
  addTrailingSlashIfAbsent,
  combineEntities,
} from '@/src/utils/app/common';
import { constructPath } from '@/src/utils/app/file';
import {
  addGeneratedFolderId,
  getNextDefaultName,
  getPartialAndFullyChosenFolders,
  isFolderEmpty,
  renameFolderAndMoveEntity,
  updateMovedEntityId,
  updateMovedFolderId,
} from '@/src/utils/app/folders';
import { getFileRootId, isFolderId } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { DialFile, FileFolderInterface } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';

import { FilesState } from './files.types';

import { UploadStatus } from '@epam/ai-dial-shared';
import isEqual from 'lodash-es/isEqual';
import uniq from 'lodash-es/uniq';
import xor from 'lodash-es/xor';

const initialState: FilesState = {
  initialized: false,
  files: [],
  folders: [],
  selectedFilesIds: [],
  sharedFileIds: [],

  chosenFileIds: [],
  chosenEmptyFoldersIds: [],

  filesStatus: UploadStatus.UNINITIALIZED,
  foldersStatus: UploadStatus.UNINITIALIZED,
};

export const filesSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    init: (state) => state,
    initFinish: (state) => {
      state.initialized = true;
    },
    uploadFile: (
      state,
      {
        payload,
      }: PayloadAction<{
        fileContent: File;
        id: string;
        relativePath?: string;
        name: string;
        bucket?: string;

        showSuccessMessage?: boolean;
      }>,
    ) => {
      state.files = state.files.filter((file) => file.id !== payload.id);
      state.files.push({
        id: payload.id,
        name: payload.name,
        relativePath: payload.relativePath,
        folderId: constructPath(getFileRootId(), payload.relativePath),

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
    resetSelectedFiles: (
      state,
      {
        payload,
      }: PayloadAction<
        undefined | { keepFiles?: boolean; keepFolders?: boolean }
      >,
    ) => {
      state.selectedFilesIds = state.selectedFilesIds.filter((id) => {
        if (
          (payload?.keepFolders && isFolderId(id)) ||
          (payload?.keepFiles && !isFolderId(id))
        ) {
          return true;
        }

        return false;
      });
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
        showSuccessMessage?: boolean;
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
        foldersSet: Set<string>;
      }>,
    ) => {
      const mappedFiles: DialFile[] = payload.files.map((file) =>
        state.sharedFileIds.includes(file.id)
          ? { ...file, isShared: true }
          : { ...file },
      );

      state.files = mappedFiles.concat(
        state.files.filter(
          (stateFile) =>
            //remove all files from loaded folder to have latest folder update
            !payload.foldersSet.has(stateFile.folderId),
        ),
      );
      state.filesStatus = UploadStatus.LOADED;

      const idsToReselect = state.chosenEmptyFoldersIds.reduce<{
        folderIds: string[];
        fileIds: string[];
      }>(
        (acc, folderId) => {
          const fileIds = payload.files
            .filter(({ id }) => id.startsWith(folderId))
            .map(({ id }) => id);

          if (fileIds.length) {
            return {
              folderIds: acc.folderIds.concat(folderId),
              fileIds: acc.fileIds.concat(fileIds),
            };
          }
          return acc;
        },
        { folderIds: [], fileIds: [] },
      );

      if (idsToReselect.folderIds.length) {
        state.chosenEmptyFoldersIds = xor(
          state.chosenEmptyFoldersIds,
          idsToReselect.folderIds,
        );
        state.chosenFileIds = xor(state.chosenFileIds, idsToReselect.fileIds);
      }
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

      const folderIdsToSelect = payload.folders
        .filter((f) =>
          state.chosenEmptyFoldersIds.some((id) => f.id.startsWith(id)),
        )
        .map(({ id }) => addTrailingSlashIfAbsent(id));

      state.chosenEmptyFoldersIds = xor(
        state.chosenEmptyFoldersIds,
        folderIdsToSelect,
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
      const rootFileId = getFileRootId();
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
          type: FeatureType.File,
          folderId: payload.parentId || getFileRootId(),
          status: UploadStatus.LOADED,
        }),
      );
      state.newAddedFolderId = newAddedFolderId;
    },
    setFolders: (
      state,
      { payload }: PayloadAction<{ folders: FolderInterface[] }>,
    ) => {
      state.folders = payload.folders;
    },
    addFolders: (
      state,
      { payload }: PayloadAction<{ folders: FolderInterface[] }>,
    ) => {
      state.folders = combineEntities(state.folders, payload.folders);
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

      const targetFolder = state.folders.find((f) => f.id === payload.folderId);

      if (!targetFolder) return;
      const newFolderId = constructPath(targetFolder.folderId, payload.newName);

      state.folders = state.folders.map((f) =>
        renameFolderAndMoveEntity(f, payload.folderId, newFolderId),
      );
      state.files = state.files.map((f) =>
        renameFolderAndMoveEntity(f, payload.folderId, newFolderId),
      );
      state.chosenFileIds = state.chosenFileIds.map((id) =>
        updateMovedEntityId(payload.folderId, newFolderId, id),
      );
      state.chosenEmptyFoldersIds = state.chosenEmptyFoldersIds.map((id) =>
        updateMovedFolderId(payload.folderId, newFolderId, id),
      );
      state.lastRenamedParentFolder = {
        newId: newFolderId,
        oldId: targetFolder.id,
      };
    },
    renameFolderSuccess: (
      state,
      _action: PayloadAction<{ oldId: string; newId: string }>,
    ) => state,
    renameFolderFail: (
      state,
      { payload }: PayloadAction<{ oldId: string; newId: string }>,
    ) => {
      state.folders = state.folders.map((f) =>
        renameFolderAndMoveEntity(f, payload.newId, payload.oldId),
      );
      state.files = state.files.map((f) =>
        renameFolderAndMoveEntity(f, payload.newId, payload.oldId),
      );
      state.chosenFileIds = state.chosenFileIds.map((id) =>
        updateMovedEntityId(payload.newId, payload.oldId, id),
      );
      state.chosenEmptyFoldersIds = state.chosenEmptyFoldersIds.map((id) =>
        updateMovedFolderId(payload.newId, payload.oldId, id),
      );
      state.lastRenamedParentFolder = {
        newId: payload.oldId,
        oldId: payload.newId,
      };
    },
    resetNewFolderId: (state) => {
      state.newAddedFolderId = undefined;
    },
    resetLastRenamedParentFolder: (state) => {
      state.lastRenamedParentFolder = undefined;
    },
    deleteFilesList: (
      state,
      _action: PayloadAction<{
        fileIds: string[];
      }>,
    ) => state,
    deleteFile: (
      state,
      _action: PayloadAction<{
        fileId: string;
      }>,
    ) => state,
    deleteFileSuccess: (
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
    deleteFileFail: (
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
    updateFoldersStatus: (
      state,
      {
        payload,
      }: PayloadAction<{
        foldersIds: (string | undefined)[];
        status: UploadStatus;
      }>,
    ) => {
      state.folders = state.folders.map((folder) => {
        if (payload.foldersIds.some((folderId) => folderId === folder.id)) {
          return {
            ...folder,
            status: payload.status,
          };
        }

        return folder;
      });
    },
    setSharedFileIds: (
      state,
      {
        payload,
      }: PayloadAction<{
        ids: string[];
      }>,
    ) => {
      state.sharedFileIds = payload.ids;
    },
    addSharedFiles: (
      state,
      { payload }: PayloadAction<{ files: DialFile[] }>,
    ) => {
      //remove sharedWithMe files from state to have latest state from API
      const filteredFiles = state.files.filter((file) => !file.sharedWithMe);
      state.files = combineEntities(payload.files, filteredFiles);
    },
    resetAllFoldersStatus: (state) => {
      state.folders = state.folders.map((folder) => ({
        ...folder,
        status: UploadStatus.UNINITIALIZED,
        serverSynced: false,
      }));
    },

    setChosenFiles: (state, { payload }: PayloadAction<{ ids: string[] }>) => {
      state.chosenFileIds = xor(state.chosenFileIds, payload.ids);
    },
    resetChosenFiles: (state) => {
      state.chosenFileIds = [];
      state.chosenEmptyFoldersIds = [];
    },
    setChosenEmptyFolders: (
      state,
      { payload }: PayloadAction<{ ids: string[] }>,
    ) => {
      state.chosenEmptyFoldersIds = xor(
        state.chosenEmptyFoldersIds,
        payload.ids,
      );
    },
    // set initial files and folders ids clearing all previous selection
    setChosenFilesAndFolders: (
      state,
      { payload }: PayloadAction<{ ids: string[] }>,
    ) => {
      const folderIds = payload.ids.filter(isFolderId);
      const fileIds = payload.ids.filter((id) => !isFolderId(id));

      const emptyFolderIds = folderIds.filter(
        (id) => !state.files.some((f) => f.id.startsWith(id)),
      );
      const fileIdsToSelect = [
        ...fileIds,
        ...state.files
          .filter(({ id }) =>
            folderIds.some((folderId) => id.startsWith(folderId)),
          )
          .map(({ id }) => id),
      ];

      if (
        isEqual(emptyFolderIds, state.chosenEmptyFoldersIds) &&
        isEqual(state.chosenFileIds, fileIdsToSelect)
      ) {
        return;
      }

      state.chosenEmptyFoldersIds = emptyFolderIds;
      state.chosenFileIds = fileIdsToSelect;
    },
    setChosenFolder: (
      state,
      { payload }: PayloadAction<{ folderId: string }>,
    ) => {
      const { folderId } = payload;
      const emptyFolderIds = state.folders
        .filter(({ id }) =>
          isFolderEmpty({ id, folders: state.folders, entities: state.files }),
        )
        .map(({ id }) => id);

      if (emptyFolderIds.includes(folderId)) {
        state.chosenEmptyFoldersIds = xor(state.chosenEmptyFoldersIds, [
          folderId,
        ]);
        return;
      }

      const { partialChosenFolderIds } = getPartialAndFullyChosenFolders(
        state.folders,
        state.files,
        state.chosenFileIds,
        emptyFolderIds,
        state.chosenEmptyFoldersIds,
      );
      const newChosenFileIds = state.files
        .filter(
          (file) =>
            file.id.startsWith(folderId) &&
            (!partialChosenFolderIds.includes(folderId) ||
              !state.chosenFileIds.includes(file.id)),
        )
        .map(({ id }) => id);
      const newChosenEmptyFolderIds = emptyFolderIds
        .filter((id) => `${id}/`.startsWith(folderId))
        .map((id) => `${id}/`);

      state.chosenFileIds = xor(state.chosenFileIds, newChosenFileIds);
      state.chosenEmptyFoldersIds = xor(
        state.chosenEmptyFoldersIds,
        newChosenEmptyFolderIds,
      );
    },
  },
});

export const FilesActions = filesSlice.actions;
