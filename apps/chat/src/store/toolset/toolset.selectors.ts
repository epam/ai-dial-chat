import { RootState } from '@/src/types/store';

const rootSelector = (state: RootState) => state.toolset;

const selectInitialized = (state: RootState) => rootSelector(state).initialized;

const selectToolsetsMap = (state: RootState) => rootSelector(state).toolsetsMap;

const selectIsLoading = (state: RootState) => rootSelector(state).isLoading;

export const ToolsetSelectors = {
  selectInitialized,
  selectToolsetsMap,
  selectIsLoading,
};
