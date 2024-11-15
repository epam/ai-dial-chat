import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import {
  MappedReplaceActions,
  Operation,
  PromptsHistory,
  SupportedExportFormats,
} from '@/src/types/import-export';
import { Prompt } from '@/src/types/prompt';

import { RootState } from '..';

import { UploadStatus } from '@epam/ai-dial-shared';

export type UploadedAttachment = Partial<DialFile> & {
  oldRelativePath: string;
};

export type AttachmentToUpload = DialFile;

interface ImportExportState {
  attachmentsIdsToUpload: string[];
  uploadedAttachments: UploadedAttachment[];
  ignoredAttachmentsIds?: string[];
  nonDuplicatedFiles: DialFile[];
  importedConversations: Conversation[];
  attachmentsErrors: string[];
  status?: UploadStatus;
  operation?: Operation;
  isPromptsBackedUp: boolean;
  isChatsBackedUp: boolean;
  duplicatedConversations?: Conversation[];
  duplicatedPrompts: Prompt[];
  duplicatedFiles: DialFile[];
  isShowReplaceDialog: boolean;
  featureType: FeatureType;
  mappedActions?: MappedReplaceActions;
}

const initialState: ImportExportState = {
  attachmentsIdsToUpload: [],
  uploadedAttachments: [],
  nonDuplicatedFiles: [],
  importedConversations: [],
  attachmentsErrors: [],
  isPromptsBackedUp: false,
  isChatsBackedUp: false,
  duplicatedConversations: [],
  duplicatedPrompts: [],
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
      state.status = UploadStatus.LOADING;
      state.operation = Operation.Exporting;
    },
    exportConversationSuccess: (state) => state,
    exportConversations: (state) => state,
    exportPrompt: (state, _action: PayloadAction<{ id: string }>) => state,
    exportPrompts: (state) => state,
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
      state.status = UploadStatus.LOADING;
      state.operation = Operation.Importing;
      state.isShowReplaceDialog = false;
    },
    importZipConversations: (
      state,
      _action: PayloadAction<{ zipFile: File }>,
    ) => {
      state.status = UploadStatus.LOADING;
      state.operation = Operation.Importing;
    },
    importStop: (state) => state,
    importFail: (state, _action: PayloadAction<FeatureType>) => state,
    uploadConversationAttachments: (
      state,
      {
        payload,
      }: PayloadAction<{
        attachmentsToPostfix: AttachmentToUpload[];
        attachmentsToReplace?: AttachmentToUpload[];
        ignoredAttachmentsIds?: string[];
        importedConversations?: Conversation[];
      }>,
    ) => {
      const attachmentsToUpload = [
        ...payload.attachmentsToPostfix,
        ...(payload.attachmentsToReplace ?? []),
      ];
      state.attachmentsIdsToUpload = attachmentsToUpload.map(({ id }) => id);
      state.ignoredAttachmentsIds = payload.ignoredAttachmentsIds;

      if (payload.importedConversations) {
        state.importedConversations = payload.importedConversations;
      }

      state.duplicatedFiles = [];
      state.isShowReplaceDialog = false;
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
    updateConversationWithUploadedAttachments: (state) => state,
    uploadImportedConversations: (
      state,
      _action: PayloadAction<{
        itemsToUpload: Conversation[];
      }>,
    ) => state,
    importPrompts: (
      state,
      _action: PayloadAction<{ promptsHistory: PromptsHistory }>,
    ) => {
      state.status = UploadStatus.LOADING;
      state.operation = Operation.Importing;
    },
    importPromptsFail: (state) => state,
    uploadImportedPrompts: (
      state,
      _action: PayloadAction<{
        itemsToUpload: Prompt[];
      }>,
    ) => state,
    showReplaceDialog: (
      state,
      {
        payload,
      }: PayloadAction<{
        duplicatedItems: Conversation[] | Prompt[];
        featureType: FeatureType;
      }>,
    ) => {
      state.isShowReplaceDialog = true;
      state.featureType = payload.featureType;

      if (payload.featureType === FeatureType.Chat) {
        state.duplicatedConversations =
          payload.duplicatedItems as Conversation[];
      }

      if (payload.featureType === FeatureType.Prompt) {
        state.duplicatedPrompts = payload.duplicatedItems as Prompt[];
      }
    },
    showAttachmentsReplaceDialog: (
      state,
      {
        payload,
      }: PayloadAction<{
        duplicatedAttachments: DialFile[];
        duplicatedConversations?: Conversation[];
        nonDuplicatedConversations?: Conversation[];
        nonDuplicatedFiles?: DialFile[];
      }>,
    ) => {
      state.isShowReplaceDialog = true;
      state.featureType = FeatureType.File;

      state.duplicatedFiles = payload.duplicatedAttachments;
      state.duplicatedConversations = payload.duplicatedConversations;

      if (payload.nonDuplicatedFiles) {
        state.nonDuplicatedFiles = payload.nonDuplicatedFiles;
      }

      if (payload.nonDuplicatedConversations) {
        state.importedConversations = payload.nonDuplicatedConversations;
      }
    },

    closeReplaceDialog: (state) => {
      state.isShowReplaceDialog = false;
    },

    replaceConversations: (
      state,
      _action: PayloadAction<{
        conversations: Conversation[];
      }>,
    ) => state,
    replacePrompts: (
      state,
      _action: PayloadAction<{
        prompts: Prompt[];
      }>,
    ) => state,
    continueDuplicatedImport: (
      state,
      {
        payload,
      }: PayloadAction<{
        mappedActions: MappedReplaceActions;
      }>,
    ) => {
      state.isShowReplaceDialog = false;
      state.mappedActions = payload.mappedActions;
    },

    setImportedConversations: (
      state,
      { payload }: PayloadAction<{ importedConversations: Conversation[] }>,
    ) => {
      state.importedConversations = payload.importedConversations;
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

const selectImportedConversations = createSelector([rootSelector], (state) => {
  return state.importedConversations;
});

const selectImportStatus = createSelector([rootSelector], (state) => {
  return state.status;
});

const selectOperationName = createSelector([rootSelector], (state) => {
  return state.operation;
});

const selectIsLoadingImportExport = createSelector([rootSelector], (state) => {
  return state.status === UploadStatus.LOADING;
});

const selectIsShowReplaceDialog = createSelector([rootSelector], (state) => {
  return state.isShowReplaceDialog;
});

const selectFeatureType = createSelector([rootSelector], (state) => {
  return state.featureType;
});

const selectDuplicatedConversations = createSelector(
  [rootSelector],
  (state) => {
    return state.duplicatedConversations;
  },
);

const selectDuplicatedPrompts = createSelector([rootSelector], (state) => {
  return state.duplicatedPrompts;
});

const selectDuplicatedFiles = createSelector([rootSelector], (state) => {
  return state.duplicatedFiles;
});

const selectNonDuplicatedFiles = createSelector([rootSelector], (state) => {
  return state.nonDuplicatedFiles;
});

const selectIgnoredAttachmentsIds = createSelector([rootSelector], (state) => {
  return state.ignoredAttachmentsIds;
});

const selectMappedActions = createSelector([rootSelector], (state) => {
  return state.mappedActions;
});

export const ImportExportSelectors = {
  selectAttachmentsIdsToUpload,
  selectUploadedAttachments,
  selectAttachmentsErrors,
  selectImportedConversations,
  selectImportStatus,
  selectOperationName,
  selectIsLoadingImportExport,
  selectIsShowReplaceDialog,
  selectFeatureType,
  selectDuplicatedConversations,
  selectDuplicatedPrompts,
  selectDuplicatedFiles,
  selectNonDuplicatedFiles,
  selectIgnoredAttachmentsIds,
  selectMappedActions,
};

export const ImportExportActions = importExportSlice.actions;
