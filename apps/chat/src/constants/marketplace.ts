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
  EntityType.Application,
  EntityType.Assistant,
  EntityType.Model,
];

export enum SourceType {
  Public = 'Public',
  SharedWithMe = 'Shared with me',
  MyCustomApps = 'My Custom apps',
  MyQuickApps = 'My Quick apps',
  MyCodeApps = 'My Code apps',
  MyMindMaps = 'My Mindmaps',
}

export const SourceTypeFilterOrder = {
  [SourceType.MyCodeApps]: 1,
  [SourceType.MyCustomApps]: 2,
  [SourceType.MyMindMaps]: 3,
  [SourceType.MyQuickApps]: 4,
  [SourceType.Public]: 5,
  [SourceType.SharedWithMe]: 6,
};

export const ApplicationTypeToSourceType = {
  [ApplicationType.CODE_APP]: SourceType.MyCodeApps,
  [ApplicationType.QUICK_APP]: SourceType.MyQuickApps,
  [ApplicationType.CUSTOM_APP]: SourceType.MyCustomApps,
  [ApplicationType.MINDMAP]: SourceType.MyMindMaps,
};
