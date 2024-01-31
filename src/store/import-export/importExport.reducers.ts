import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { Conversation } from '@/src/types/chat';
import { LatestExportFormat, SupportedExportFormats } from '@/src/types/export';
import { Status } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';

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
    },
    exportConversation: (
      state,
      _action: PayloadAction<{
        conversationId: string;
        withAttachments?: boolean;
      }>,
    ) => {
      state.status = 'LOADING';
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
    ) => state,
    importZipConversations: (
      state,
      _action: PayloadAction<{ zipFile: File }>,
    ) => {
      state.status = 'LOADING';
    },
    importStop: (state) => state,
    importConversationsSuccess: (state) => {
      state.status = undefined;
    },
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
    setUploadingAttachment: (
      state,
      _action: PayloadAction<{
        attachmentId: string;
      }>,
    ) => state,

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
    uploadAllAttachmentsSuccess: (
      state,
      _action: PayloadAction<{
        conversation: Conversation;
        folders: FolderInterface[];
        attachmentsIDs: string[];
      }>,
    ) => {
      state.status = 'LOADED';
    },
    uploadAllAttachmentsFail: (
      state,
      _action: PayloadAction<{
        conversation: Conversation;
        attachmentsIDs: string[];
      }>,
    ) => state,
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
const selectIsLoadingImportExport = createSelector([rootSelector], (state) => {
  return state.status === 'LOADING';
});

export const ImportExportSelectors = {
  selectAttachmentsIdsToUpload,
  selectUploadedAttachments,
  selectAttachmentsErrors,
  selectImportedHistory,
  selectImportStatus,
  selectIsLoadingImportExport,
};

export const ImportExportActions = importExportSlice.actions;
