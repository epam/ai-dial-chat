import {
  IconClockHour3,
  IconFolderOpen,
  IconLayoutGrid,
  IconMessageCircle,
} from '@tabler/icons-react';
import type { FC } from 'react';
import { ROUTES } from '../types/routes';
import {
  IconClockHour3CustomFilled,
  IconFolderOpenCustomFilled,
  IconLayoutGridCustomFilled,
  IconMessageCircleCustomFilled,
} from './icons/filled-icons';
import { NavigationI18nKeys } from './translation-keys';

export interface NavigationItem {
  path: string;
  matchPaths?: string[];
  icon: FC<{ size?: number; stroke?: number }>;
  /** Filled variant shown in the rail while the item is active. */
  activeIcon?: FC<{ size?: number; stroke?: number }>;
  labelKey: NavigationI18nKeys;
  /** Short `useFeatureFlag` key gating this item's visibility. Omit to always render. */
  featureFlag?: string;
}

export const NAVIGATION_CONFIG: NavigationItem[] = [
  {
    path: ROUTES.Root,
    matchPaths: [ROUTES.Conversations],
    icon: IconMessageCircle,
    activeIcon: IconMessageCircleCustomFilled,
    labelKey: NavigationI18nKeys.Home,
  },
  {
    path: ROUTES.ScheduledTasks,
    icon: IconClockHour3,
    activeIcon: IconClockHour3CustomFilled,
    labelKey: NavigationI18nKeys.ScheduledTasks,
    featureFlag: 'scheduledTasksEnabled',
  },
  {
    path: ROUTES.Catalog,
    icon: IconLayoutGrid,
    activeIcon: IconLayoutGridCustomFilled,
    labelKey: NavigationI18nKeys.Catalog,
  },
  {
    path: ROUTES.FileManager,
    icon: IconFolderOpen,
    activeIcon: IconFolderOpenCustomFilled,
    labelKey: NavigationI18nKeys.FileManager,
  },
];
