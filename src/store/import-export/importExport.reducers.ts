import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { Status } from '@/src/types/files';
import {
  LatestExportFormat,
  Operation,
  SupportedExportFormats,
} from '@/src/types/importExport';

import { RootState } from '..';

interface UploadedAttachment {
  name: string;
  id: string;
  // Only for files fetched uploaded to backend
  // Same as relative path but has some absolute prefix like <HASH>
  absolutePath?: string;
  relativePath?: string;
  // Same as relative path, but needed for simplicity and backward compatibility
  folderId?: string;

  status?: 'UPLOADING' | 'FAILED';
  percent?: number;
}
export interface AttachmentToUpload {
  fileContent: Blob;
  id: string;
  relativePath: string;
  name: string;
}

interface ImportExportState {
  attachmentsIdsToUpload: string[];
  uploadedAttachments: UploadedAttachment[];
  importedHistory: LatestExportFormat;
  attachmentsErrors: string[];
  status?: Status;
  operation?: Operation;
}
const defaultImportedHistory: LatestExportFormat = {
  version: 4,
  history: [],
  folders: [],
  prompts: [],
};
const initialState: ImportExportState = {
  attachmentsIdsToUpload: [],
  uploadedAttachments: [],
  importedHistory: defaultImportedHistory,
  attachmentsErrors: [],
};

export const importExportSlice = createSlice({
  name: 'importExport',
  initialState,
  reducers: {
    resetState: (state) => {
      state.status = undefined;
      state.attachmentsIdsToUpload = [];
      state.uploadedAttachments = [];
      state.importedHistory = defaultImportedHistory;
      state.attachmentsErrors = [];
      state.operation = undefined;
    },
    exportConversation: (
      state,
      _action: PayloadAction<{
        conversationId: string;
        withAttachments?: boolean;
      }>,
    ) => {
      state.status = 'LOADING';
      state.operation = Operation.Exporting;
    },
    exportConversationSuccess: (state) => state,
    exportConversations: (state) => state,
    exportCancel: (state) => state,
    exportFail: (state) => {
      state.status = undefined;
    },
    importConversations: (
      state,
      _action: PayloadAction<{ data: SupportedExportFormats }>,
    ) => {
      state.status = 'LOADING';
      state.operation = Operation.Importing;
    },
    importZipConversations: (
      state,
      _action: PayloadAction<{ zipFile: File }>,
    ) => {
      state.status = 'LOADING';
      state.operation = Operation.Importing;
    },
    importStop: (state) => state,
    importConversationsSuccess: (state) => state,
    importFail: (state) => state,
    uploadConversationAttachments: (
      state,
      {
        payload,
      }: PayloadAction<{
        attachmentsToUpload: AttachmentToUpload[];
        completeHistory: LatestExportFormat;
      }>,
    ) => {
      state.attachmentsIdsToUpload = payload.attachmentsToUpload.map(
        ({ id }) => id,
      );
      state.importedHistory = payload.completeHistory;
    },
    uploadSingleAttachmentSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        apiResult: UploadedAttachment;
      }>,
    ) => {
      state.uploadedAttachments = state.uploadedAttachments.concat(
        payload.apiResult,
      );
    },
    uploadSingleFileFail: (
      state,
      {
        payload,
      }: PayloadAction<{
        id: string;
      }>,
    ) => {
      state.attachmentsErrors = state.attachmentsErrors.concat(payload.id);
    },
  },
});

const rootSelector = (state: RootState): ImportExportState =>
  state.importExport;

const selectAttachmentsIdsToUpload = createSelector([rootSelector], (state) => {
  return state.attachmentsIdsToUpload;
});
const selectUploadedAttachments = createSelector([rootSelector], (state) => {
  return state.uploadedAttachments;
});

const selectAttachmentsErrors = createSelector([rootSelector], (state) => {
  return state.attachmentsErrors;
});

const selectImportedHistory = createSelector([rootSelector], (state) => {
  return state.importedHistory;
});

const selectImportStatus = createSelector([rootSelector], (state) => {
  return state.status;
});

const selectOperationName = createSelector([rootSelector], (state) => {
  return state.operation;
});

const selectIsLoadingImportExport = createSelector([rootSelector], (state) => {
  return state.status === 'LOADING';
});

export const ImportExportSelectors = {
  selectAttachmentsIdsToUpload,
  selectUploadedAttachments,
  selectAttachmentsErrors,
  selectImportedHistory,
  selectImportStatus,
  selectOperationName,
  selectIsLoadingImportExport,
};

export const ImportExportActions = importExportSlice.actions;
