import { SortOrder } from '@/src/types/common';
import {
  DetailsEntity,
  MarketplaceEntity,
  MarketplaceFilters,
} from '@/src/types/marketplace';
import { ToolsetModel } from '@/src/types/toolsets';

import {
  DeleteType,
  MarketplaceEntitiesTabs,
  MarketplaceTabs,
  TableColumnSortKeys,
  ViewTypes,
} from '@/src/constants/marketplace';

import { UploadStatus } from '@epam/ai-dial-shared';

export interface TableSort {
  column: TableColumnSortKeys;
  order: SortOrder;
}

export interface MarketplaceState {
  selectedAgentsFilters: MarketplaceFilters;
  selectedToolsetsFilters: MarketplaceFilters;
  searchTerm: string;
  selectedTab: MarketplaceTabs;
  selectedEntitiesTab: MarketplaceEntitiesTabs;
  applyModelStatus: UploadStatus;
  selectedView: ViewTypes;
  applyModelId?: string;
  tableSort: TableSort;
  isBannerVisible: boolean;

  detailsEntity: DetailsEntity | undefined;
  deleteEntity: { entity: MarketplaceEntity; action: DeleteType } | undefined;
  loginEntity:
    | { toolset: ToolsetModel; disableAdminView?: boolean }
    | undefined;
  connectLinkEntity: MarketplaceEntity | undefined;
  repairEntity: ToolsetModel | undefined;
  showLoader?: boolean;
}
