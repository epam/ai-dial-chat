import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { isEntityIdPublic } from '@/src/utils/app/publications';

import { EntityInfo, EntityType, RawEntityInfo } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';

import {
  MessageFormSchema,
  MessageFormValue,
  MessageFormValueType,
} from '@epam/ai-dial-shared';

export interface ChatState {
  inputContent: string;
  formValue?: MessageFormValue;
  configurationSchema?: MessageFormSchema;
  isConfigurationSchemaLoading: boolean;
  shouldFocusAndScroll?: boolean;
  notAvailableEntityType?: EntityType;
  infoModalState: ModalState;
  selectedEntityInfo?: EntityInfo;
}

const initialState: ChatState = {
  inputContent: '',
  isConfigurationSchemaLoading: false,
  infoModalState: ModalState.CLOSED,
};

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
    ) => {
      state.isConfigurationSchemaLoading = true;
    },
    getConfigurationSchemaSuccess: (
      state,
      { payload }: PayloadAction<MessageFormSchema>,
    ) => {
      state.configurationSchema = payload;
      state.isConfigurationSchemaLoading = false;
    },
    getConfigurationSchemaFailed: (state) => {
      state.isConfigurationSchemaLoading = false;
    },
    resetConfigurationSchema: (state) => {
      state.configurationSchema = undefined;
      state.isConfigurationSchemaLoading = false;
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
        entityInfo: RawEntityInfo;
      }>,
    ) => {
      state.selectedEntityInfo = {
        id: payload.entityInfo.id,
        sharedWithMe: payload.entityInfo.sharedWithMe,
        isPublic: isEntityIdPublic({ id: payload.entityInfo.id }),
      };

      state.infoModalState = ModalState.LOADING;
    },
    getEntityInfoSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        entityInfo: RawEntityInfo;
      }>,
    ) => {
      const { updatedAt, createdAt, author, id } = payload.entityInfo;

      const formattedUpdatedAt = updatedAt
        ? new Date(updatedAt).toLocaleDateString()
        : undefined;

      const formattedCreatedAt = createdAt
        ? new Date(createdAt).toLocaleDateString()
        : undefined;

      const entityInfo: EntityInfo = {
        ...state.selectedEntityInfo,
        id,
        updatedAt: formattedUpdatedAt,
        createdAt: formattedCreatedAt,
        author,
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
