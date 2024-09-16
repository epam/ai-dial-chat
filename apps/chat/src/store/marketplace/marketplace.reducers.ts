import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { FilterTypes } from '@/src/constants/marketplace';

import * as MarketplaceSelectors from './marketplace.selectors';

import xor from 'lodash/xor';

export { MarketplaceSelectors };

export interface MarketplaceState {
  selectedFilters: {
    [FilterTypes.ENTITY_TYPE]: string[];
    [FilterTypes.TOPICS]: string[];
    [FilterTypes.CAPABILITIES]: string[];
    [FilterTypes.ENVIRONMENT]: string[];
  };
  searchQuery: string;
}

const initialState: MarketplaceState = {
  selectedFilters: {
    [FilterTypes.ENTITY_TYPE]: [],
    [FilterTypes.TOPICS]: [],
    [FilterTypes.CAPABILITIES]: [],
    [FilterTypes.ENVIRONMENT]: [],
  },
  searchQuery: '',
};

export const marketplaceSlice = createSlice({
  name: 'marketplace',
  initialState,
  reducers: {
    setSelectedFilters: (
      state,
      { payload }: PayloadAction<{ filterType: FilterTypes; value: string }>,
    ) => {
      state.selectedFilters[payload.filterType] = xor(
        state.selectedFilters[payload.filterType],
        [payload.value],
      );
    },
    setSearchQuery: (
      state,
      { payload }: PayloadAction<{ searchQuery: string }>,
    ) => {
      state.searchQuery = payload.searchQuery;
    },
  },
});

export const MarketplaceActions = marketplaceSlice.actions;
