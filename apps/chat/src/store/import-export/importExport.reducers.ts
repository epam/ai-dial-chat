import { PayloadAction, createSlice } from '@reduxjs/toolkit';

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

import { ImportExportState } from './importExport.types';

import { UploadStatus } from '@epam/ai-dial-shared';

export type UploadedAttachment = Partial<DialFile> & {
  oldRelativePath: string;
};

export type AttachmentToUpload = DialFile;

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

export { ImportExportSelectors } from './importExport.selectors';

export const ImportExportActions = importExportSlice.actions;
