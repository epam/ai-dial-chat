import { IconPlayerPlay, IconPlaystationSquare } from '@tabler/icons-react';

import {
  ApplicationType,
  SimpleApplicationStatus,
} from '@/src/types/applications';
import { EntityType, ScreenState } from '@/src/types/common';

import Loader from '../components/Common/Loader';

import LoaderIcon from '@/public/images/icons/loader.svg';

export enum MarketplaceQueryParams {
  fromConversation = 'fromConversation',
  model = 'model',
  tab = 'tab',
  types = 'types',
  topics = 'topics',
  search = 'search',
  sources = 'sources',
  viewType = 'viewType',
  tableSort = 'tableSort',
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

export const ChangeAgentTabs = {
  [MarketplaceTabs.MY_WORKSPACE]: 'My agents',
  [MarketplaceTabs.HOME]: 'All agents',
};

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
  [SimpleApplicationStatus.UNDEPLOY]: 'text-error',
  [SimpleApplicationStatus.UPDATING]: 'animate-spin-steps',
};

export const PlayerContextButtonClasses = {
  [SimpleApplicationStatus.DEPLOY]: 'button-accent-secondary',
  [SimpleApplicationStatus.UNDEPLOY]: 'button-error',
  [SimpleApplicationStatus.UPDATING]: '',
};

export const StatusIcons = {
  [SimpleApplicationStatus.DEPLOY]: IconPlayerPlay,
  [SimpleApplicationStatus.UNDEPLOY]: IconPlaystationSquare,
  [SimpleApplicationStatus.UPDATING]: Loader,
};

export const PlayerContextIcons = {
  ...StatusIcons,
  [SimpleApplicationStatus.UPDATING]: LoaderIcon,
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
