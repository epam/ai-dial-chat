import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import {
  LatestExportFormat,
  LoadingStatus,
  Operation,
  SupportedExportFormats,
} from '@/src/types/import-export';
import { Prompt } from '@/src/types/prompt';

import { RootState } from '..';

export type UploadedAttachment = Partial<DialFile> & {
  oldRelativePath: string;
};

export type AttachmentToUpload = DialFile;

interface ImportExportState {
  attachmentsIdsToUpload: string[];
  uploadedAttachments: UploadedAttachment[];
  nonDuplicatedFiles: DialFile[];
  importedHistory: LatestExportFormat;
  attachmentsErrors: string[];
  status?: LoadingStatus;
  operation?: Operation;
  isPromptsBackedUp: boolean;
  isChatsBackedUp: boolean;
  conversationsToReplace: Conversation[];
  promptsToReplace: Prompt[];
  duplicatedFiles: DialFile[];
  isShowReplaceDialog: boolean;
  featureType: FeatureType;
}

const defaultImportedHistory: LatestExportFormat = {
  version: 5,
  history: [],
  folders: [],
  prompts: [],
};
const initialState: ImportExportState = {
  attachmentsIdsToUpload: [],
  uploadedAttachments: [],
  nonDuplicatedFiles: [],
  importedHistory: defaultImportedHistory,
  attachmentsErrors: [],
  isPromptsBackedUp: false,
  isChatsBackedUp: false,
  conversationsToReplace: [],
  promptsToReplace: [],
  duplicatedFiles: [],
  status: undefined,
  operation: undefined,
  isShowReplaceDialog: false,
  featureType: FeatureType.Chat,
};

export const importExportSlice = createSlice({
  name: 'importExport',
  initialState,
  reducers: {
    resetState: (state) => {
      state = initialState;
      return state;
    },
    exportConversation: (
      state,
      _action: PayloadAction<{
        conversationId: string;
        withAttachments?: boolean;
      }>,
    ) => {
      state.status = LoadingStatus.Loading;
      state.operation = Operation.Exporting;
    },
    exportConversationSuccess: (state) => state,
    exportConversations: (state) => state,
    exportLocalStorageChats: (state) => state,
    exportLocalStoragePrompts: (state) => state,
    exportCancel: (state) => state,
    exportFail: (state) => {
      state.status = undefined;
    },
    importConversations: (
      state,
      _action: PayloadAction<{ data: SupportedExportFormats }>,
    ) => {
      state.status = LoadingStatus.Loading;
      state.operation = Operation.Importing;
    },
    importZipConversations: (
      state,
      _action: PayloadAction<{ zipFile: File }>,
    ) => {
      state.status = LoadingStatus.Loading;
      state.operation = Operation.Importing;
    },
    importStop: (state) => state,
    importFail: (state) => state,
    uploadConversationAttachments: (
      state,
      {
        payload,
      }: PayloadAction<{
        attachmentsToPostfix: AttachmentToUpload[];
        attachmentsToReplace?: AttachmentToUpload[];
        completeHistory: LatestExportFormat;
      }>,
    ) => {
      const attachmentsToUpload = [
        ...payload.attachmentsToPostfix,
        ...(payload.attachmentsToReplace ?? []),
      ];
      state.attachmentsIdsToUpload = attachmentsToUpload.map(({ id }) => id);
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
    uploadImportedConversations: (
      state,
      {
        payload,
      }: PayloadAction<{
        itemsToUpload: Conversation[];
        folders?: FolderInterface[];
        disableStateReset?: boolean;
      }>,
    ) => {
      if (!payload.disableStateReset) {
        state.isShowReplaceDialog = false;
      }
    },
    importPrompts: (state) => {
      state.status = LoadingStatus.Loading;
      state.operation = Operation.Importing;
    },
    importPromptsFail: (state) => state,
    uploadImportedPrompts: (
      state,
      {
        payload,
      }: PayloadAction<{
        itemsToUpload: Prompt[];
        folders?: FolderInterface[];
        disableStateReset?: boolean;
      }>,
    ) => {
      if (!payload.disableStateReset) {
        state.isShowReplaceDialog = false;
      }
    },
    showReplaceDialog: (
      state,
      {
        payload,
      }: PayloadAction<{
        duplicatedItems: Conversation[] | Prompt[] | DialFile[];
        featureType: FeatureType;
        completeHistory?: LatestExportFormat;
        nonDuplicatedFiles?: DialFile[];
      }>,
    ) => {
      state.isShowReplaceDialog = true;
      state.featureType = payload.featureType;

      if (payload.featureType === FeatureType.Chat) {
        state.conversationsToReplace =
          payload.duplicatedItems as Conversation[];
      }

      if (payload.featureType === FeatureType.Prompt) {
        state.promptsToReplace = payload.duplicatedItems as Prompt[];
      }

      if (payload.featureType === FeatureType.File) {
        state.duplicatedFiles = payload.duplicatedItems as DialFile[];
        if (payload.nonDuplicatedFiles) {
          state.nonDuplicatedFiles = payload.nonDuplicatedFiles;
        }
      }

      if (payload.completeHistory) {
        state.importedHistory = payload.completeHistory;
      }
    },
    replaceFeatures: (
      state,
      _action: PayloadAction<{
        itemsToReplace: (DialFile | ConversationInfo | Prompt)[];
        featureType: FeatureType;
      }>,
    ) => {
      state.status = LoadingStatus.Loading;
      state.operation = Operation.Importing;
    },
    cancelConversationsImportDuplicated: (state) => {
      state.isShowReplaceDialog = false;
      state.conversationsToReplace = [];
    },
    cancelPromptsImportDuplicated: (state) => {
      state.isShowReplaceDialog = false;
      state.promptsToReplace = [];
    },
    closeReplaceDialog: (state) => {
      state.isShowReplaceDialog = false;
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
  return state.status === LoadingStatus.Loading;
});

const selectIsShowReplaceDialog = createSelector([rootSelector], (state) => {
  return state.isShowReplaceDialog;
});

const selectFeatureType = createSelector([rootSelector], (state) => {
  return state.featureType;
});

const selectConversationToReplace = createSelector([rootSelector], (state) => {
  return state.conversationsToReplace;
});

const selectPromptsToReplace = createSelector([rootSelector], (state) => {
  return state.promptsToReplace;
});

const selectDuplicatedFiles = createSelector([rootSelector], (state) => {
  return state.duplicatedFiles;
});

const selectNonDuplicatedFiles = createSelector([rootSelector], (state) => {
  return state.nonDuplicatedFiles;
});

export const ImportExportSelectors = {
  selectAttachmentsIdsToUpload,
  selectUploadedAttachments,
  selectAttachmentsErrors,
  selectImportedHistory,
  selectImportStatus,
  selectOperationName,
  selectIsLoadingImportExport,
  selectIsShowReplaceDialog,
  selectFeatureType,
  selectConversationToReplace,
  selectPromptsToReplace,
  selectDuplicatedFiles,
  selectNonDuplicatedFiles,
};

export const ImportExportActions = importExportSlice.actions;
