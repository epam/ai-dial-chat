import { createSelector } from '@reduxjs/toolkit';

import {
  getApplicationType,
  isApplicationPublic,
} from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';

import { DialAIEntityModel } from '@/src/types/models';

import {
  ApplicationTypeToSourceType,
  SourceType,
  SourceTypeFilterOrder,
} from '@/src/constants/marketplace';

import { RootState } from '../index';
import { ModelsSelectors } from '../models/models.reducers';
import { MarketplaceState } from './marketplace.reducers';

import { UploadStatus } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState): MarketplaceState => state.marketplace;

export const selectSelectedFilters = createSelector(
  [rootSelector],
  (state) => state.selectedFilters,
);

export const selectSearchTerm = createSelector(
  [rootSelector],
  (state) => state.searchTerm,
);

export const selectTrimmedSearchTerm = createSelector(
  [selectSearchTerm],
  (searchTerm) => searchTerm.trim(),
);

export const selectSelectedTab = createSelector(
  [rootSelector],
  (state) => state.selectedTab,
);

export const selectApplyModelStatus = createSelector(
  [rootSelector],
  (state) => state.applyModelStatus,
);

export const selectIsApplyingModel = createSelector(
  [selectApplyModelStatus],
  (applyModelStatus) =>
    applyModelStatus !== UploadStatus.UNINITIALIZED &&
    applyModelStatus !== UploadStatus.FAILED,
);

export const selectDetailsModel = createSelector(
  [rootSelector],
  (state) => state.detailsModel,
);

export const selectSourceTypes = createSelector(
  [ModelsSelectors.selectModels],
  (models: DialAIEntityModel[]) => {
    const sourceTypes = new Set<SourceType>([SourceType.Public]);

    models.forEach((model) => {
      if (isMyApplication(model)) {
        const applicationType = getApplicationType(model);
        sourceTypes.add(ApplicationTypeToSourceType[applicationType]);
      } else if (!isApplicationPublic(model)) {
        sourceTypes.add(SourceType.SharedWithMe);
      }
    });

    return Array.from(sourceTypes).sort(
      (a, b) => SourceTypeFilterOrder[a] - SourceTypeFilterOrder[b],
    );
  },
);
