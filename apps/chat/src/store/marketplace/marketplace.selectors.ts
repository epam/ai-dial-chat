import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '../index';
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
