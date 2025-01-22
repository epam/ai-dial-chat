import { EntityType } from '../types/common';

export enum MarketplaceQueryParams {
  fromConversation = 'fromConversation',
  model = 'model',
  tab = 'tab',
  types = 'types',
  topics = 'topics',
  search = 'search',
}

export enum FilterTypes {
  ENTITY_TYPE = 'Type',
  TOPICS = 'Topics',
  // CAPABILITIES = 'Capabilities',
  // ENVIRONMENT = 'Environment',
}

export enum MarketplaceTabs {
  HOME = 'marketplace',
  MY_WORKSPACE = 'workspace',
}

export enum DeleteType {
  DELETE,
  REMOVE,
}

export const ENTITY_TYPES = [
  EntityType.Model,
  EntityType.Assistant,
  EntityType.Application,
];
