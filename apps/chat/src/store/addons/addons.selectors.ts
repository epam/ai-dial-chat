import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '@/src/types/store';

import { AddonsState } from './addons.types';

const rootSelector = (state: RootState): AddonsState => state.addons;

const selectAddonsIsLoading = createSelector([rootSelector], (state) => {
  return state.isLoading;
});
const selectAddonsError = createSelector([rootSelector], (state) => {
  return state.error;
});
const selectAddons = createSelector([rootSelector], (state) => {
  return state.addons;
});
const selectAddonsMap = createSelector([rootSelector], (state) => {
  return state.addonsMap;
});
const selectRecentAddonsIds = createSelector([rootSelector], (state) => {
  return state.recentAddonsIds;
});
const selectInitialized = createSelector(
  [rootSelector],
  (state) => state.initialized,
);

export const AddonsSelectors = {
  selectAddonsIsLoading,
  selectAddonsError,
  selectAddons,
  selectAddonsMap,
  selectRecentAddonsIds,
  selectInitialized,
};
