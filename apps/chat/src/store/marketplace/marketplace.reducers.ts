import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { SortOrder } from '@/src/types/common';

import {
  FilterTypes,
  MarketplaceTabs,
  TableColumnSortKeys,
  ViewTypes,
} from '@/src/constants/marketplace';

import * as MarketplaceSelectors from './marketplace.selectors';
import { MarketplaceState } from './marketplace.types';

import { UploadStatus } from '@epam/ai-dial-shared';
import xor from 'lodash/xor';

export { MarketplaceSelectors };

const DEFAULT_FILTERS = {
  [FilterTypes.ENTITY_TYPE]: [],
  [FilterTypes.TOPICS]: [],
  [FilterTypes.SOURCES]: [],
  // [FilterTypes.CAPABILITIES]: [],
  // [FilterTypes.ENVIRONMENT]: [],
};

const initialState: MarketplaceState = {
  selectedFilters: DEFAULT_FILTERS,
  searchTerm: '',
  selectedTab: MarketplaceTabs.HOME,
  applyModelStatus: UploadStatus.UNINITIALIZED,
  detailsModel: undefined,
  selectedView: ViewTypes.CARD,
  tableSort: {
    column: TableColumnSortKeys.NAME,
    order: 'asc',
  },
  isBannerVisible: true,
};

export const marketplaceSlice = createSlice({
  name: 'marketplace',
  initialState,
  reducers: {
    init: (state) => state,
    initSuccess: (
      state,
      { payload }: PayloadAction<{ saveFilters: boolean }>,
    ) => {
      if (!payload.saveFilters) {
        return initialState;
      }

      return {
        ...initialState,
        searchTerm: state.searchTerm,
        selectedFilters: state.selectedFilters,
        selectedView: state.selectedView,
        tableSort: state.tableSort,
      };
    },
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
    setSelectedView: (
      state,
      { payload }: PayloadAction<{ viewType: ViewTypes }>,
    ) => {
      state.selectedView = payload.viewType;
    },
    setTableSort: (
      state,
      {
        payload,
      }: PayloadAction<{
        column: TableColumnSortKeys;
        order: SortOrder;
      }>,
    ) => {
      state.tableSort = payload;
    },
    setIsBannerVisible: (
      state,
      {
        payload,
      }: PayloadAction<{
        isVisible: boolean;
      }>,
    ) => {
      state.isBannerVisible = payload.isVisible;
    },
  },
});

export const MarketplaceActions = marketplaceSlice.actions;
