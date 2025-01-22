import { EntityType } from '../types/common';

export enum MarketplaceQueryParams {
  fromConversation = 'fromConversation',
  model = 'model',
  tab = 'tab',
  types = 'types',
  topics = 'topics',
  search = 'search',
  sources = 'sources',
}

export enum FilterTypes {
  ENTITY_TYPE = 'Type',
  TOPICS = 'Topics',
  SOURCES = 'Sources',
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

export enum SourceType {
  Public = 'Public',
  SharedWithMe = 'Shared with me',
  CreatedByMe = 'Created by me',
}

export const SOURCE_TYPES = [
  SourceType.Public,
  SourceType.SharedWithMe,
  SourceType.CreatedByMe,
];
