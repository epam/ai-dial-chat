import Router from 'next/router';

import { EMPTY, concat, filter, of, switchMap } from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import {
  getDetailsEntity,
  getFilters,
  getLinkErrorMessage,
  getTableSort,
  getTabs,
} from '@/src/utils/marketplace';

import { DetailsEntity } from '@/src/types/marketplace';
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
  FilterTypes,
  MarketplaceEntitiesTabs,
  MarketplaceQueryParams,
  MarketplaceTabs,
  SourceType,
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
      const isShareLink = !!new URL(window.location.href).searchParams.get(
        'share',
      );
      const shouldSaveFilters =
        (!!firstRoutePartWithoutParams &&
          ['apps-editor', 'toolset-editor'].includes(
            firstRoutePartWithoutParams,
          )) ||
        isShareLink;

      return of(
        MarketplaceActions.initSuccess({
          saveFilters: shouldSaveFilters,
          selectedTab: workSpaceTab
            ? MarketplaceTabs.MY_WORKSPACE
            : MarketplaceTabs.HOME,
        }),
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
    switchMap((action) => {
      const state = state$.value;
      const query = parse(window.location.search.slice(1));
      const pathname = window.location.pathname;

      // remove 'share' from query after application sharing link accepted
      if (action.type === MarketplaceActions.setDetailsEntity.type) {
        addToQuery(query, 'share', undefined);
      }
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

      const isAgentsTab =
        selectedEntitiesTab === MarketplaceEntitiesTabs.AGENTS;

      addToQuery(
        query,
        MarketplaceQueryParams.entitiesTab,
        isAgentsTab ? undefined : MarketplaceEntitiesTabs.TOOLSETS,
      );
      // application link
      const detailsEntity = MarketplaceSelectors.selectDetailsEntity(state);
      const referenceQuery =
        detailsEntity?.type === MarketplaceEntitiesTabs.AGENTS || isAgentsTab
          ? MarketplaceQueryParams.model
          : MarketplaceQueryParams.toolset;
      addToQuery(query, referenceQuery, detailsEntity?.reference);

      // filters
      const agentsFilters =
        MarketplaceSelectors.selectSelectedAgentsFilters(state);
      const toolsetsFilters =
        MarketplaceSelectors.selectSelectedToolsetsFilters(state);

      const filters = isAgentsTab ? agentsFilters : toolsetsFilters;

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

      // selected tabs
      const { selectedTab, selectedEntitiesTab } = getTabs(query);
      const isAgentsTab =
        selectedEntitiesTab === MarketplaceEntitiesTabs.AGENTS;

      // application link
      const modelReference = query[MarketplaceQueryParams.model]?.toString();
      const toolsetReference =
        query[MarketplaceQueryParams.toolset]?.toString();

      let detailsEntity: DetailsEntity | undefined;
      // filters
      let filters: {
        [FilterTypes.ENTITY_TYPE]: string[];
        [FilterTypes.TOPICS]: string[];
        [FilterTypes.SOURCES]: string[];
      } = {
        Type: [],
        Topics: [],
        Sources: [],
      };
      let statePropertyName: keyof MarketplaceState = 'selectedAgentsFilters';

      if (isAgentsTab) {
        // set model details
        if (modelReference) {
          const modelsMap = ModelsSelectors.selectModelsMap(state);

          detailsEntity = getDetailsEntity({
            entitiesMap: modelsMap,
            reference: modelReference,
            type: selectedEntitiesTab,
          });
        } else {
          const stateDetailsEntity =
            MarketplaceSelectors.selectDetailsEntity(state);
          detailsEntity =
            stateDetailsEntity?.type === MarketplaceEntitiesTabs.AGENTS
              ? stateDetailsEntity
              : undefined;
        }

        // agents filters
        statePropertyName = 'selectedAgentsFilters';
        const existingAgentsTopics = ModelsSelectors.selectModelTopics(state);
        const sourceTypes = MarketplaceSelectors.selectSourceTypes(state);

        filters = getFilters(query, existingAgentsTopics, sourceTypes);
      } else {
        // set toolset details
        if (toolsetReference) {
          const toolsetsMap = ToolsetSelectors.selectToolsetsMap(state);
          detailsEntity = getDetailsEntity({
            entitiesMap: toolsetsMap,
            reference: toolsetReference,
            type: selectedEntitiesTab!,
          });
        } else {
          const stateDetailsEntity =
            MarketplaceSelectors.selectDetailsEntity(state);
          detailsEntity =
            stateDetailsEntity?.type === MarketplaceEntitiesTabs.TOOLSETS
              ? stateDetailsEntity
              : undefined;
        }

        // toolsets filters
        statePropertyName = 'selectedToolsetsFilters';
        const existingToolsetsTopics =
          ToolsetSelectors.selectToolsetsTopics(state);
        const toolsetSourceTypes =
          MarketplaceSelectors.selectToolsetSourceTypes(state);

        filters = getFilters(query, existingToolsetsTopics, toolsetSourceTypes);
      }

      const updatedMarketplaceState: Partial<MarketplaceState> = {
        detailsEntity,
        selectedTab,
        selectedEntitiesTab,
        [statePropertyName]: { ...filters },
        // search
        searchTerm: (query[MarketplaceQueryParams.search] as string) ?? '',
        // viewType
        selectedView:
          (query[MarketplaceQueryParams.viewType] as ViewTypes) ??
          ViewTypes.CARD,
        tableSort: getTableSort(query),
        // hide loader
        showLoader: false,
      };
      const linkErrorMessage = getLinkErrorMessage(
        isAgentsTab,
        modelReference ?? toolsetReference,
        detailsEntity,
      );

      return concat(
        of(MarketplaceActions.setState(updatedMarketplaceState)),
        linkErrorMessage
          ? of(UIActions.showErrorToast({ message: linkErrorMessage }))
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

const showLoaderEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ModelsActions.getModels.type, ToolsetActions.getToolsets.type),
    switchMap(() => {
      return of(MarketplaceActions.setShowLoader(true));
    }),
  );

export const MarketplaceEpics = combineEpics(
  initEpic,
  initQueryParamsEpic,
  setQueryParamsEpic,
  updateAgentsFiltersEpic,
  updateToolsetsFiltersEpic,
  showLoaderEpic,
);
