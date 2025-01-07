import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { MessageFormValue, MessageFormValueType } from '@epam/ai-dial-shared';

export interface ChatState {
  inputContent: string;
  formValue?: MessageFormValue;
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
  },
});

export const ChatActions = chatSlice.actions;
