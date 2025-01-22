import { EMPTY, concat, filter, of, switchMap } from 'rxjs';

import { combineEpics } from 'redux-observable';

import { EntityType } from '@/src/types/common';
import { AppEpic } from '@/src/types/store';

import {
  ENTITY_TYPES,
  FilterTypes,
  MarketplaceQueryParams,
  MarketplaceTabs,
  SOURCE_TYPES,
  SourceType,
} from '@/src/constants/marketplace';

import { ModelsSelectors } from '../models/models.reducers';
import { UIActions } from '../ui/ui.reducers';
import { MarketplaceActions, MarketplaceState } from './marketplace.reducers';
import {
  selectDetailsModel,
  selectSearchTerm,
  selectSelectedFilters,
  selectSelectedTab,
} from './marketplace.selectors';

import { ParsedUrlQueryInput, parse } from 'querystring';

const addToQuery = (
  query: ParsedUrlQueryInput,
  key: string,
  value: string | undefined,
) => {
  if (value !== undefined) {
    query[key] = value;
  } else {
    delete query[key];
  }
};

const setQueryParamsEpic: AppEpic = (action$, state$, { router }) =>
  action$.pipe(
    filter(
      (action) =>
        MarketplaceActions.setSelectedTab.match(action) ||
        MarketplaceActions.setDetailsModel.match(action) ||
        MarketplaceActions.setSelectedFilters.match(action) ||
        MarketplaceActions.setState.match(action) ||
        MarketplaceActions.setSearchTerm.match(action),
    ),
    switchMap(() => {
      const state = state$.value;
      const query = parse(window.location.search.slice(1));
      // workspace tab
      const selectedTab = selectSelectedTab(state);
      addToQuery(
        query,
        MarketplaceQueryParams.tab,
        selectedTab === MarketplaceTabs.MY_WORKSPACE
          ? MarketplaceTabs.MY_WORKSPACE
          : undefined,
      );
      // application link
      const reference = selectDetailsModel(state)?.reference;
      addToQuery(
        query,
        MarketplaceQueryParams.model,
        reference ? reference : undefined,
      );
      // filters
      const filters = selectSelectedFilters(state);
      addToQuery(
        query,
        MarketplaceQueryParams.types,
        filters.Type.length ? filters.Type.join(',') : undefined,
      );
      addToQuery(
        query,
        MarketplaceQueryParams.topics,
        filters.Topics.length ? filters.Topics.join(',') : undefined,
      );
      addToQuery(
        query,
        MarketplaceQueryParams.sources,
        filters.Sources.length ? filters.Sources.join(',') : undefined,
      );
      // search
      const searchTerm = selectSearchTerm(state);
      addToQuery(
        query,
        MarketplaceQueryParams.search,
        searchTerm ? searchTerm : undefined,
      );

      router.push(
        {
          query,
        },
        undefined,
        { shallow: true },
      );
      return EMPTY;
    }),
  );

const initQueryParamsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(MarketplaceActions.initQueryParams.match),
    switchMap(() => {
      const query = parse(window.location.search.slice(1));
      const state = state$.value;

      const updatedMarketplaceState: Partial<MarketplaceState> = {};
      // application link
      const modelReference = query[MarketplaceQueryParams.model];
      const modelsMap = ModelsSelectors.selectModelsMap(state);
      const model =
        typeof modelReference === 'string'
          ? modelsMap[modelReference]
          : undefined;
      updatedMarketplaceState.detailsModel =
        modelReference && model
          ? {
              reference: modelReference as string,
              isSuggested: false,
            }
          : undefined;
      // workspace tab
      const workSpaceTab =
        query[MarketplaceQueryParams.fromConversation] ||
        query[MarketplaceQueryParams.tab] === MarketplaceTabs.MY_WORKSPACE;

      updatedMarketplaceState.selectedTab = workSpaceTab
        ? MarketplaceTabs.MY_WORKSPACE
        : MarketplaceTabs.HOME;
      // filters
      const existingTopics = ModelsSelectors.selectModelTopics(state);
      const topics = ((query[MarketplaceQueryParams.topics] as string) ?? '')
        .split(',')
        .filter((topic) => topic && existingTopics.includes(topic));

      const types = ((query[MarketplaceQueryParams.types] as string) ?? '')
        .split(',')
        .filter((type) => type && ENTITY_TYPES.includes(type as EntityType));

      const sources = ((query[MarketplaceQueryParams.sources] as string) ?? '')
        .split(',')
        .filter((type) => type && SOURCE_TYPES.includes(type as SourceType));

      updatedMarketplaceState.selectedFilters = {
        [FilterTypes.ENTITY_TYPE]: types,
        [FilterTypes.TOPICS]: topics,
        [FilterTypes.SOURCES]: sources,
      };
      // search
      updatedMarketplaceState.searchTerm =
        (query[MarketplaceQueryParams.search] as string) ?? '';

      return concat(
        of(MarketplaceActions.setState(updatedMarketplaceState)),
        modelReference && !model
          ? of(UIActions.showErrorToast('Agent by this link not found'))
          : EMPTY,
      );
    }),
  );

export const MarketplaceEpics = combineEpics(
  initQueryParamsEpic,
  setQueryParamsEpic,
);
