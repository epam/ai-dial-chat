import { createSelector } from '@reduxjs/toolkit';

import {
  getLocalizedEntityIdName,
  withEntityIdName,
} from '@/src/utils/app/application';
import { sortItemsVersions } from '@/src/utils/app/common';
import { withoutFileManagerPlaceholderByName } from '@/src/utils/app/file';
import {
  getFolderFromId,
  getParentFolderIdsFromEntityId,
} from '@/src/utils/app/folders';
import {
  getGroupMarketplaceEntityKey,
  groupMarketplaceEntityAndSaveOrder,
} from '@/src/utils/app/marketplace';
import {
  filterHiddenEntities,
  shouldShowHiddenEntities,
} from '@/src/utils/app/models';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { getIdWithoutVersionFromApiKey } from '@/src/utils/server/api';

import { FeatureType } from '@/src/types/common';
import { RootState } from '@/src/types/store';
import { ToolsetModel, ToolsetsMap } from '@/src/types/toolsets';

import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { UploadStatus } from '@epam/ai-dial-shared';
import sortBy from 'lodash-es/sortBy';
import uniq from 'lodash-es/uniq';
import uniqBy from 'lodash-es/uniqBy';

const rootSelector = (state: RootState) => state.toolset;

const selectInitialized = (state: RootState) => rootSelector(state).initialized;

const selectToolsetsMap = (state: RootState) => rootSelector(state).toolsetsMap;

const _toolsetsFromMap = (toolsetsMap: ToolsetsMap) =>
  uniq(Object.values(toolsetsMap).filter((t): t is ToolsetModel => t != null));

const selectToolsets = createSelector(
  [
    selectToolsetsMap,
    SettingsSelectors.selectHiddenEntityTag,
    (_state, showHidden?: boolean) => showHidden,
  ],
  (toolsetsMap, hiddenEntityTag, showHidden) => {
    const toolsets = _toolsetsFromMap(toolsetsMap);
    const filteredHidden = shouldShowHiddenEntities(hiddenEntityTag, showHidden)
      ? toolsets
      : filterHiddenEntities(toolsets, hiddenEntityTag);
    const withoutPlaceholder = withoutFileManagerPlaceholderByName(
      filteredHidden.map(withEntityIdName),
    );
    const sortedToolsets = sortBy(withoutPlaceholder, (toolset) =>
      getLocalizedEntityIdName(toolset.name).toLowerCase(),
    );

    return groupMarketplaceEntityAndSaveOrder(sortedToolsets).flatMap(
      ({ entities }) => {
        if (entities.length > 0 && entities[0].id !== entities[0].reference) {
          sortItemsVersions(entities);
        }

        return entities;
      },
    );
  },
);

const selectToolsetVersionGroupByGroupId = createSelector(
  [
    (state) => selectToolsets(state),
    (_state, versionGroupId: string) => versionGroupId,
  ],
  (toolsets, versionGroupId) =>
    toolsets.reduce((acc, toolset) => {
      if (getIdWithoutVersionFromApiKey(toolset.id) === versionGroupId) {
        return [...acc, toolset];
      }
      return acc;
    }, [] as ToolsetModel[]),
);

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
      .filter((toolset) => !!toolset)
      .map((toolset) => getGroupMarketplaceEntityKey(toolset)),
  );
};

const selectToolsetsTopics = createSelector(
  [
    selectToolsetsMap,
    SettingsSelectors.selectHiddenEntityTag,
    (_state, showHidden?: boolean) => showHidden,
  ],
  (toolsetsMap, hiddenEntityTag, showHidden) => {
    const toolsets = _toolsetsFromMap(toolsetsMap);
    const filteredHidden = shouldShowHiddenEntities(hiddenEntityTag, showHidden)
      ? toolsets
      : filterHiddenEntities(toolsets, hiddenEntityTag);
    const withoutPlaceholder = withoutFileManagerPlaceholderByName(
      filteredHidden.map(withEntityIdName),
    );
    return sortBy(
      uniq(
        withoutPlaceholder?.flatMap((toolset) => toolset.topics ?? []) ?? [],
      ),
      (topic) => topic.toLowerCase(),
    );
  },
);

const selectIsInstalledToolsetsInitialized = (state: RootState) =>
  rootSelector(state).isInstalledToolsetsInitialized;

const selectPublicFolders = createSelector([selectToolsets], (toolsets) => {
  const publicToolsetIds = toolsets
    .filter((toolset) => isEntityIdPublic(toolset))
    .map((toolset) => toolset.id);

  return uniqBy(
    publicToolsetIds
      .flatMap((id) => getParentFolderIdsFromEntityId(id).slice(0, -1))
      .map((id) =>
        getFolderFromId(id, FeatureType.Toolset, UploadStatus.LOADED),
      ),
    'id',
  );
});

const selectAllowedTools = (state: RootState) =>
  rootSelector(state).allowedTools?.tools ?? [];
const selectAllowedToolsEndpoint = (state: RootState) =>
  rootSelector(state).allowedTools?.endpoint;
const selectAllowedToolsStatus = (state: RootState) =>
  rootSelector(state).allowedToolsStatus;

export const ToolsetSelectors = {
  selectInitialized,
  selectToolsetsMap,
  selectToolsets,
  selectToolsetVersionGroupByGroupId,
  selectToolsetsStatus,
  selectIsLoading,
  selectAreToolsetsLoaded,
  selectToolsetDetails,
  selectToolsetDetailsStatus,
  selectIsToolsetDetailsLoading,
  selectInstalledToolsets,
  selectIsInstalledToolsetsInitialized,
  selectInstalledToolsetsSet,
  selectEditorStep,
  selectPublishRequestToolsets,
  selectAllGroupToolsetsKeySet,
  selectToolsetsTopics,
  selectPublicFolders,
  selectAllowedTools,
  selectAllowedToolsEndpoint,
  selectAllowedToolsStatus,
};
