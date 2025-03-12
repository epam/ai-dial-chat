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

import {
  ApplicationTypeToSourceType,
  SourceType,
  SourceTypeFilterOrder,
} from '@/src/constants/marketplace';

import { ApplicationTypesSchemasSelectors } from '../applicationTypeSchemas/applicationTypeSchemas.reducer';
import { ModelsSelectors } from '../models/models.reducers';
import { MarketplaceState } from './marketplace.types';

import { UploadStatus } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState): MarketplaceState => state.marketplace;

export const selectSelectedViewType = (state: RootState) =>
  rootSelector(state).selectedView;

export const selectTableSort = (state: RootState) =>
  rootSelector(state).tableSort;

export const selectIsBannerVisible = (state: RootState) =>
  rootSelector(state).isBannerVisible;

export const selectSelectedFilters = (state: RootState) =>
  rootSelector(state).selectedFilters;

export const selectSearchTerm = (state: RootState) =>
  rootSelector(state).searchTerm;

export const selectTrimmedSearchTerm = createSelector(
  [selectSearchTerm],
  (searchTerm) => searchTerm.trim(),
);

export const selectSelectedTab = (state: RootState) =>
  rootSelector(state).selectedTab;

export const selectApplyModelStatus = (state: RootState) =>
  rootSelector(state).applyModelStatus;

export const selectIsApplyingModel = (state: RootState) =>
  selectApplyModelStatus(state) !== UploadStatus.UNINITIALIZED &&
  selectApplyModelStatus(state) !== UploadStatus.FAILED;

export const selectDetailsModel = (state: RootState) =>
  rootSelector(state).detailsModel;

export const selectSourceTypes = createSelector(
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

    return Array.from(sourceTypes).sort(
      (a, b) => SourceTypeFilterOrder[a] - SourceTypeFilterOrder[b],
    );
  },
);
