import { IconBook2, IconFolderOpen, IconMessage } from '@tabler/icons-react';
import type { FC } from 'react';
import ScheduledTasksIcon from '../components/Icons/ScheduledTasksIcon/ScheduledTasksIcon';
import { ROUTES } from '../types/routes';
import { NavigationI18nKeys } from './translation-keys';

export interface NavigationItem {
  path: string;
  matchPaths?: string[];
  icon: FC<{ size?: number; stroke?: number }>;
  labelKey: NavigationI18nKeys;
  /** Short `useFeatureFlag` key gating this item's visibility. Omit to always render. */
  featureFlag?: string;
}

export const NAVIGATION_CONFIG: NavigationItem[] = [
  {
    path: ROUTES.Root,
    matchPaths: [ROUTES.Conversations],
    icon: IconMessage,
    labelKey: NavigationI18nKeys.Home,
  },
  {
    path: ROUTES.ScheduledTasks,
    icon: ScheduledTasksIcon,
    labelKey: NavigationI18nKeys.ScheduledTasks,
    featureFlag: 'scheduledTasksEnabled',
  },
  {
    path: ROUTES.Catalog,
    icon: IconBook2,
    labelKey: NavigationI18nKeys.Catalog,
  },
  {
    path: ROUTES.FileManager,
    icon: IconFolderOpen,
    labelKey: NavigationI18nKeys.FileManager,
  },
];
