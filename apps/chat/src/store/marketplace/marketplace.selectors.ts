import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '../index';
import { MarketplaceState } from './marketplace.reducers';

const rootSelector = (state: RootState): MarketplaceState => state.marketplace;

export const selectSelectedFilters = createSelector(
  [rootSelector],
  (state) => state.selectedFilters,
);

export const selectSearchQuery = createSelector(
  [rootSelector],
  (state) => state.searchQuery,
);
