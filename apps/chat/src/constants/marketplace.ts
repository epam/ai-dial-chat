import { IconPlayerPlay, IconPlaystationSquare } from '@tabler/icons-react';

import {
  ApplicationType,
  SimpleApplicationStatus,
} from '../types/applications';
import { EntityType, ScreenState } from '../types/common';

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

interface IconSize {
  iconSize: number;
  shareIconSize: number;
}

export const CardIconSizes: Record<ScreenState, IconSize> = {
  [ScreenState.DESKTOP]: { iconSize: 80, shareIconSize: 30 },
  [ScreenState.TABLET]: { iconSize: 48, shareIconSize: 20 },
  [ScreenState.MOBILE]: { iconSize: 40, shareIconSize: 16 },
};

export const HeaderIconSizes: Record<ScreenState, IconSize> = {
  [ScreenState.DESKTOP]: { iconSize: 96, shareIconSize: 30 },
  [ScreenState.TABLET]: { iconSize: 96, shareIconSize: 30 },
  [ScreenState.MOBILE]: { iconSize: 48, shareIconSize: 20 },
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
