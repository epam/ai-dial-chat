import { IconBook2, IconMessage } from '@tabler/icons-react';
import type { FC } from 'react';
import { ROUTES } from '../types/routes';
import { NavigationI18nKeys } from './translation-keys';

interface NavigationItem {
  path: string;
  icon: FC<{ size?: number; stroke?: number }>;
  labelKey: NavigationI18nKeys;
}

export const NAVIGATION_CONFIG: NavigationItem[] = [
  {
    path: ROUTES.Root,
    icon: IconMessage,
    labelKey: NavigationI18nKeys.Home,
  },
  {
    path: ROUTES.Catalog,
    icon: IconBook2,
    labelKey: NavigationI18nKeys.Catalog,
  },
];
