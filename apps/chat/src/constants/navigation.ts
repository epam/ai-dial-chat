import { IconMessage } from '@tabler/icons-react';
import type { FC } from 'react';
import { NavigationI18nKeys } from './translation-keys';

interface NavigationItem {
  path: string;
  icon: FC<{ size?: number; stroke?: number }>;
  labelKey: NavigationI18nKeys;
}

export const NAVIGATION_CONFIG: NavigationItem[] = [
  {
    path: '/',
    icon: IconMessage,
    labelKey: NavigationI18nKeys.Home,
  },
  // TODO: temporarily removed until the catalog page is implemented
  // {
  //   path: '/catalog',
  //   icon: IconBook2,
  //   labelKey: NavigationI18nKeys.Catalog,
  // },
];
