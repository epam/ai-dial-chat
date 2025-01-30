import { ApplicationType } from '../types/applications';
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
  MyCustomApps = 'My Custom Apps',
  MyQuickApps = 'My Quick Apps',
  MyCodeApps = 'My Code Apps',
  MyMindMaps = 'My Mindmaps',
}

export const SourceTypeFilterOrder = {
  [SourceType.Public]: 1,
  [SourceType.SharedWithMe]: 2,
  [SourceType.MyCustomApps]: 3,
  [SourceType.MyQuickApps]: 4,
  [SourceType.MyCodeApps]: 5,
  [SourceType.MyMindMaps]: 6,
};

export const ApplicationTypeToSourceType = {
  [ApplicationType.CODE_APP]: SourceType.MyCodeApps,
  [ApplicationType.QUICK_APP]: SourceType.MyQuickApps,
  [ApplicationType.CUSTOM_APP]: SourceType.MyCustomApps,
  [ApplicationType.MINDMAP]: SourceType.MyMindMaps,
};
