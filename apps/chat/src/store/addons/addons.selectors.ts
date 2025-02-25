import { createSelector } from '@reduxjs/toolkit';

import { AddonsState } from '@/src/types/addons';

import { RootState } from '@/src/types/store';

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
