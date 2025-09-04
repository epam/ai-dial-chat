import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '@/src/types/store';

import { UploadStatus } from '@epam/ai-dial-shared';
import sortBy from 'lodash-es/sortBy';

const rootSelector = (state: RootState) => state.toolset;

const selectInitialized = (state: RootState) => rootSelector(state).initialized;

const selectToolsetsMap = (state: RootState) => rootSelector(state).toolsetsMap;

const selectToolsets = createSelector([selectToolsetsMap], (toolsetsMap) => {
  const toolsets = Object.values(toolsetsMap);

  return sortBy(toolsets, (toolset) => toolset.name.toLowerCase());
});

const selectToolsetsStatus = (state: RootState) =>
  rootSelector(state).toolsetsStatus;

const selectIsLoading = createSelector(
  [selectToolsetsStatus],
  (status) => status === UploadStatus.LOADING,
);

const selectAreToolsetsLoaded = createSelector(
  [selectToolsetsStatus],
  (status) => status === UploadStatus.LOADED,
);

const selectToolsetDetails = (state: RootState) =>
  rootSelector(state).toolsetDetails;

const selectToolsetDetailsStatus = (state: RootState) =>
  rootSelector(state).toolsetDetailsStatus;

const selectIsToolsetDetailsLoading = createSelector(
  [selectToolsetDetailsStatus],
  (status) => status === UploadStatus.LOADING,
);

const selectInstalledToolsets = (state: RootState) =>
  rootSelector(state).installedToolsets;

const selectInstalledToolsetsSet = createSelector(
  [selectInstalledToolsets],
  (installedToolsets) => {
    return new Set(installedToolsets);
  },
);

const selectEditorStep = (state: RootState) => rootSelector(state).editorStep;

export const ToolsetSelectors = {
  selectInitialized,
  selectToolsetsMap,
  selectToolsets,
  selectToolsetsStatus,
  selectIsLoading,
  selectAreToolsetsLoaded,
  selectToolsetDetails,
  selectToolsetDetailsStatus,
  selectIsToolsetDetailsLoading,
  selectInstalledToolsets,
  selectInstalledToolsetsSet,
  selectEditorStep,
};
