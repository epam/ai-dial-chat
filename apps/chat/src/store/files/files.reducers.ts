import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import {
  addTrailingSlashIfAbsent,
  combineEntities,
} from '@/src/utils/app/common';
import { constructPath } from '@/src/utils/app/file';
import {
  addGeneratedFolderId,
  getFolderFromId,
  getNextDefaultName,
  getPartialAndFullyChosenFolders,
  isFolderEmpty,
  renameFolderAndMoveEntity,
  updateMovedEntityId,
  updateMovedFolderId,
} from '@/src/utils/app/folders';
import { getFileRootId, isFolderId, isRootId } from '@/src/utils/app/id';

import { FeatureType, MoveModel } from '@/src/types/common';
import {
  DialFile,
  FileFolderInterface,
  FileOperationsResult,
} from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';

import { FilesState } from './files.types';

import { UploadStatus } from '@epam/ai-dial-shared';
import {
  DialCopiedItem,
  DialDeletedItem,
  DialUploadFileItem,
  DialFile as UIKitDialFile,
} from '@epam/ai-dial-ui-kit';
import isEqual from 'lodash-es/isEqual';
import uniq from 'lodash-es/uniq';
import xor from 'lodash-es/xor';

const invalidateSearchCacheForFile = (state: FilesState, fileId: string) => {
  const parts = fileId.split('/');

  for (let i = parts.length - 1; i >= 0; i--) {
    const folderPath = parts.slice(0, i).join('/');
    if (folderPath && state.searchListingMetadata[folderPath]) {
      delete state.searchListingMetadata[folderPath];
    }
  }
};

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

  loadingFileMetadata: false,
  fileMetadata: null,

  isCopyingFiles: false,
  isMovingFiles: false,
  isDeletingFiles: false,
  isDownloadingArchive: false,
  isUploadingFiles: false,
  isUploadingArchive: false,
  copyingFilesSignal: new AbortController(),
  movingFilesSignal: new AbortController(),

  isLoadingSearchListing: false,
  searchListingMetadata: {},
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
      invalidateSearchCacheForFile(state, payload.apiResult.id);
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
      const parentFolderId = Array.from(payload.foldersSet)[0];
      const mappedFiles: DialFile[] = payload.files.map((file) =>
        state.sharedFileIds.includes(file.id)
          ? { ...file, isShared: true }
          : { ...file },
      );

      const prevById: Record<string, DialFile> = Object.fromEntries(
        state.files.map((f) => [f.id, f]),
      );

      const mergedMappedFiles: DialFile[] = mappedFiles.map((newFile) => {
        const oldFile = prevById[newFile.id];
        if (!oldFile) return newFile;

        const merged: DialFile = {
          ...oldFile,
          ...newFile,
        };

        return merged;
      });

      const otherFiles = state.files.filter(
        (f) => !payload.foldersSet.has(f.folderId),
      );

      state.files = [...mergedMappedFiles, ...otherFiles];
      state.filesStatus = UploadStatus.LOADED;

      if (!isRootId(parentFolderId)) {
        state.folders = combineEntities(
          [
            getFolderFromId(
              parentFolderId,
              FeatureType.File,
              UploadStatus.LOADED,
            ),
          ],
          state.folders,
        );
      }

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
    getFileMetadata: (
      state,
      _action: PayloadAction<{
        fileId: string;
      }>,
    ) => {
      state.loadingFileMetadata = true;
      state.fileMetadata = null;
    },
    getFileMetadataSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        metadata: UIKitDialFile;
      }>,
    ) => {
      state.loadingFileMetadata = false;
      state.fileMetadata = payload.metadata as UIKitDialFile;
    },
    getFileMetadataFail: (state) => {
      state.loadingFileMetadata = false;
      state.fileMetadata = null;
    },
    clearFileMetadata: (state) => {
      state.loadingFileMetadata = false;
      state.fileMetadata = null;
    },
    getFullListing: (
      state,
      _action: PayloadAction<{
        folderPath?: string;
      }>,
    ) => {
      state.isLoadingSearchListing = true;
    },
    getFullListingSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        folderPath: string;
        files: DialFile[];
      }>,
    ) => {
      state.isLoadingSearchListing = false;

      const existingFileIds = new Set(state.files.map((f) => f.id));
      const newFiles = payload.files.filter((f) => !existingFileIds.has(f.id));

      if (newFiles.length > 0) {
        state.files = [...state.files, ...newFiles];
      }

      state.searchListingMetadata[payload.folderPath] = {
        loadedAt: Date.now(),
        isFullyLoaded: true,
        folderPath: payload.folderPath,
      };
    },
    getFullListingFail: (state) => {
      state.isLoadingSearchListing = false;
    },
    invalidateSearchCache: (
      state,
      {
        payload,
      }: PayloadAction<{
        bucketRootId?: string;
      }>,
    ) => {
      if (payload.bucketRootId) {
        delete state.searchListingMetadata[payload.bucketRootId];
      } else {
        state.searchListingMetadata = {};
      }
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

      const incomingIds = new Set(payload.folders.map((f) => f.id));
      const filteredState = state.folders.filter(
        (f) => f.folderId !== payload.folderId || incomingIds.has(f.id),
      );

      state.folders = combineEntities(
        payload.folders,
        filteredState.map((f) =>
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
      invalidateSearchCacheForFile(state, payload.fileId);
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

    copyFiles: (
      state,
      _action: PayloadAction<{
        files: DialCopiedItem[];
        destinationFolder: string;
      }>,
    ) => {
      state.isCopyingFiles = true;
    },
    copyFilesSuccess: (
      state,
      _action: PayloadAction<{
        result: FileOperationsResult<MoveModel>;
      }>,
    ) => {
      state.isCopyingFiles = false;
    },
    copyFilesFail: (
      state,
      _action: PayloadAction<{
        files: DialCopiedItem[];
        destinationFolder: string;
      }>,
    ) => {
      state.isCopyingFiles = false;
    },
    setCopyingFilesSignal: (
      state,
      action: PayloadAction<AbortController | null>,
    ) => {
      state.copyingFilesSignal = action.payload;
    },
    cancelCopyingFiles: (state) => {
      state.copyingFilesSignal?.abort();
      state.copyingFilesSignal = null;
      state.isCopyingFiles = false;
    },

    moveFiles: (
      state,
      _action: PayloadAction<{
        files: DialCopiedItem[];
        sourceFolder: string;
        destinationFolder: string;
      }>,
    ) => {
      state.isMovingFiles = true;
    },
    moveFilesSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        result: FileOperationsResult<MoveModel>;
      }>,
    ) => {
      state.isMovingFiles = false;
      payload.result.results.forEach((file) => {
        invalidateSearchCacheForFile(state, file.data.sourceUrl);
        invalidateSearchCacheForFile(state, file.data.destinationUrl);
      });
    },
    moveFilesFail: (
      state,
      _action: PayloadAction<{
        files: DialCopiedItem[];
      }>,
    ) => {
      state.isMovingFiles = false;
    },
    setMovingFilesSignal: (
      state,
      action: PayloadAction<AbortController | null>,
    ) => {
      state.movingFilesSignal = action.payload;
    },
    cancelMovingFiles: (state) => {
      state.movingFilesSignal?.abort();
      state.movingFilesSignal = null;
      state.isMovingFiles = false;
    },

    deleteFiles: (
      state,
      _action: PayloadAction<{
        files: DialDeletedItem[];
        folderUrl: string;
      }>,
    ) => {
      state.isDeletingFiles = true;
    },
    deleteFilesSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        deletedItems: DialDeletedItem[];
        result: FileOperationsResult<string>;
      }>,
    ) => {
      state.isDeletingFiles = false;
      payload.deletedItems.forEach((file) => {
        invalidateSearchCacheForFile(state, file.sourceUrl);
      });
    },
    deleteFilesFail: (
      state,
      _action: PayloadAction<{
        files: DialDeletedItem[];
      }>,
    ) => {
      state.isDeletingFiles = false;
    },

    downloadFilesAsArchive: (
      state,
      _action: PayloadAction<{
        files: UIKitDialFile[];
      }>,
    ) => {
      state.isDownloadingArchive = true;
    },

    downloadFilesAsArchiveSuccess: (state) => {
      state.isDownloadingArchive = false;
    },

    downloadFilesAsArchiveFail: (state) => {
      state.isDownloadingArchive = false;
    },

    uploadFiles: (
      state,
      _action: PayloadAction<{
        files: DialUploadFileItem[];
        destinationUrl: string;
      }>,
    ) => {
      state.isUploadingFiles = true;
    },
    uploadFilesSuccess: (state) => {
      state.isUploadingFiles = false;
    },
    uploadFilesFail: (state) => {
      state.isUploadingFiles = false;
    },

    uploadArchive: (
      state,
      {
        payload,
      }: PayloadAction<{
        archive: File;
        name: string;
        destinationUrl: string;
      }>,
    ) => {
      state.isUploadingArchive = true;
      invalidateSearchCacheForFile(state, payload.destinationUrl);
    },
    uploadArchiveSuccess: (state) => {
      state.isUploadingArchive = false;
    },
    uploadArchiveFail: (state) => {
      state.isUploadingArchive = false;
    },
  },
});

export const FilesActions = filesSlice.actions;
