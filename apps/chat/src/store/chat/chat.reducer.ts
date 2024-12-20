import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { FormSchemaPropertyValue } from '@epam/ai-dial-shared';

export interface ChatState {
  inputContent: string;
  formOptions?: Record<string, FormSchemaPropertyValue>;
}

const initialState: ChatState = {
  inputContent: '',
};

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setInputContent: (state, { payload }: PayloadAction<string>) => {
      state.inputContent = payload;
    },
    setFormOptions(
      state,
      {
        payload,
      }: PayloadAction<{
        property: string;
        value: FormSchemaPropertyValue;
        content?: string;
      }>,
    ) {
      state.inputContent = payload.content ?? state.inputContent;
      state.formOptions = {
        ...(state.formOptions || {}),
        [payload.property]: payload.value,
      };
    },
    resetFormOptions: (state) => {
      state.formOptions = undefined;
    },
  },
});

export const ChatActions = chatSlice.actions;
