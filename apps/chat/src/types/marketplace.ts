import { FilterTypes } from '@/src/constants/marketplace';

export interface MarketplaceFilters {
  [FilterTypes.ENTITY_TYPE]: string[];
  [FilterTypes.TOPICS]: string[];
  [FilterTypes.SOURCES]: string[];
  // [FilterTypes.CAPABILITIES]: string[];
  // [FilterTypes.ENVIRONMENT]: string[];
}

export enum PreviewMode {
  half,
  full,
  closed,
}
