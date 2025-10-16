import { createSelector } from '@reduxjs/toolkit';

import { sortItemsVersions } from '@/src/utils/app/common';
import {
  getGroupMarketplaceEntityKey,
  groupMarketplaceEntityAndSaveOrder,
} from '@/src/utils/app/marketplace';

import { RootState } from '@/src/types/store';
import { ToolsetModel } from '@/src/types/toolsets';

import { UploadStatus } from '@epam/ai-dial-shared';
import sortBy from 'lodash-es/sortBy';
import uniq from 'lodash-es/uniq';

const rootSelector = (state: RootState) => state.toolset;

const selectInitialized = (state: RootState) => rootSelector(state).initialized;

const selectToolsetsMap = (state: RootState) => rootSelector(state).toolsetsMap;

const selectToolsets = createSelector([selectToolsetsMap], (toolsetsMap) => {
  const toolsets = uniq(Object.values(toolsetsMap)) as ToolsetModel[];
  const sortedToolsets = sortBy(toolsets, (toolset) =>
    toolset.name.toLowerCase(),
  );

  return groupMarketplaceEntityAndSaveOrder(sortedToolsets).flatMap(
    ({ entities }) => {
      if (entities.length > 0 && entities[0].id !== entities[0].reference) {
        sortItemsVersions(entities);
      }

      return entities;
    },
  );
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

const selectPublishRequestToolsets = (state: RootState) =>
  rootSelector(state).publishRequestToolsets;

const selectAllGroupToolsetsKeySet = (
  state: RootState,
  references: string[],
) => {
  const toolsetsMap = selectToolsetsMap(state);
  return new Set(
    references
      .map((reference) => toolsetsMap[reference])
      .filter(Boolean)
      .map((toolset) => getGroupMarketplaceEntityKey(toolset!)),
  );
};

const selectToolsetsTopics = createSelector([selectToolsets], (toolsets) => {
  return sortBy(
    uniq(toolsets?.flatMap((toolset) => toolset.topics ?? []) ?? []),
    (topic) => topic.toLowerCase(),
  );
});

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
  selectPublishRequestToolsets,
  selectAllGroupToolsetsKeySet,
  selectToolsetsTopics,
};
