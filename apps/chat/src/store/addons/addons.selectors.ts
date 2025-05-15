import { RootState } from '@/src/types/store';

import { AddonsState } from './addons.types';

const rootSelector = (state: RootState): AddonsState => state.addons;

const selectAddons = (state: RootState) => rootSelector(state).addons;

const selectAddonsMap = (state: RootState) => rootSelector(state).addonsMap;

const selectRecentAddonsIds = (state: RootState) =>
  rootSelector(state).recentAddonsIds;

const selectInitialized = (state: RootState) => rootSelector(state).initialized;

export const AddonsSelectors = {
  selectAddons,
  selectAddonsMap,
  selectRecentAddonsIds,
  selectInitialized,
};
