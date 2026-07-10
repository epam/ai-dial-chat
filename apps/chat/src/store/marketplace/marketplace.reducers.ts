import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { SortOrder } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { ToolsetModel } from '@/src/types/toolsets';

import { MarketplaceState } from '@/src/store/marketplace/marketplace.types';

import {
  DeleteType,
  FilterTypes,
  MarketplaceEntitiesTabs,
  MarketplaceTabs,
  TableColumnSortKeys,
  ViewTypes,
} from '@/src/constants/marketplace';

import { UploadStatus } from '@epam/ai-dial-shared';
import xor from 'lodash/xor';

const DEFAULT_FILTERS = {
  [FilterTypes.ENTITY_TYPE]: [],
  [FilterTypes.TOPICS]: [],
  [FilterTypes.SOURCES]: [],
  // [FilterTypes.CAPABILITIES]: [],
  // [FilterTypes.ENVIRONMENT]: [],
};

const initialState: MarketplaceState = {
  selectedAgentsFilters: DEFAULT_FILTERS,
  selectedToolsetsFilters: DEFAULT_FILTERS,
  searchTerm: '',
  selectedTab: MarketplaceTabs.HOME,
  selectedEntitiesTab: MarketplaceEntitiesTabs.AGENTS,
  applyModelStatus: UploadStatus.UNINITIALIZED,
  selectedView: ViewTypes.CARD,
  tableSort: {
    column: TableColumnSortKeys.NAME,
    order: 'asc',
  },
  isBannerVisible: true,

  deleteEntity: undefined,
  detailsEntity: undefined,
  loginEntity: undefined,
  connectLinkEntity: undefined,
  repairEntity: undefined,
};

export const marketplaceSlice = createSlice({
  name: 'marketplace',
  initialState,
  reducers: {
    init: (state) => state,
    initSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{ saveFilters: boolean; selectedTab?: MarketplaceTabs }>,
    ) => {
      const selectedTab = payload.selectedTab ?? state.selectedTab;

      if (!payload.saveFilters) {
        return { ...initialState, selectedTab };
      }

      return {
        ...initialState,
        searchTerm: state.searchTerm,
        selectedAgentsFilters: state.selectedAgentsFilters,
        selectedToolsetsFilters: state.selectedToolsetsFilters,
        selectedView: state.selectedView,
        tableSort: state.tableSort,
        selectedEntitiesTab: state.selectedEntitiesTab,
        selectedTab,
        detailsEntity: state.detailsEntity,
      };
    },
    initQueryParams: (state) => state,
    setState: (
      state,
      { payload }: PayloadAction<Partial<MarketplaceState>>,
    ) => {
      return { ...state, ...payload };
    },
    setSelectedAgentsFilters: (
      state,
      { payload }: PayloadAction<{ filterType: FilterTypes; value: string }>,
    ) => {
      state.selectedAgentsFilters[payload.filterType] = xor(
        state.selectedAgentsFilters[payload.filterType],
        [payload.value],
      );
    },
    setSelectedToolsetsFilters: (
      state,
      { payload }: PayloadAction<{ filterType: FilterTypes; value: string }>,
    ) => {
      state.selectedToolsetsFilters[payload.filterType] = xor(
        state.selectedToolsetsFilters[payload.filterType],
        [payload.value],
      );
    },
    setSearchTerm: (state, { payload }: PayloadAction<string>) => {
      state.searchTerm = payload.slice(0, 120); // limit to 120 characters
    },
    setSelectedTab: (state, { payload }: PayloadAction<MarketplaceTabs>) => {
      state.selectedTab = payload;
    },
    setSelectedEntitiesTab: (
      state,
      { payload }: PayloadAction<MarketplaceEntitiesTabs>,
    ) => {
      state.selectedEntitiesTab = payload;
    },
    setApplyModelStatus: (state, { payload }: PayloadAction<UploadStatus>) => {
      state.applyModelStatus = payload;
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
    setDeleteEntity: (
      state,
      {
        payload,
      }: PayloadAction<
        { entity: MarketplaceEntity; action: DeleteType } | undefined
      >,
    ) => {
      state.deleteEntity = payload;
    },
    setDetailsEntity: (
      state,
      {
        payload,
      }: PayloadAction<
        | {
            reference: string;
            isSuggested: boolean;
            type: MarketplaceEntitiesTabs;
          }
        | undefined
      >,
    ) => {
      state.detailsEntity = payload;
    },
    setLoginEntity: (
      state,
      {
        payload,
      }: PayloadAction<
        { toolset: ToolsetModel; disableAdminView?: boolean } | undefined
      >,
    ) => {
      state.loginEntity = payload;
    },
    setShowLoader: (state, { payload }: PayloadAction<boolean>) => {
      state.showLoader = payload;
    },
    setConnectLinkEntity: (
      state,
      { payload }: PayloadAction<MarketplaceEntity | undefined>,
    ) => {
      state.connectLinkEntity = payload;
    },
    setRepairEntity: (
      state,
      { payload }: PayloadAction<ToolsetModel | undefined>,
    ) => {
      state.repairEntity = payload;
    },
  },
});

export const MarketplaceActions = marketplaceSlice.actions;
