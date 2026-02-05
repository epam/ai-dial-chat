import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { extractNameFromEmail } from '@/src/utils/app/common';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { EntityInfo, EntityType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';

import { ChatState } from './chat.types';

import { MessageFormSchema, MessageFormValueType } from '@epam/ai-dial-shared';

const initialState: ChatState = {
  inputContent: '',
  configurationSchemasLoadingIds: [],
  infoModalState: ModalState.CLOSED,
  configurationSchemas: [],
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
      _action: PayloadAction<{ modelId: string }>,
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
      if (
        !state.configurationSchemas.find(
          (schema) => schema.modelId === payload.modelId,
        )
      ) {
        state.configurationSchemas.push(payload);

        if (
          state.configurationSchemas.length > MAX_CONFIGURATION_SCHEMAS_AMOUNT
        ) {
          state.configurationSchemas.shift();
        }
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
  },
});

export const ChatActions = chatSlice.actions;
