import { IconBook, IconMessage } from '@tabler/icons-react';
import type { FC } from 'react';
import { NavigationI18nKeys } from './translation-keys';

export interface NavigationItem {
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
  {
    path: '/catalog',
    icon: IconBook,
    labelKey: NavigationI18nKeys.Catalog,
  },
];
