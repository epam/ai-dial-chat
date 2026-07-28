import {
  IconCloudDownload,
  IconCloudUpload,
  IconRefresh,
} from '@tabler/icons-react';

import {
  ApplicationType,
  SimpleApplicationStatus,
} from '@/src/types/applications';
import { EntityType, ScreenState } from '@/src/types/common';

import { MarketplaceI18nKeys } from './i18n';

import LoaderIcon from '@/public/images/icons/loader.svg';

export enum MarketplaceQueryParams {
  fromConversation = 'fromConversation',
  model = 'model',
  toolset = 'toolset',
  tab = 'tab',
  entitiesTab = 'entitiesTab',
  types = 'types',
  topics = 'topics',
  search = 'search',
  sources = 'sources',
  auth = 'auth',
  viewType = 'viewType',
  tableSort = 'tableSort',
}

export enum FilterTypes {
  ENTITY_TYPE = 'Type',
  TOPICS = 'Topics',
  SOURCES = 'Sources',
  AUTH = 'Authentication',
  // CAPABILITIES = 'Capabilities',
  // ENVIRONMENT = 'Environment',
}

export enum ToolsetAuthFilter {
  LoggedOut = 'Logged out',
  MyCreds = 'My creds',
  OrgCreds = 'Org creds',
  WithoutAuth = 'Without Authentication',
}

export const TOOLSET_AUTH_FILTER_VALUES = [
  ToolsetAuthFilter.LoggedOut,
  ToolsetAuthFilter.MyCreds,
  ToolsetAuthFilter.OrgCreds,
  ToolsetAuthFilter.WithoutAuth,
];

export enum MarketplaceTabs {
  HOME = 'marketplace',
  MY_WORKSPACE = 'workspace',
}

export enum MarketplaceEntitiesTabs {
  AGENTS = 'agents',
  TOOLSETS = 'toolsets',
}

export const ChangeMarketplaceTabs = {
  [MarketplaceTabs.MY_WORKSPACE]: 'My workspace',
  [MarketplaceTabs.HOME]: 'Marketplace',
};

export enum DeleteType {
  DELETE = 'Delete',
  REMOVE = 'Remove',
}

export const ENTITY_TYPES = [EntityType.Application, EntityType.Model];

export enum SourceType {
  Public = 'Public',
  SharedWithMe = 'Shared with me',
  MyCustomApps = 'My Custom apps',
  MyCodeApps = 'My Code apps',
  MyToolsets = 'My Toolsets',
}

export const ApplicationTypeToSourceType = {
  [ApplicationType.CODE_APP]: SourceType.MyCodeApps,
  [ApplicationType.CUSTOM_APP]: SourceType.MyCustomApps,
};

interface IconSize {
  iconSize: number;
  shareIconSize: number;
}

export const TableIconSizes: Record<ScreenState, IconSize> = {
  [ScreenState.XL5]: { iconSize: 60, shareIconSize: 24 },
  [ScreenState.XL4]: { iconSize: 60, shareIconSize: 24 },
  [ScreenState.XL3]: { iconSize: 60, shareIconSize: 24 },
  [ScreenState.XL]: { iconSize: 60, shareIconSize: 24 },
  [ScreenState.MD]: { iconSize: 60, shareIconSize: 24 },
  [ScreenState.SM]: { iconSize: 30, shareIconSize: 14 },
};

export const CardIconSizes: Record<ScreenState, IconSize> = {
  [ScreenState.XL5]: { iconSize: 80, shareIconSize: 30 },
  [ScreenState.XL4]: { iconSize: 80, shareIconSize: 30 },
  [ScreenState.XL3]: { iconSize: 80, shareIconSize: 30 },
  [ScreenState.XL]: { iconSize: 80, shareIconSize: 30 },
  [ScreenState.MD]: { iconSize: 48, shareIconSize: 20 },
  [ScreenState.SM]: { iconSize: 40, shareIconSize: 16 },
};

export const HeaderIconSizes: Record<ScreenState, IconSize> = {
  [ScreenState.XL5]: { iconSize: 96, shareIconSize: 30 },
  [ScreenState.XL4]: { iconSize: 96, shareIconSize: 30 },
  [ScreenState.XL3]: { iconSize: 96, shareIconSize: 30 },
  [ScreenState.XL]: { iconSize: 96, shareIconSize: 30 },
  [ScreenState.MD]: { iconSize: 96, shareIconSize: 30 },
  [ScreenState.SM]: { iconSize: 48, shareIconSize: 20 },
};

export const PlayerContextIconClasses = {
  [SimpleApplicationStatus.DEPLOY]: 'text-accent-secondary',
  [SimpleApplicationStatus.UNDEPLOY]: '!text-error',
  [SimpleApplicationStatus.UPDATING]: 'animate-spin-steps',
  [SimpleApplicationStatus.REDEPLOY]: '!text-accent-secondary',
};

export const PlayerContextButtonClasses = {
  [SimpleApplicationStatus.DEPLOY]: 'button-accent-secondary',
  [SimpleApplicationStatus.UNDEPLOY]: '!button-error',
  [SimpleApplicationStatus.UPDATING]: '',
  [SimpleApplicationStatus.REDEPLOY]: '!button-accent-secondary',
};

export const PlayerContextIcons = {
  [SimpleApplicationStatus.DEPLOY]: IconCloudUpload,
  [SimpleApplicationStatus.UNDEPLOY]: IconCloudDownload,
  [SimpleApplicationStatus.UPDATING]: LoaderIcon,
  [SimpleApplicationStatus.REDEPLOY]: IconRefresh,
};

export enum ViewTypes {
  CARD = 'CARD',
  TABLE = 'TABLE',
}

export enum TableColumnSortKeys {
  NAME = 'NAME',
  OWNER = 'OWNER',
  RELEASED = 'RELEASED',
  // TODO: uncomment when will be decided how to sort by these fields
  // VERSION = 'VERSION',
  // TOPICS = 'TOPICS',
}

export const FEATURED_HEADER_SENTINEL = '__FEATURED__';
export const ALL_APPS_HEADER_SENTINEL = '__ALL_APPS__';
export const SUGGESTED_HEADER_SENTINEL = '__SUGGESTED__';

export const SENTINEL_DATA: Record<string, { label: string; dataQa: string }> =
  {
    [FEATURED_HEADER_SENTINEL]: {
      label: MarketplaceI18nKeys.Featured,
      dataQa: 'marketplace-featured-label',
    },
    [ALL_APPS_HEADER_SENTINEL]: {
      label: MarketplaceI18nKeys.AllApplications,
      dataQa: 'marketplace-all-apps',
    },
    [SUGGESTED_HEADER_SENTINEL]: {
      label: MarketplaceI18nKeys.SuggestedResults,
      dataQa: 'marketplace-suggestions-label',
    },
  };
