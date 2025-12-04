import { BaseRouter } from 'next/dist/shared/lib/router/router';

import { PageType } from '@/src/types/common';
import { MarketplaceEditorSteps } from '@/src/types/marketplace';

import { AppsEditorQuery } from '@/src/constants/applications';
import {
  MarketplaceQueryParams,
  MarketplaceTabs,
} from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

import { cleanSchemaId } from './application-type-schema';

export const getPageType = (route?: string) => {
  switch (route) {
    case Routes.Marketplace:
      return PageType.Marketplace;
    case Routes.ToolsetEditor:
      return PageType.ToolsetEditor;
    case Routes.AppsEditor:
      return PageType.AppsEditor;
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
    case Routes.AppsEditor:
      return 'App Editor';
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

export const getAppEditorCreateModeRoute = (type: string) => ({
  pathname: Routes.AppsEditor,
  query: {
    [AppsEditorQuery.Step]: MarketplaceEditorSteps.General,
    [AppsEditorQuery.Schema]: cleanSchemaId(type),
    [AppsEditorQuery.ReturnUrl]:
      window.location.pathname + window.location.search,
    [AppsEditorQuery.IsCreating]: '1',
  },
});
