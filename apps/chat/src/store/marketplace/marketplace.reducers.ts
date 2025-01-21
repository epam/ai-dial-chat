import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { MarketplaceFilters } from '@/src/types/marketplace';

import { FilterTypes, MarketplaceTabs } from '@/src/constants/marketplace';

import * as MarketplaceSelectors from './marketplace.selectors';

import { UploadStatus } from '@epam/ai-dial-shared';
import xor from 'lodash/xor';

export { MarketplaceSelectors };

export interface MarketplaceState {
  selectedFilters: MarketplaceFilters;
  searchTerm: string;
  selectedTab: MarketplaceTabs;
  applyModelStatus: UploadStatus;
  applyModelId?: string;
  detailsModel: { reference: string; isSuggested: boolean } | undefined;
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
  detailsModel: undefined,
};

export const marketplaceSlice = createSlice({
  name: 'marketplace',
  initialState,
  reducers: {
    initQueryParams: (state) => state,
    setState: (
      state,
      { payload }: PayloadAction<Partial<MarketplaceState>>,
    ) => {
      return { ...state, ...payload };
    },
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
      state.searchTerm = payload.slice(0, 120); // limit to 120 characters
    },
    setSelectedTab: (state, { payload }: PayloadAction<MarketplaceTabs>) => {
      state.selectedTab = payload;
    },
    resetState: () => {
      return initialState;
    },
    setApplyModelStatus: (state, { payload }: PayloadAction<UploadStatus>) => {
      state.applyModelStatus = payload;
    },
    setApplyModelId: (state, { payload }: PayloadAction<string>) => {
      state.applyModelId = payload;
    },
    setDetailsModel: (
      state,
      {
        payload,
      }: PayloadAction<{ reference: string; isSuggested: boolean } | undefined>,
    ) => {
      state.detailsModel = payload;
    },
  },
});

export const MarketplaceActions = marketplaceSlice.actions;
