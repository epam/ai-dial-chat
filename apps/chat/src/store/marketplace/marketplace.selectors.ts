import { createSelector } from '@reduxjs/toolkit';

import {
  getApplicationType,
  isApplicationPublic,
  isApplicationTypeKey,
} from '@/src/utils/app/application';
import { pluralizeDisplayName } from '@/src/utils/app/application-type-schema';
import { isMyApplication } from '@/src/utils/app/id';

import { ApplicationTypeSchema } from '@/src/types/application-type-schema';
import { DialAIEntityModel } from '@/src/types/models';
import { RootState } from '@/src/types/store';

import { ApplicationTypesSchemasSelectors } from '@/src/store/applicationTypeSchemas/applicationTypeSchemas.selectors';
import { ModelsSelectors } from '@/src/store/models/models.selectors';

import {
  ApplicationTypeToSourceType,
  SourceType,
} from '@/src/constants/marketplace';

import { UploadStatus } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState) => state.marketplace;

const selectSelectedViewType = (state: RootState) =>
  rootSelector(state).selectedView;

const selectTableSort = (state: RootState) => rootSelector(state).tableSort;

const selectIsBannerVisible = (state: RootState) =>
  rootSelector(state).isBannerVisible;

const selectSelectedFilters = (state: RootState) =>
  rootSelector(state).selectedFilters;

const selectSearchTerm = (state: RootState) => rootSelector(state).searchTerm;

const selectTrimmedSearchTerm = createSelector(
  [selectSearchTerm],
  (searchTerm) => searchTerm.trim(),
);

const selectSelectedTab = (state: RootState) => rootSelector(state).selectedTab;

const selectApplyModelStatus = (state: RootState) =>
  rootSelector(state).applyModelStatus;

const selectIsApplyingModel = (state: RootState) =>
  selectApplyModelStatus(state) !== UploadStatus.UNINITIALIZED &&
  selectApplyModelStatus(state) !== UploadStatus.FAILED;

const selectDetailsModel = (state: RootState) =>
  rootSelector(state).detailsModel;

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
      } else if (!isApplicationPublic(model)) {
        sourceTypes.add(SourceType.SharedWithMe);
      }
    });

    return Array.from(sourceTypes).sort();
  },
);

const selectDeleteModel = (state: RootState) => rootSelector(state).deleteModel;

export const MarketplaceSelectors = {
  selectSelectedViewType,
  selectTableSort,
  selectIsBannerVisible,
  selectSelectedFilters,
  selectSearchTerm,
  selectTrimmedSearchTerm,
  selectSelectedTab,
  selectApplyModelStatus,
  selectIsApplyingModel,
  selectDetailsModel,
  selectSourceTypes,
  selectDeleteModel,
};
