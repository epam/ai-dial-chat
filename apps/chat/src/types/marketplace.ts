import { FilterTypes } from '../constants/marketplace';

export interface MarketplaceFilters {
  [FilterTypes.ENTITY_TYPE]: string[];
  [FilterTypes.TOPICS]: string[];
  // [FilterTypes.CAPABILITIES]: string[];
  // [FilterTypes.ENVIRONMENT]: string[];
}
