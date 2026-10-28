import {
  IconBriefcase,
  IconBriefcaseFilled,
  IconCirclePlusFilled,
  IconClockHour3,
  IconFolderOpen,
  IconLayoutGrid,
} from '@tabler/icons-react';
import type { FC } from 'react';
import { ROUTES } from '../types/routes';
import {
  IconClockHour3CustomFilled,
  IconFolderOpenCustomFilled,
  IconLayoutGridCustomFilled,
  IconPlusCircle,
} from './icons/filled-icons';
import { ButtonsI18nKeys, NavigationI18nKeys } from './translation-keys';

export interface NavigationItem {
  path: string;
  /** Extra path prefixes (besides `path`) on which the item counts as active. */
  matchPaths?: string[];
  /** When `true` the item is active only on its exact `path`, ignoring `matchPaths`. */
  isExactMatch?: boolean;
  icon: FC<{ size?: number; stroke?: number }>;
  /** Filled variant shown while the item is active. */
  activeIcon?: FC<{ size?: number; stroke?: number }>;
  labelKey: NavigationI18nKeys | ButtonsI18nKeys;
  /** Short `useFeatureFlag` key gating this item's visibility. Omit to always render. */
  featureFlag?: string;
}

export const NAVIGATION_CONFIG: NavigationItem[] = [
  {
    path: ROUTES.Root,
    isExactMatch: true,
    icon: IconPlusCircle,
    activeIcon: IconCirclePlusFilled,
    labelKey: ButtonsI18nKeys.NewChat,
  },
  {
    path: ROUTES.Projects,
    icon: IconBriefcase,
    activeIcon: IconBriefcaseFilled,
    labelKey: NavigationI18nKeys.Projects,
    featureFlag: 'projectsEnabled',
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
