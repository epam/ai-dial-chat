import {
  FilterTypes,
  MarketplaceEntitiesTabs,
} from '@/src/constants/marketplace';

import { DialAIEntityModel } from './models';
import { ToolsetModel } from './toolsets';

export interface MarketplaceFilters {
  [FilterTypes.ENTITY_TYPE]: string[];
  [FilterTypes.TOPICS]: string[];
  [FilterTypes.SOURCES]: string[];
  [FilterTypes.AUTH]: string[];
  // [FilterTypes.CAPABILITIES]: string[];
  // [FilterTypes.ENVIRONMENT]: string[];
}

export enum PreviewMode {
  half = 'half',
  full = 'full',
  closed = 'closed',
}

export type MarketplaceEntity = (DialAIEntityModel | ToolsetModel) & {
  owner?: string;
};

export interface EntitiesGroup<T extends MarketplaceEntity> {
  groupName: string;
  entities: T[];
}

export enum MarketplaceEditorSteps {
  General = 'General',
  Settings = 'Settings',
}

export interface DetailsEntity {
  reference: string;
  isSuggested: boolean;
  type: MarketplaceEntitiesTabs;
}
