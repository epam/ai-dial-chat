import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import {
  addTrailingSlashIfAbsent,
  combineEntities,
} from '@/src/utils/app/common';
import {
  constructPath,
  getFileWithType,
  getNestedEmptyFolderIdsForChosenParent,
  isPathUnderPrefix,
  removeTrailingSlash,
} from '@/src/utils/app/file';
import {
  addGeneratedFolderId,
  getEmptyLeafFolderIds,
  getFolderFromId,
  getParentFolderIdsFromFolderId,
  getPartialAndFullyChosenFolders,
  getSelectedEntitiesByFolderId,
  getStorageSafeUniqueFolderName,
  renameFolderAndMoveEntity,
  updateMovedEntityId,
  updateMovedFolderId,
} from '@/src/utils/app/folders';
import {
  getEntityBucket,
  getFileRootId,
  isFolderId,
  isMyEntity,
  isRootId,
} from '@/src/utils/app/id';

import {
  FeatureType,
  MappedReplaceActions,
  MoveModel,
} from '@/src/types/common';
import {
  DialFile,
  FileFolderInterface,
  FileOperationsResult,
} from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import { HTTPMethod } from '@/src/types/http';

import { CLIENTDATA_PATH } from '@/src/constants/client-data';

import { FilesState, UploadReplaceDialogState } from './files.types';

import { SharePermission, UploadStatus } from '@epam/ai-dial-shared';
import {
  DialCopiedItem,
  DialDeletedItem,
  DialFileNodeType,
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

const invalidateSearchCacheForFolder = (
  state: FilesState,
  folderId: string,
) => {
  if (state.searchListingMetadata[folderId]) {
    delete state.searchListingMetadata[folderId];
  }
  invalidateSearchCacheForFile(state, folderId);
};

const initialState: FilesState = {
  initialized: false,
  files: [],
  folders: [],
  selectedFilesIds: [],
  sharedFileIds: [],
  sharedFolderIds: [],

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
  sharedWithMeFilesAndFoldersIds: [],
  localFileSizeCache: {},
  uploadReplaceDialog: null,
  resolvedUploadIds: null,
};

export const filesSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    init: (state) => state,
    initFinish: (state) => {
      state.initialized = true;
    },
    initFileSizeCache: (
      state,
      { payload }: PayloadAction<Record<string, number>>,
    ) => {
      state.localFileSizeCache = payload;
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
        httpMethod?: HTTPMethod;
        showSuccessMessage?: boolean;
        isFromDeviceAttachment?: boolean;
      }>,
    ) => {
      state.files = state.files.filter((file) => file.id !== payload.id);
      const fileContent = getFileWithType(payload.fileContent);
      state.files.push({
        id: payload.id,
        name: payload.name,
        relativePath: payload.relativePath,
        folderId: constructPath(getFileRootId(), payload.relativePath),

        status: UploadStatus.LOADING,
        percent: 0,
        fileContent,
        contentLength: payload.fileContent.size,
        contentType: fileContent.type,
        ...(payload.isFromDeviceAttachment && {
          isFromDeviceAttachment: true,
        }),
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
        if (file.id === payload.apiResult.id) {
          delete state.localFileSizeCache[file.id];
          return {
            ...payload.apiResult,
            contentLength:
              payload.apiResult.contentLength || file.contentLength,
            contentType: payload.apiResult.contentType || file.contentType,
            isFromDeviceAttachment: file.isFromDeviceAttachment,
          };
        }
        return file;
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
        const cachedSize = state.localFileSizeCache[newFile.id];
        if (newFile.contentLength) {
          delete state.localFileSizeCache[newFile.id];
        }

        const oldFile = prevById[newFile.id];
        if (!oldFile) {
          return {
            ...newFile,
            contentLength: newFile.contentLength || cachedSize,
          };
        }

        const merged: DialFile = {
          ...oldFile,
          ...newFile,
          contentLength:
            newFile.contentLength || oldFile.contentLength || cachedSize,
        };

        return merged;
      });

      const otherFiles = state.files.filter(
        (f) => !payload.foldersSet.has(f.folderId),
      );

      state.files = [...mergedMappedFiles, ...otherFiles];
      state.filesStatus = UploadStatus.LOADED;

      if (!isRootId(parentFolderId)) {
        const parentFolder = getFolderFromId(
          parentFolderId,
          FeatureType.File,
          UploadStatus.LOADED,
        );

        const parentFolderWithPermissions: FileFolderInterface = {
          ...parentFolder,
          ...(isMyEntity({ id: parentFolder.id }) && {
            permissions: [SharePermission.WRITE, SharePermission.READ],
          }),
        };

        state.folders = combineEntities(
          [parentFolderWithPermissions],
          state.folders,
        );
      }

      const idsToReselect = state.chosenEmptyFoldersIds.reduce<{
        folderIds: string[];
        fileIds: string[];
      }>(
        (acc, folderId) => {
          const prefix = addTrailingSlashIfAbsent(folderId);
          const fileIds = payload.files
            .filter(({ id }) => id.startsWith(prefix))
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
        paths?: string[];
        autoChoseFiles?: boolean;
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
        fromCache?: boolean;
      }>,
    ) => {
      state.isLoadingSearchListing = false;

      if (payload.fromCache) {
        return;
      }

      const folderPath = payload.folderPath;

      if (payload.files.length > 0) {
        const freshFileIds = new Set(
          payload.files
            .filter((f) => !f.folderId.endsWith(`/${CLIENTDATA_PATH}`))
            .map((f) => f.id),
        );
        const outsideFiles = state.files.filter(
          (f) =>
            f.folderId !== folderPath &&
            !f.folderId.startsWith(`${folderPath}/`),
        );
        const inScopeFiles = payload.files.filter(
          (f) => !f.folderId.endsWith(`/${CLIENTDATA_PATH}`),
        );
        const uploadingInScope = state.files.filter(
          (f) =>
            !f.serverSynced &&
            (f.folderId === folderPath ||
              f.folderId.startsWith(`${folderPath}/`)) &&
            !freshFileIds.has(f.id),
        );

        state.files = [...outsideFiles, ...inScopeFiles, ...uploadingInScope];

        const existingFolderIds = new Set(state.folders.map((f) => f.id));
        const newFolders = uniq(
          inScopeFiles.flatMap((f) =>
            getParentFolderIdsFromFolderId(f.folderId),
          ),
        )
          .filter((id) => !existingFolderIds.has(id))
          .map((id) => getFolderFromId(id, FeatureType.File));

        if (newFolders.length > 0) {
          state.folders = [...state.folders, ...newFolders];
        }
      } else {
        state.files = state.files.filter(
          (f) =>
            f.folderId !== folderPath &&
            !f.folderId.startsWith(`${folderPath}/`),
        );
      }

      state.searchListingMetadata[payload.folderPath] = {
        loadedAt: Date.now(),
        isFullyLoaded: true,
        folderPath: payload.folderPath,
      };
    },
    getFullListingFail: (
      state,
      _action: PayloadAction<{ traceId?: string } | undefined>,
    ) => {
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
        (f) =>
          f.folderId !== payload.folderId ||
          incomingIds.has(f.id) ||
          f.temporary,
      );

      const sharedFolderIdSet = new Set(state.sharedFolderIds);
      const foldersWithSharedFlag = payload.folders.map((folder) =>
        sharedFolderIdSet.has(folder.id)
          ? { ...folder, isShared: true }
          : folder,
      );

      state.folders = combineEntities(
        foldersWithSharedFlag,
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
        skipShareListingsRefresh?: boolean;
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
      const parentId = payload.parentId ?? rootFileId;
      const folderName = getStorageSafeUniqueFolderName({
        folderId: parentId,
        existingNames: state.folders
          .filter((folder) => folder.folderId === parentId) // only folders on the same level
          .map((folder) => folder.name),
      });

      const newAddedFolderId = constructPath(payload.parentId, folderName);
      state.folders.push(
        addGeneratedFolderId({
          name: folderName,
          type: FeatureType.File,
          folderId: payload.parentId || getFileRootId(),
          status: UploadStatus.LOADED,
          temporary: true,
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
      const existingIds = new Set(state.folders.map((f) => f.id));
      const newFolders = payload.folders.filter((f) => !existingIds.has(f.id));
      if (newFolders.length === 0) return;
      state.folders = state.folders.concat(newFolders);
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
      invalidateSearchCacheForFolder(state, payload.folderId);
      invalidateSearchCacheForFolder(state, newFolderId);
    },
    renameFolderSuccess: (
      state,
      _action: PayloadAction<{ oldId: string; newId: string }>,
    ) => state,
    renameFolderFail: (
      state,
      {
        payload,
      }: PayloadAction<{ oldId: string; newId: string; traceId?: string }>,
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
    updateFolder: (
      state,
      {
        payload,
      }: PayloadAction<{
        folderId: string;
        values: Partial<FolderInterface>;
      }>,
    ) => {
      state.folders = state.folders.map((folder) => {
        if (folder.id === payload.folderId) {
          return {
            ...folder,
            ...payload.values,
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
    setSharedFolderIds: (
      state,
      {
        payload,
      }: PayloadAction<{
        ids: string[];
      }>,
    ) => {
      const prevSet = new Set(state.sharedFolderIds);
      const nextSet = new Set(payload.ids);
      state.sharedFolderIds = payload.ids;
      state.folders = state.folders.map((folder) => {
        if (nextSet.has(folder.id)) {
          return { ...folder, isShared: true };
        }
        if (prevSet.has(folder.id) && !nextSet.has(folder.id)) {
          return { ...folder, isShared: false };
        }
        return folder;
      });
    },
    addSharedFiles: (
      state,
      {
        payload,
      }: PayloadAction<{ files: DialFile[]; reviewBuckets?: string[] }>,
    ) => {
      const sharedWithMeRootIds = new Set(state.sharedWithMeFilesAndFoldersIds);
      const belongsToActiveSharedRoot = (file: DialFile) =>
        Array.from(sharedWithMeRootIds).some((rootId) =>
          file.id.startsWith(`${rootId}/`),
        );

      // Keep nested shared descendants under active roots, but always replace root shared items
      // with latest API payload to avoid stale root-level data after tab switches.
      const filteredFiles = state.files.filter((file) => {
        if (!file.sharedWithMe) {
          return true;
        }

        if (
          payload.reviewBuckets?.some(
            (reviewBucket) => getEntityBucket(file) === reviewBucket,
          )
        ) {
          return true;
        }

        if (file.isRootSharedItem) {
          return false;
        }

        return belongsToActiveSharedRoot(file);
      });
      state.files = combineEntities(payload.files, filteredFiles);
    },
    resetAllFoldersStatus: (state) => {
      state.folders = state.folders.map((folder) => ({
        ...folder,
        status: UploadStatus.UNINITIALIZED,
        serverSynced: false,
      }));
    },

    addChosenFiles: (state, { payload }: PayloadAction<{ ids: string[] }>) => {
      state.chosenFileIds = uniq(state.chosenFileIds.concat(payload.ids));
    },
    removeChosenFiles: (
      state,
      { payload }: PayloadAction<{ ids: string[] }>,
    ) => {
      state.chosenFileIds = state.chosenFileIds.filter(
        (id) => !payload.ids.includes(id),
      );
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

    addChosenFolder: (
      state,
      { payload }: PayloadAction<{ folderId: string }>,
    ) => {
      const { folderId } = payload;
      const emptyFolderIds = getEmptyLeafFolderIds(state.folders, state.files);

      if (emptyFolderIds.includes(folderId)) {
        state.chosenEmptyFoldersIds = uniq([
          ...state.chosenEmptyFoldersIds,
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
      const affectedFileIds = getSelectedEntitiesByFolderId({
        entities: state.files,
        folderId,
        partialChosenFolderIds,
        chosenItemsIds: state.chosenFileIds,
      });
      const nestedEmptyFolderChosenIds = getNestedEmptyFolderIdsForChosenParent(
        emptyFolderIds,
        folderId,
      );

      state.chosenFileIds = uniq([...state.chosenFileIds, ...affectedFileIds]);
      state.chosenEmptyFoldersIds = uniq([
        ...state.chosenEmptyFoldersIds,
        ...nestedEmptyFolderChosenIds,
      ]);
    },
    removeChosenFolder: (
      state,
      { payload }: PayloadAction<{ folderId: string }>,
    ) => {
      const { folderId } = payload;
      const emptyFolderIds = getEmptyLeafFolderIds(state.folders, state.files);

      if (emptyFolderIds.includes(folderId)) {
        state.chosenEmptyFoldersIds = state.chosenEmptyFoldersIds.filter(
          (id) => id !== folderId,
        );
        return;
      }

      const { partialChosenFolderIds } = getPartialAndFullyChosenFolders(
        state.folders,
        state.files,
        state.chosenFileIds,
        emptyFolderIds,
        state.chosenEmptyFoldersIds,
      );
      const fileIdsToRemove = getSelectedEntitiesByFolderId({
        entities: state.files,
        folderId,
        partialChosenFolderIds,
        chosenItemsIds: state.chosenFileIds,
      });

      const emptyFolderIdsToRemove = getNestedEmptyFolderIdsForChosenParent(
        emptyFolderIds,
        folderId,
      );

      state.chosenFileIds = state.chosenFileIds.filter(
        (id) => !fileIdsToRemove.includes(id),
      );
      state.chosenEmptyFoldersIds = state.chosenEmptyFoldersIds.filter(
        (id) => id !== folderId && !emptyFolderIdsToRemove.includes(id),
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
      {
        payload,
      }: PayloadAction<{
        result: FileOperationsResult<MoveModel>;
        request: {
          files: DialCopiedItem[];
          sourceFolder?: string;
          destinationFolder: string;
        };
      }>,
    ) => {
      state.isCopyingFiles = false;
      invalidateSearchCacheForFolder(state, payload.request.destinationFolder);
      if (payload.request.sourceFolder) {
        invalidateSearchCacheForFolder(state, payload.request.sourceFolder);
      }
      payload.result.results.forEach((file) => {
        invalidateSearchCacheForFile(state, file.data.destinationUrl);
      });
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
      {
        payload,
      }: PayloadAction<{
        files: DialCopiedItem[];
        sourceFolder: string;
        destinationFolder: string;
      }>,
    ) => {
      state.isMovingFiles = true;

      const movedFoldersSourceUrls = payload.files
        .filter((f) => f.nodeType === DialFileNodeType.FOLDER)
        .map((f) => f.sourceUrl);

      state.files = state.files.filter(
        (f) =>
          !movedFoldersSourceUrls.some((sourceUrl) =>
            f.folderId.startsWith(sourceUrl),
          ),
      );

      state.folders = state.folders.filter(
        (f) =>
          !movedFoldersSourceUrls.some((sourceUrl) =>
            f.folderId.startsWith(sourceUrl),
          ),
      );
    },
    moveFilesSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        result: FileOperationsResult<MoveModel>;
        request: {
          files: DialCopiedItem[];
          sourceFolder: string;
          destinationFolder: string;
        };
      }>,
    ) => {
      state.isMovingFiles = false;
      const movedFileSourceUrls = new Set(
        payload.request.files
          .filter((f) => f.nodeType !== DialFileNodeType.FOLDER)
          .map((f) => f.sourceUrl),
      );

      if (movedFileSourceUrls.size > 0) {
        state.files = state.files.filter((f) => !movedFileSourceUrls.has(f.id));
      }

      invalidateSearchCacheForFolder(state, payload.request.sourceFolder);
      invalidateSearchCacheForFolder(state, payload.request.destinationFolder);
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
        request: {
          files: DialDeletedItem[];
          folderUrl: string;
        };
      }>,
    ) => {
      state.isDeletingFiles = false;
      payload.deletedItems.forEach((file) => {
        invalidateSearchCacheForFile(state, file.sourceUrl);
      });

      const succeededFileIds = new Set(
        payload.result.results.map((r) => removeTrailingSlash(r.data)),
      );
      const deletedFolderPrefixes = payload.request.files
        .filter((item) => item.nodeType === DialFileNodeType.FOLDER)
        .map((item) => removeTrailingSlash(item.sourceUrl));
      const fullBatchSuccess = payload.result.failed === 0;

      const isUnderDeletedFolderTree = (entityId: string) => {
        const id = removeTrailingSlash(entityId);
        if (!fullBatchSuccess || deletedFolderPrefixes.length === 0) {
          return false;
        }
        return deletedFolderPrefixes.some((p) => isPathUnderPrefix(id, p));
      };

      const fileShouldBeRemoved = (file: DialFile) => {
        const id = removeTrailingSlash(file.id);
        const folderId = removeTrailingSlash(file.folderId);
        if (succeededFileIds.has(id)) {
          return true;
        }
        if (!fullBatchSuccess) {
          return false;
        }
        return deletedFolderPrefixes.some(
          (p) => isPathUnderPrefix(id, p) || isPathUnderPrefix(folderId, p),
        );
      };

      const folderShouldBeRemoved = (folder: FileFolderInterface) => {
        const id = removeTrailingSlash(folder.id);
        const parentFolderId = removeTrailingSlash(folder.folderId);
        if (succeededFileIds.has(id)) {
          return true;
        }
        if (!fullBatchSuccess) {
          return false;
        }
        return deletedFolderPrefixes.some(
          (p) =>
            isPathUnderPrefix(id, p) || isPathUnderPrefix(parentFolderId, p),
        );
      };

      state.files = state.files.filter((f) => !fileShouldBeRemoved(f));
      state.folders = state.folders.filter((f) => !folderShouldBeRemoved(f));

      const selectionIdRemoved = (rawId: string) => {
        const id = removeTrailingSlash(rawId);
        if (succeededFileIds.has(id)) {
          return true;
        }
        return isUnderDeletedFolderTree(id);
      };

      state.chosenFileIds = state.chosenFileIds.filter(
        (id) => !selectionIdRemoved(id),
      );
      state.chosenEmptyFoldersIds = state.chosenEmptyFoldersIds.filter(
        (id) => !selectionIdRemoved(id),
      );
      state.selectedFilesIds = state.selectedFilesIds.filter(
        (id) => !selectionIdRemoved(id),
      );
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

    createNewFolder: (
      state,
      _action: PayloadAction<{
        files: DialUploadFileItem[];
        destinationUrl: string;
      }>,
    ) => {
      state.isUploadingFiles = true;
    },

    uploadFiles: (
      state,
      {
        payload,
      }: PayloadAction<{
        files: DialUploadFileItem[];
        destinationUrl: string;
      }>,
    ) => {
      state.isUploadingFiles = true;

      const urlParts = payload.destinationUrl.split('/');
      const bucket = urlParts.length > 1 ? urlParts[1] : undefined;
      const relativePath =
        urlParts.length > 2 ? urlParts.slice(2).join('/') : undefined;

      payload.files.forEach((file) => {
        const id = constructPath(
          getFileRootId(bucket),
          relativePath,
          file.name,
        );
        state.files = state.files.filter((f) => f.id !== id);

        const fileContent = getFileWithType(file.fileContent);
        state.files.push({
          id,
          name: file.name,
          relativePath,
          folderId: constructPath(getFileRootId(bucket), relativePath),
          status: UploadStatus.LOADING,
          percent: 0,
          fileContent,
          contentLength: file.fileContent.size,
          contentType: fileContent.type,
        });

        if (file.fileContent.size) {
          state.localFileSizeCache[id] = file.fileContent.size;
        }
      });
    },

    uploadFilesSuccess: (state) => {
      state.isUploadingFiles = false;
    },
    uploadFilesFail: (state) => {
      state.files = state.files.filter((f) => f.status !== UploadStatus.FAILED);
      state.isUploadingFiles = false;
    },
    cancelUploadFiles: (state, { payload }: PayloadAction<Set<string>>) => {
      const uploadingIds = payload;

      state.files = state.files.filter(
        (f) => !uploadingIds.has(f.id) || f.status !== UploadStatus.LOADING,
      );

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

    setSharedWithMeFilesAndFoldersIds: (
      state,
      { payload }: PayloadAction<{ ids: string[] }>,
    ) => {
      state.sharedWithMeFilesAndFoldersIds = payload.ids;
    },

    showUploadReplaceDialog: (
      state,
      { payload }: PayloadAction<Omit<UploadReplaceDialogState, 'isOpen'>>,
    ) => {
      state.uploadReplaceDialog = {
        ...payload,
        isOpen: true,
      };
    },
    cancelUploadReplaceDialog: (state) => {
      state.uploadReplaceDialog = null;
    },
    continueUploadReplaceDialog: (
      state,
      { payload }: PayloadAction<{ mappedActions: MappedReplaceActions }>,
    ) => {
      if (state.uploadReplaceDialog) {
        state.uploadReplaceDialog.isOpen = false;
        state.uploadReplaceDialog.mappedActions = payload.mappedActions;
      }
    },
    clearUploadReplaceDialog: (state) => {
      state.uploadReplaceDialog = null;
    },
    setResolvedUploadIds: (
      state,
      { payload }: PayloadAction<{ ids: string[] }>,
    ) => {
      state.resolvedUploadIds = payload.ids;
    },
    clearResolvedUploadIds: (state) => {
      state.resolvedUploadIds = null;
    },
  },
});

export const FilesActions = filesSlice.actions;
