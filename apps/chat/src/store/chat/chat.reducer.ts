import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { RootState } from '..';

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
      state.inputContent = payload.content ?? '';
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

const rootSelector = (state: RootState): ChatState => state.chat;

export const selectInputContent = createSelector(
  [rootSelector],
  (state) => state.inputContent,
);

export const selectChatFormOptions = createSelector(
  [rootSelector],
  (state) => state.formOptions,
);

export const ChatActions = chatSlice.actions;

export const ChatSelectors = {
  selectInputContent,
  selectChatFormOptions,
};
