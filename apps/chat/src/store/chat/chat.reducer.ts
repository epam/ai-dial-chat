import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { RootState } from '..';

export interface ChatState {
  inputContent: string;
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
  },
});

const rootSelector = (state: RootState): ChatState => state.chat;

export const selectInputContent = createSelector(
  [rootSelector],
  (state) => state.inputContent,
);

export const ChatActions = chatSlice.actions;

export const ChatSelectors = {
  selectInputContent,
};
