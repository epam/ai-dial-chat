import { PageType } from '@/src/types/common';

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

export const getRouteForSlug = (route: Routes, slug: string) =>
  route.replace('[slug]', slug);

export const getAppEditorRoute = (slug: string) =>
  getRouteForSlug(Routes.AppsEditorGeneralInfo, slug);
