import { PayloadAction, createSlice } from '@reduxjs/toolkit';

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
}

const initialState: ChatState = {
  inputContent: '',
  isConfigurationSchemaLoading: false,
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
  },
});

export const ChatActions = chatSlice.actions;
