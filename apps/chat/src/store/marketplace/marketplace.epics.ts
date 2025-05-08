import Router from 'next/router';

import { EMPTY, concat, filter, of, switchMap } from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { parseCommaSeparatedList } from '@/src/utils/app/common';

import { EntityType, SortOrder } from '@/src/types/common';
import { AppEpic } from '@/src/types/store';

import { ModelsActions } from '@/src/store/models/models.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';
import { UISelectors } from '@/src/store/ui/ui.selectors';

import {
  ENTITY_TYPES,
  FilterTypes,
  MarketplaceQueryParams,
  MarketplaceTabs,
  SourceType,
  TableColumnSortKeys,
  ViewTypes,
} from '@/src/constants/marketplace';

import { ModelsSelectors } from '../models/models.selectors';
import { MarketplaceActions } from './marketplace.reducers';
import { MarketplaceSelectors } from './marketplace.selectors';
import { MarketplaceState } from './marketplace.types';

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

const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(MarketplaceActions.init.type),
    switchMap(() => {
      const query = parse(window.location.search.slice(1));
      const workSpaceTab =
        query[MarketplaceQueryParams.fromConversation] ||
        query[MarketplaceQueryParams.tab] === MarketplaceTabs.MY_WORKSPACE;

      const previousRoute = UISelectors.selectPreviousRoute(state$.value);
      const firstRoutePart = previousRoute?.split('/')[1];

      return concat(
        of(
          MarketplaceActions.initSuccess({
            saveFilters: firstRoutePart === 'apps-editor',
          }),
        ),
        of(
          MarketplaceActions.setSelectedTab(
            workSpaceTab ? MarketplaceTabs.MY_WORKSPACE : MarketplaceTabs.HOME,
          ),
        ),
      );
    }),
  );

const setQueryParamsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(
      MarketplaceActions.setSelectedTab.type,
      MarketplaceActions.setDetailsModel.type,
      MarketplaceActions.setSelectedFilters.type,
      MarketplaceActions.setState.type,
      MarketplaceActions.setSearchTerm.type,
      MarketplaceActions.setSelectedView.type,
      MarketplaceActions.setTableSort.type,
    ),
    filter(() => ModelsSelectors.selectAreModelsLoaded(state$.value)),
    switchMap(() => {
      const state = state$.value;
      const query = parse(window.location.search.slice(1));
      const pathname = window.location.pathname;
      // workspace tab
      const selectedTab = MarketplaceSelectors.selectSelectedTab(state);
      addToQuery(
        query,
        MarketplaceQueryParams.tab,
        selectedTab === MarketplaceTabs.MY_WORKSPACE
          ? MarketplaceTabs.MY_WORKSPACE
          : undefined,
      );
      // application link
      const reference =
        MarketplaceSelectors.selectDetailsModel(state)?.reference;
      addToQuery(query, MarketplaceQueryParams.model, reference ?? undefined);
      // filters
      const filters = MarketplaceSelectors.selectSelectedFilters(state);
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
      const searchTerm = MarketplaceSelectors.selectSearchTerm(state);
      addToQuery(
        query,
        MarketplaceQueryParams.search,
        searchTerm ? searchTerm : undefined,
      );
      // view
      const viewType = MarketplaceSelectors.selectSelectedViewType(state);
      addToQuery(
        query,
        MarketplaceQueryParams.viewType,
        viewType !== ViewTypes.CARD ? viewType : undefined,
      );
      const tableSort = MarketplaceSelectors.selectTableSort(state);
      addToQuery(
        query,
        MarketplaceQueryParams.tableSort,
        viewType !== ViewTypes.CARD
          ? `${tableSort.column}-${tableSort.order}`
          : undefined,
      );

      Router.push(
        {
          pathname,
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
    ofType(MarketplaceActions.initQueryParams.type),
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
      const topics = parseCommaSeparatedList(
        query[MarketplaceQueryParams.topics] as string,
      ).filter((topic) => topic && existingTopics.includes(topic));

      const types = parseCommaSeparatedList(
        query[MarketplaceQueryParams.types] as string,
      ).filter((type) => type && ENTITY_TYPES.includes(type as EntityType));
      const sourceTypes = MarketplaceSelectors.selectSourceTypes(state);
      const sources = parseCommaSeparatedList(
        query[MarketplaceQueryParams.sources] as string,
      ).filter((type) => type && sourceTypes.includes(type as SourceType));

      updatedMarketplaceState.selectedFilters = {
        [FilterTypes.ENTITY_TYPE]: types,
        [FilterTypes.TOPICS]: topics,
        [FilterTypes.SOURCES]: sources,
      };
      // search
      updatedMarketplaceState.searchTerm =
        (query[MarketplaceQueryParams.search] as string) ?? '';
      // viewType
      updatedMarketplaceState.selectedView =
        (query[MarketplaceQueryParams.viewType] as ViewTypes) ?? ViewTypes.CARD;
      // table sort
      const tableSortQuery = query[MarketplaceQueryParams.tableSort];
      if (typeof tableSortQuery === 'string') {
        const splittedTableSortQuery = tableSortQuery.split('-');
        const tableSortColumn = (
          splittedTableSortQuery[0] in TableColumnSortKeys
            ? splittedTableSortQuery[0]
            : TableColumnSortKeys.NAME
        ) as TableColumnSortKeys;
        const tableSortOrder: SortOrder =
          splittedTableSortQuery[1] === 'desc' ? 'desc' : 'asc';
        updatedMarketplaceState.tableSort = {
          column: tableSortColumn,
          order: tableSortOrder,
        };
      }

      return concat(
        of(MarketplaceActions.setState(updatedMarketplaceState)),
        modelReference && !model
          ? of(UIActions.showErrorToast('Agent by this link not found'))
          : EMPTY,
      );
    }),
  );

const updateFiltersEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ModelsActions.deleteModels.type, ModelsActions.updateModel.type),
    switchMap(() => {
      const state = state$.value;

      const existingTopics = ModelsSelectors.selectModelTopics(state);
      const sourceTypes = MarketplaceSelectors.selectSourceTypes(state);
      const filters = MarketplaceSelectors.selectSelectedFilters(state);
      const updatedFilters = { ...filters };
      updatedFilters.Topics = filters.Topics.filter((topic) =>
        existingTopics.includes(topic),
      );
      updatedFilters.Sources = filters.Sources.filter((source) =>
        sourceTypes.includes(source as SourceType),
      );
      if (
        updatedFilters.Topics.length !== filters.Topics.length ||
        updatedFilters.Sources.length !== filters.Sources.length
      ) {
        return of(
          MarketplaceActions.setState({
            selectedFilters: updatedFilters,
          }),
        );
      }

      return EMPTY;
    }),
  );

export const MarketplaceEpics = combineEpics(
  initEpic,
  initQueryParamsEpic,
  setQueryParamsEpic,
  updateFiltersEpic,
);
