import { SortOrder } from '@/src/types/common';
import { MarketplaceEntity, MarketplaceFilters } from '@/src/types/marketplace';

import {
  DeleteType,
  MarketplaceEntitiesTabs,
  MarketplaceTabs,
  TableColumnSortKeys,
  ViewTypes,
} from '@/src/constants/marketplace';

import { UploadStatus } from '@epam/ai-dial-shared';

export interface MarketplaceState {
  selectedFilters: MarketplaceFilters;
  searchTerm: string;
  selectedTab: MarketplaceTabs;
  selectedEntitiesTab: MarketplaceEntitiesTabs;
  applyModelStatus: UploadStatus;
  selectedView: ViewTypes;
  applyModelId?: string;
  tableSort: {
    column: TableColumnSortKeys;
    order: SortOrder;
  };
  isBannerVisible: boolean;

  detailsEntity:
    | { entity: MarketplaceEntity; isSuggested: boolean }
    | undefined;
  deleteEntity: { entity: MarketplaceEntity; action: DeleteType } | undefined;
}
