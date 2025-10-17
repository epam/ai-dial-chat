import Router from 'next/router';

import { EMPTY, concat, filter, iif, of, switchMap } from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { isDialAiEntityModel } from '@/src/utils/app/application';
import { parseCommaSeparatedList } from '@/src/utils/app/common';

import { EntityType, SortOrder } from '@/src/types/common';
import { AppEpic } from '@/src/types/store';

import {
  MarketplaceActions,
  ModelsActions,
  ToolsetActions,
  UIActions,
} from '@/src/store/actions';
import {
  MarketplaceSelectors,
  ModelsSelectors,
  ToolsetSelectors,
  UISelectors,
} from '@/src/store/selectors';

import {
  ENTITY_TYPES,
  FilterTypes,
  MarketplaceEntitiesTabs,
  MarketplaceQueryParams,
  MarketplaceTabs,
  SourceType,
  TableColumnSortKeys,
  ViewTypes,
} from '@/src/constants/marketplace';

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
        query[MarketplaceQueryParams.tab] === MarketplaceTabs.MY_WORKSPACE;

      const previousRoute = UISelectors.selectPreviousRoute(state$.value);
      const firstRoutePart = previousRoute?.split('/')[1];
      const firstRoutePartWithoutParams = firstRoutePart?.split('?')[0];
      const isPreviousRouteEditor =
        !!firstRoutePartWithoutParams &&
        ['apps-editor', 'toolset-editor'].includes(firstRoutePartWithoutParams);

      return concat(
        of(
          MarketplaceActions.initSuccess({
            saveFilters: isPreviousRouteEditor,
            selectedTab: workSpaceTab
              ? MarketplaceTabs.MY_WORKSPACE
              : undefined,
          }),
        ),
        iif(
          () => !isPreviousRouteEditor,
          of(
            MarketplaceActions.setSelectedTab(
              workSpaceTab
                ? MarketplaceTabs.MY_WORKSPACE
                : MarketplaceTabs.HOME,
            ),
          ),
          EMPTY,
        ),
      );
    }),
  );

const setQueryParamsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(
      MarketplaceActions.setSelectedTab.type,
      MarketplaceActions.setSelectedEntitiesTab.type,
      MarketplaceActions.setDetailsEntity.type,
      MarketplaceActions.setSelectedAgentsFilters.type,
      MarketplaceActions.setSelectedToolsetsFilters.type,
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
      // entities tab
      const selectedEntitiesTab =
        MarketplaceSelectors.selectSelectedEntitiesTab(state);

      const isToolsetsTab =
        selectedEntitiesTab === MarketplaceEntitiesTabs.TOOLSETS;

      addToQuery(
        query,
        MarketplaceQueryParams.entitiesTab,
        isToolsetsTab ? MarketplaceEntitiesTabs.TOOLSETS : undefined,
      );
      // application link
      const detailsEntity = MarketplaceSelectors.selectDetailsEntity(state);
      const referenceQuery =
        detailsEntity?.type === MarketplaceEntitiesTabs.TOOLSETS ||
        isToolsetsTab
          ? MarketplaceQueryParams.toolset
          : MarketplaceQueryParams.model;
      addToQuery(query, referenceQuery, detailsEntity?.reference);

      // filters
      const agentsFilters =
        MarketplaceSelectors.selectSelectedAgentsFilters(state);
      const toolsetsFilters =
        MarketplaceSelectors.selectSelectedToolsetsFilters(state);

      const filters = isToolsetsTab ? toolsetsFilters : agentsFilters;

      addToQuery(
        query,
        isToolsetsTab
          ? MarketplaceQueryParams.toolsetsTypes
          : MarketplaceQueryParams.types,
        filters.Type.length ? filters.Type.join(',') : undefined,
      );
      addToQuery(
        query,
        isToolsetsTab
          ? MarketplaceQueryParams.toolsetsTopics
          : MarketplaceQueryParams.topics,
        filters.Topics.length ? filters.Topics.join(',') : undefined,
      );
      addToQuery(
        query,
        isToolsetsTab
          ? MarketplaceQueryParams.toolsetsSources
          : MarketplaceQueryParams.sources,
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

      void Router.push(
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
    filter(
      () =>
        ModelsSelectors.selectAreModelsLoaded(state$.value) &&
        ToolsetSelectors.selectAreToolsetsLoaded(state$.value),
    ),
    switchMap(() => {
      const query = parse(window.location.search.slice(1));
      const state = state$.value;

      const updatedMarketplaceState: Partial<MarketplaceState> = {};
      // application link
      const modelReference = query[MarketplaceQueryParams.model]?.toString();
      const toolsetReference =
        query[MarketplaceQueryParams.toolset]?.toString();
      const modelsMap = ModelsSelectors.selectModelsMap(state);
      const toolsetsMap = ToolsetSelectors.selectToolsetsMap(state);
      const model =
        typeof modelReference === 'string'
          ? modelsMap[modelReference]
          : undefined;
      const toolset =
        typeof toolsetReference === 'string'
          ? toolsetsMap[toolsetReference]
          : undefined;

      const detailsEntity =
        (modelReference && model) || (toolsetReference && toolset) || undefined;

      updatedMarketplaceState.detailsEntity = detailsEntity
        ? {
            reference: detailsEntity.reference,
            isSuggested: false,
            type: isDialAiEntityModel(detailsEntity)
              ? MarketplaceEntitiesTabs.AGENTS
              : MarketplaceEntitiesTabs.TOOLSETS,
          }
        : undefined;
      // workspace tab
      const workSpaceTab =
        query[MarketplaceQueryParams.tab] === MarketplaceTabs.MY_WORKSPACE;
      updatedMarketplaceState.selectedTab = workSpaceTab
        ? MarketplaceTabs.MY_WORKSPACE
        : MarketplaceTabs.HOME;
      // entities tab
      const toolsetsTab =
        query[MarketplaceQueryParams.entitiesTab] ===
        MarketplaceEntitiesTabs.TOOLSETS;
      updatedMarketplaceState.selectedEntitiesTab = toolsetsTab
        ? MarketplaceEntitiesTabs.TOOLSETS
        : MarketplaceEntitiesTabs.AGENTS;

      // filters
      // agents filters
      const existingAgentsTopics = ModelsSelectors.selectModelTopics(state);
      const agentsTopics = parseCommaSeparatedList(
        query[MarketplaceQueryParams.topics] as string,
      ).filter((topic) => topic && existingAgentsTopics.includes(topic));

      const agentsTypes = parseCommaSeparatedList(
        query[MarketplaceQueryParams.types] as string,
      ).filter((type) => type && ENTITY_TYPES.includes(type as EntityType));
      const sourceTypes = MarketplaceSelectors.selectSourceTypes(state);
      const sources = parseCommaSeparatedList(
        query[MarketplaceQueryParams.sources] as string,
      ).filter((type) => type && sourceTypes.includes(type as SourceType));

      updatedMarketplaceState.selectedAgentsFilters = {
        [FilterTypes.ENTITY_TYPE]: agentsTypes,
        [FilterTypes.TOPICS]: agentsTopics,
        [FilterTypes.SOURCES]: sources,
      };

      // toolsets filters
      const existingToolsetsTopics =
        ToolsetSelectors.selectToolsetsTopics(state);
      const toolsetsTopics = parseCommaSeparatedList(
        query[MarketplaceQueryParams.toolsetsTopics] as string,
      ).filter((topic) => topic && existingToolsetsTopics.includes(topic));

      const toolsetSourceTypes =
        MarketplaceSelectors.selectToolsetSourceTypes(state);
      const toolsetSources = parseCommaSeparatedList(
        query[MarketplaceQueryParams.toolsetsSources] as string,
      ).filter(
        (type) => type && toolsetSourceTypes.includes(type as SourceType),
      );

      updatedMarketplaceState.selectedToolsetsFilters = {
        [FilterTypes.ENTITY_TYPE]: [], // no types filter for toolsets for now
        [FilterTypes.TOPICS]: toolsetsTopics,
        [FilterTypes.SOURCES]: toolsetSources,
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
        toolsetReference && !toolset
          ? of(UIActions.showErrorToast('Toolset by this link not found'))
          : EMPTY,
      );
    }),
  );

const updateAgentsFiltersEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ModelsActions.deleteModels.type, ModelsActions.updateModel.type),
    switchMap(() => {
      const state = state$.value;

      const existingTopics = ModelsSelectors.selectModelTopics(state);
      const sourceTypes = MarketplaceSelectors.selectSourceTypes(state);
      const filters = MarketplaceSelectors.selectSelectedAgentsFilters(state);
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
            selectedAgentsFilters: updatedFilters,
          }),
        );
      }

      return EMPTY;
    }),
  );

const updateToolsetsFiltersEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(
      ToolsetActions.deleteToolset.type,
      ToolsetActions.updateToolset.type,
    ),
    switchMap(() => {
      const state = state$.value;

      const existingTopics = ToolsetSelectors.selectToolsetsTopics(state);
      const sourceTypes = MarketplaceSelectors.selectToolsetSourceTypes(state);
      const filters = MarketplaceSelectors.selectSelectedToolsetsFilters(state);
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
            selectedToolsetsFilters: updatedFilters,
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
  updateAgentsFiltersEpic,
  updateToolsetsFiltersEpic,
);
