import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { ToolsetModel } from '@/src/types/toolsets';

import { ToolsetState } from '@/src/store/toolset/toolset.types';

const initialState: ToolsetState = {
  initialized: false,
  toolsetsMap: {},
  isLoading: false,
};

export const toolsetSlice = createSlice({
  name: 'toolset',
  initialState,
  reducers: {
    init: (state) => state,
    initFinish: (state) => {
      state.initialized = true;
    },
    setToolsets: (state, { payload }: PayloadAction<ToolsetModel[]>) => {
      state.toolsetsMap = payload.reduce<Record<string, ToolsetModel>>(
        (acc, toolset) => {
          acc[toolset.id] = toolset;
          return acc;
        },
        {},
      );
    },
  },
});

export const ToolsetActions = toolsetSlice.actions;

export default toolsetSlice.reducer;
