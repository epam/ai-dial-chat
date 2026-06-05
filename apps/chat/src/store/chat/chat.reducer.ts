import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { extractNameFromEmail } from '@/src/utils/app/common';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { EntityInfo, EntityType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';

import { ChatState, TextSelection } from './chat.types';

import { MessageFormSchema, MessageFormValueType } from '@epam/ai-dial-shared';

const initialState: ChatState = {
  inputContent: '',
  userMessageTranscript: undefined,
  userMessageVoiceAttachmentId: undefined,
  configurationSchemasLoadingIds: [],
  infoModalState: ModalState.CLOSED,
  configurationSchemas: [],
  isTranscribing: false,
  isUserMessageTranscribing: false,
  isAsrFlowActive: false,
};

const MAX_CONFIGURATION_SCHEMAS_AMOUNT = 10;

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setInputContent: (state, { payload }: PayloadAction<string>) => {
      state.inputContent = payload;
    },
    appendInputContent: (state, { payload }: PayloadAction<string>) => {
      state.inputContent = `${state.inputContent} ${payload}`;
    },
    appendInputContentWithMapping: (
      state,
      { payload }: PayloadAction<{ substituted: string; original: string }>,
    ) => {
      state.inputContent = `${state.inputContent} ${payload.substituted}`;
      state.inputContentTemplateMapping = payload;
    },
    clearInputContentTemplateMapping: (state) => {
      state.inputContentTemplateMapping = undefined;
    },
    setFormValue(
      state,
      {
        payload,
      }: PayloadAction<{
        property: string;
        value: MessageFormValueType;
        modelId: string;
        content?: string;
        submit?: boolean;
      }>,
    ) {
      state.inputContent = payload.content || state.inputContent;
      state.formValue = {
        ...(state.formValue || {}),
        [payload.property]: payload.value,
      };
    },
    resetFormValue: (state) => {
      state.formValue = undefined;
    },

    getConfigurationSchema: (
      state,
      _action: PayloadAction<{ modelId: string; replaceExisting?: boolean }>,
    ) => state,
    startConfigurationSchemaUploading: (
      state,
      { payload }: PayloadAction<{ modelId: string }>,
    ) => {
      state.configurationSchemasLoadingIds.push(payload.modelId);
    },
    getConfigurationSchemaSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{ modelId: string; schema: MessageFormSchema }>,
    ) => {
      const existingSchemaIdx = state.configurationSchemas.findIndex(
        (schema) => schema.modelId === payload.modelId,
      );

      if (existingSchemaIdx === -1) {
        state.configurationSchemas.push(payload);

        if (
          state.configurationSchemas.length > MAX_CONFIGURATION_SCHEMAS_AMOUNT
        ) {
          state.configurationSchemas.shift();
        }
      } else {
        state.configurationSchemas[existingSchemaIdx] = payload;
      }

      state.configurationSchemasLoadingIds =
        state.configurationSchemasLoadingIds.filter(
          (modelId) => modelId !== payload.modelId,
        );
    },
    getConfigurationSchemaFailed: (
      state,
      { payload }: PayloadAction<{ modelId: string }>,
    ) => {
      state.configurationSchemasLoadingIds =
        state.configurationSchemasLoadingIds.filter(
          (modelId) => modelId !== payload.modelId,
        );
    },
    setShouldFocusAndScroll: (state, { payload }: PayloadAction<boolean>) => {
      state.shouldFocusAndScroll = payload;
    },
    setNotAvailableEntityType: (
      state,
      { payload }: PayloadAction<EntityType | undefined>,
    ) => {
      state.notAvailableEntityType = payload;
    },
    setInfoModalState: (state, { payload }: PayloadAction<ModalState>) => {
      state.infoModalState = payload;
    },
    getEntityInfo: (
      state,
      {
        payload,
      }: PayloadAction<{
        entityInfo: EntityInfo;
      }>,
    ) => {
      state.selectedEntityInfo = {
        id: payload.entityInfo.id,
        isPublic:
          payload.entityInfo.isPublic ||
          isEntityIdPublic({ id: payload.entityInfo.id }),
      };

      state.infoModalState = ModalState.LOADING;
    },
    getEntityInfoSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        entityInfo: EntityInfo;
      }>,
    ) => {
      const { updatedAt, createdAt, author, id } = payload.entityInfo;

      const entityInfo: EntityInfo = {
        ...state.selectedEntityInfo,
        id,
        updatedAt,
        createdAt,
        author: extractNameFromEmail(author),
      };

      state.selectedEntityInfo = entityInfo;
      state.infoModalState = ModalState.OPENED;
    },
    getEntityInfoFail: (state, _action: PayloadAction<{ errorText: string }>) =>
      state,
    resetInfoModal: (state) => {
      state.selectedEntityInfo = undefined;
      state.infoModalState = ModalState.CLOSED;
    },
    handleVoiceRecording: (
      state,
      {
        payload,
      }: PayloadAction<{
        audioBlob: Blob;
        fileExtension: string;
        selection?: TextSelection;
      }>,
    ) => {
      state.asrInsertionContext = payload.selection
        ? {
            inputSnapshot: state.inputContent,
            selection: payload.selection,
          }
        : undefined;
    },
    handleUserMessageVoiceRecording: (
      state,
      _action: PayloadAction<{ audioBlob: Blob; fileExtension: string }>,
    ) => state,
    startUserMessageTranscription: (state) => {
      state.isUserMessageTranscribing = true;
    },
    setUserMessageTranscript: (state, { payload }: PayloadAction<string>) => {
      state.userMessageTranscript = payload;
      state.isUserMessageTranscribing = false;
    },
    clearUserMessageTranscript: (state) => {
      state.userMessageTranscript = undefined;
    },
    setUserMessageVoiceAttachmentId: (
      state,
      { payload }: PayloadAction<string>,
    ) => {
      state.userMessageVoiceAttachmentId = payload;
    },
    clearUserMessageVoiceAttachmentId: (state) => {
      state.userMessageVoiceAttachmentId = undefined;
    },
    userMessageTranscriptionFailed: (
      state,
      _action: PayloadAction<{ isTooLarge?: boolean } | undefined>,
    ) => {
      state.isUserMessageTranscribing = false;
    },
    startTranscription: (
      state,
      _action: PayloadAction<{ audioData: string; mimeType: string }>,
    ) => {
      state.isTranscribing = true;
      state.isAsrFlowActive = true;
    },
    transcriptionSuccess: (
      state,
      _action: PayloadAction<{ transcript: string }>,
    ) => {
      state.isTranscribing = false;
    },
    transcriptionFailed: (
      state,
      _action: PayloadAction<{ isTooLarge?: boolean } | undefined>,
    ) => {
      state.isTranscribing = false;
      state.isAsrFlowActive = false;
      state.asrInsertionContext = undefined;
    },
    clearAsrFlow: (state) => {
      state.isAsrFlowActive = false;
      state.asrInsertionContext = undefined;
    },
    clearAsrInsertionContext: (state) => {
      state.asrInsertionContext = undefined;
    },
    setIsTranscribing: (state, { payload }: PayloadAction<boolean>) => {
      state.isTranscribing = payload;
    },
  },
});

export const ChatActions = chatSlice.actions;
