import { getEntitySearchOptions } from '@/src/utils/app/search';

import { MarketplaceEntity } from '@/src/types/marketplace';

export const MARKETPLACE_ENTITIES_SEARCH_OPTIONS =
  getEntitySearchOptions<MarketplaceEntity>();
