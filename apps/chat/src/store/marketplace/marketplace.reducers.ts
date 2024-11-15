import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { FilterTypes, MarketplaceTabs } from '@/src/constants/marketplace';

import * as MarketplaceSelectors from './marketplace.selectors';

import { UploadStatus } from '@epam/ai-dial-shared';
import xor from 'lodash/xor';

export { MarketplaceSelectors };

export interface MarketplaceState {
  selectedFilters: {
    [FilterTypes.ENTITY_TYPE]: string[];
    [FilterTypes.TOPICS]: string[];
    // [FilterTypes.CAPABILITIES]: string[];
    // [FilterTypes.ENVIRONMENT]: string[];
  };
  searchTerm: string;
  selectedTab: MarketplaceTabs;

  applyModelStatus: UploadStatus;
}

const DEFAULT_FILTERS = {
  [FilterTypes.ENTITY_TYPE]: [],
  [FilterTypes.TOPICS]: [],
  // [FilterTypes.CAPABILITIES]: [],
  // [FilterTypes.ENVIRONMENT]: [],
};

const initialState: MarketplaceState = {
  selectedFilters: DEFAULT_FILTERS,
  searchTerm: '',
  selectedTab: MarketplaceTabs.HOME,
  applyModelStatus: UploadStatus.UNINITIALIZED,
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
    setSearchTerm: (state, { payload }: PayloadAction<string>) => {
      state.searchTerm = payload;
    },
    setSelectedTab: (state, { payload }: PayloadAction<MarketplaceTabs>) => {
      state.selectedTab = payload;
    },
    resetFiltering: (state) => {
      state.searchTerm = '';
      state.selectedFilters = DEFAULT_FILTERS;
    },
    setApplyModelStatus: (state, { payload }: PayloadAction<UploadStatus>) => {
      state.applyModelStatus = payload;
    },
  },
});

export const MarketplaceActions = marketplaceSlice.actions;
