import { SortOrder } from '@/src/types/common';

import {
  FilterTypes,
  MarketplaceTabs,
  TableColumnSortKeys,
  ViewTypes,
} from '../constants/marketplace';

import { UploadStatus } from '@epam/ai-dial-shared';

export interface MarketplaceFilters {
  [FilterTypes.ENTITY_TYPE]: string[];
  [FilterTypes.TOPICS]: string[];
  [FilterTypes.SOURCES]: string[];
  // [FilterTypes.CAPABILITIES]: string[];
  // [FilterTypes.ENVIRONMENT]: string[];
}

export interface MarketplaceState {
  selectedFilters: MarketplaceFilters;
  searchTerm: string;
  selectedTab: MarketplaceTabs;
  applyModelStatus: UploadStatus;
  selectedView: ViewTypes;
  applyModelId?: string;
  detailsModel: { reference: string; isSuggested: boolean } | undefined;
  tableSort: {
    column: TableColumnSortKeys;
    order: SortOrder;
  };
}
