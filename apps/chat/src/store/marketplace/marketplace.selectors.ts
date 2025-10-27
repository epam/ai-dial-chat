import { createSelector } from '@reduxjs/toolkit';

import {
  getApplicationType,
  isApplicationTypeKey,
  isMarketplaceEntityPublic,
} from '@/src/utils/app/application';
import { pluralizeDisplayName } from '@/src/utils/app/application-type-schema';
import { isMyApplication, isMyToolset } from '@/src/utils/app/id';

import { ApplicationTypeSchema } from '@/src/types/application-type-schema';
import { DialAIEntityModel } from '@/src/types/models';
import { RootState } from '@/src/types/store';
import { ToolsetModel } from '@/src/types/toolsets';

import { ApplicationTypesSchemasSelectors } from '@/src/store/applicationTypeSchemas/applicationTypeSchemas.selectors';
import { ModelsSelectors } from '@/src/store/models/models.selectors';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import {
  ApplicationTypeToSourceType,
  MarketplaceEntitiesTabs,
  SourceType,
} from '@/src/constants/marketplace';

import { UploadStatus } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState) => state.marketplace;

const selectSelectedViewType = (state: RootState) =>
  rootSelector(state).selectedView;

const selectTableSort = (state: RootState) => rootSelector(state).tableSort;

const selectIsBannerVisible = (state: RootState) =>
  rootSelector(state).isBannerVisible;

const selectSelectedAgentsFilters = (state: RootState) =>
  rootSelector(state).selectedAgentsFilters;

const selectSelectedToolsetsFilters = (state: RootState) =>
  rootSelector(state).selectedToolsetsFilters;

const selectSearchTerm = (state: RootState) => rootSelector(state).searchTerm;

const selectTrimmedSearchTerm = createSelector(
  [selectSearchTerm],
  (searchTerm) => searchTerm.trim(),
);

const selectSelectedTab = (state: RootState) => rootSelector(state).selectedTab;
const selectSelectedEntitiesTab = (state: RootState) =>
  rootSelector(state).selectedEntitiesTab;

const selectApplyModelStatus = (state: RootState) =>
  rootSelector(state).applyModelStatus;

const selectIsApplyingModel = (state: RootState) =>
  selectApplyModelStatus(state) !== UploadStatus.UNINITIALIZED &&
  selectApplyModelStatus(state) !== UploadStatus.FAILED;

const selectDetailsEntity = (state: RootState) =>
  rootSelector(state).detailsEntity;

const selectDetailsModel = createSelector(
  [selectDetailsEntity],
  (detailsEntity) =>
    detailsEntity?.type === MarketplaceEntitiesTabs.AGENTS
      ? detailsEntity
      : undefined,
);

const selectDetailsToolset = createSelector(
  [selectDetailsEntity],
  (detailsEntity) =>
    detailsEntity?.type === MarketplaceEntitiesTabs.TOOLSETS
      ? detailsEntity
      : undefined,
);

const selectSourceTypes = createSelector(
  [
    ModelsSelectors.selectModels,
    ApplicationTypesSchemasSelectors.selectAllSchemas,
  ],
  (models: DialAIEntityModel[], schemas: ApplicationTypeSchema[]) => {
    const sourceTypes = new Set<SourceType>([SourceType.Public]);

    models.forEach((model) => {
      if (isMyApplication(model)) {
        const applicationType = getApplicationType(model);

        if (isApplicationTypeKey(applicationType)) {
          sourceTypes.add(ApplicationTypeToSourceType[applicationType]);
        } else {
          const schema = schemas.find(
            (schema) =>
              model.applicationTypeSchemaId &&
              schema.id === model.applicationTypeSchemaId,
          );
          if (schema) {
            const sourceType = pluralizeDisplayName(schema.displayName);
            sourceTypes.add(sourceType as SourceType);
          }
        }
      } else if (!isMarketplaceEntityPublic(model)) {
        sourceTypes.add(SourceType.SharedWithMe);
      }
    });

    return Array.from(sourceTypes).sort();
  },
);

const selectToolsetSourceTypes = createSelector(
  [ToolsetSelectors.selectToolsets],
  (toolsets: ToolsetModel[]) => {
    const sourceTypes = new Set<SourceType>([]);
    if (toolsets.length === 0) {
      return [];
    }

    for (const toolset of toolsets) {
      if (isMyToolset(toolset)) {
        sourceTypes.add(SourceType.MyToolsets);
      }

      if (isMarketplaceEntityPublic(toolset)) {
        sourceTypes.add(SourceType.Public);
      }

      if (!isMyToolset(toolset) && !isMarketplaceEntityPublic(toolset)) {
        sourceTypes.add(SourceType.SharedWithMe);
      }

      // Early exit optimization
      if (sourceTypes.size === 3) {
        break;
      }
    }

    return Array.from(sourceTypes).sort();
  },
);

const selectDeleteEntity = (state: RootState) =>
  rootSelector(state).deleteEntity;

const selectLoginEntity = (state: RootState) => rootSelector(state).loginEntity;

const selectShowLoader = (state: RootState) => rootSelector(state).showLoader;

export const MarketplaceSelectors = {
  selectSelectedViewType,
  selectTableSort,
  selectIsBannerVisible,
  selectSelectedAgentsFilters,
  selectSelectedToolsetsFilters,
  selectSearchTerm,
  selectTrimmedSearchTerm,
  selectSelectedTab,
  selectSelectedEntitiesTab,
  selectApplyModelStatus,
  selectIsApplyingModel,
  selectDetailsModel,
  selectSourceTypes,
  selectToolsetSourceTypes,
  selectDeleteEntity,
  selectDetailsEntity,
  selectDetailsToolset,
  selectLoginEntity,
  selectShowLoader,
};
