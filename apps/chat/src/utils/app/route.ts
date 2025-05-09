import { BaseRouter } from 'next/dist/shared/lib/router/router';

import { PageType } from '@/src/types/common';

import {
  MarketplaceQueryParams,
  MarketplaceTabs,
} from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

export const getPageType = (route?: string) => {
  switch (route) {
    case Routes.Marketplace:
      return PageType.Marketplace;
    case Routes.AppsEditorSettings:
      return PageType.AppsEditorSettings;
    case Routes.AppsEditorGeneralInfo:
      return PageType.AppsEditorGeneralInfo;
    default:
      return PageType.Chat;
  }
};

export const getPageName = ({ route, query }: BaseRouter) => {
  switch (route) {
    case Routes.Marketplace:
      return query[MarketplaceQueryParams.tab] === MarketplaceTabs.MY_WORKSPACE
        ? 'My Workspace'
        : 'Marketplace';
    case Routes.AppsEditorSettings:
      return 'App Editor Settings';
    case Routes.AppsEditorGeneralInfo:
      return 'App Editor General Info';
    case Routes.Widgets:
      return 'Widgets';
    case Routes.SelectedWidget:
      return 'Selected Widget';
    case Routes.NotFound:
      return 'Not Found';
    default:
      return '';
  }
};

export const getRouteForSlug = (route: Routes, slug: string) =>
  route.replace('[slug]', slug);

export const getAppEditorRoute = (slug: string) =>
  getRouteForSlug(Routes.AppsEditorGeneralInfo, slug);
