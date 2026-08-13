import { BaseRouter } from 'next/dist/shared/lib/router/router';

import { PageType } from '@/src/types/common';
import { MarketplaceEditorSteps } from '@/src/types/marketplace';

import { AppsEditorQuery } from '@/src/constants/applications';
import { CommonI18nKeys } from '@/src/constants/i18n';
import {
  MarketplaceQueryParams,
  MarketplaceTabs,
} from '@/src/constants/marketplace';
import { QUERY_VALUE_TRUE, Routes } from '@/src/constants/routes';

import { cleanSchemaId } from './application-type-schema';

type RouterPrefixes = Pick<BaseRouter, 'basePath' | 'locales'>;

/**
 * `window.location.pathname` contains the `basePath` and, for any non-default
 * locale, the locale sub-path (e.g. `/base/ru/marketplace`), while `Routes.*`
 * are plain internal routes (e.g. `/marketplace`). This strips both prefixes so
 * the two can be compared and so the result can be safely passed to
 * `router.push` (which re-adds `basePath`/locale itself).
 */
export const getInternalPathname = (
  pathname: string,
  router?: RouterPrefixes,
): string => {
  let result = pathname;

  const basePath = router?.basePath ?? '';
  if (basePath && (result === basePath || result.startsWith(`${basePath}/`))) {
    result = result.slice(basePath.length);
  }

  const segments = result.split('/').filter(Boolean);
  if (segments.length && router?.locales?.includes(segments[0])) {
    segments.shift();
    result = segments.length ? `/${segments.join('/')}` : '/';
  }

  return result || '/';
};

export const isInternalRoute = (
  pathname: string,
  route: Routes,
  router?: RouterPrefixes,
): boolean => getInternalPathname(pathname, router) === route;

export const getPageType = (route?: string) => {
  switch (route) {
    case Routes.Marketplace:
      return PageType.Marketplace;
    case Routes.ToolsetEditor:
      return PageType.ToolsetEditor;
    case Routes.AppsEditor:
      return PageType.AppsEditor;
    case Routes.FileManager:
      return PageType.FileManager;
    default:
      return PageType.Chat;
  }
};

export const getPageName = ({ route, query }: BaseRouter) => {
  switch (route) {
    case Routes.Marketplace:
      return query[MarketplaceQueryParams.tab] === MarketplaceTabs.MY_WORKSPACE
        ? CommonI18nKeys.PageMyWorkspace
        : CommonI18nKeys.PageMarketplace;
    case Routes.AppsEditor:
      return CommonI18nKeys.PageAppEditor;
    case Routes.ToolsetEditor:
      return CommonI18nKeys.PageToolsetEditor;
    case Routes.ToolsetSignIn:
      return CommonI18nKeys.PageToolsetSignIn;
    case Routes.FileManager:
      return CommonI18nKeys.PageFiles;
    case Routes.Widgets:
      return CommonI18nKeys.PageWidgets;
    case Routes.SelectedWidget:
      return CommonI18nKeys.PageSelectedWidget;
    case Routes.NotFound:
      return CommonI18nKeys.PageNotFoundTitle;
    default:
      return '';
  }
};

export const isTruthyQuery = (value?: string | string[]) =>
  value?.toString() === QUERY_VALUE_TRUE;

export const getAppEditorCreateModeRoute = (type: string) => ({
  pathname: Routes.AppsEditor,
  query: {
    [AppsEditorQuery.Step]: MarketplaceEditorSteps.General,
    [AppsEditorQuery.Schema]: cleanSchemaId(type),
    [AppsEditorQuery.ReturnUrl]:
      window.location.pathname + window.location.search,
    [AppsEditorQuery.IsCreating]: QUERY_VALUE_TRUE,
  },
});
