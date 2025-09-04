import { FilterTypes } from '@/src/constants/marketplace';

import { DialAIEntityModel } from './models';
import { ToolsetModel } from './toolsets';

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

export type MarketplaceEntity = DialAIEntityModel | ToolsetModel;

export interface EntitiesGroup {
  groupName: string;
  entities: MarketplaceEntity[];
}
