import { SortOrder } from '@/src/types/common';
import { MarketplaceFilters } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';

import {
  DeleteType,
  MarketplaceTabs,
  TableColumnSortKeys,
  ViewTypes,
} from '@/src/constants/marketplace';

import { UploadStatus } from '@epam/ai-dial-shared';

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
  isBannerVisible: boolean;

  deleteModel: { entity: DialAIEntityModel; action: DeleteType } | undefined;
}
