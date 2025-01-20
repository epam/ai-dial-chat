import { EMPTY, Observable, concat, filter, of, switchMap } from 'rxjs';

import { AnyAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import { AppEpic } from '@/src/types/store';

import {
  FilterTypes,
  MarketplaceQueryParams,
  MarketplaceTabs,
} from '@/src/constants/marketplace';

import { ModelsSelectors } from '../models/models.reducers';
import { UIActions } from '../ui/ui.reducers';
import { MarketplaceActions } from './marketplace.reducers';
import {
  selectDetailsModel,
  selectSearchTerm,
  selectSelectedFilters,
  selectSelectedTab,
} from './marketplace.selectors';

import isNil from 'lodash/isNil';
import { ParsedUrlQueryInput } from 'querystring';

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
        MarketplaceActions.setFilters.match(action) ||
        MarketplaceActions.setSearchTerm.match(action),
    ),
    switchMap(() => {
      const state = state$.value;
      const query = router.query;
      // workspace tab
      const selectedTab = selectSelectedTab(state);
      addToQuery(
        query,
        MarketplaceQueryParams.workspace,
        selectedTab === MarketplaceTabs.MY_APPLICATIONS ? '1' : undefined,
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

const initQueryParamsEpic: AppEpic = (action$, state$, { router }) =>
  action$.pipe(
    filter(MarketplaceActions.initQueryParams.match),
    switchMap(() => {
      const query = router.query;

      const actions: Observable<AnyAction>[] = [];
      // application link
      const modelReference = query[MarketplaceQueryParams.model];
      const modelsMap = ModelsSelectors.selectModelsMap(state$.value);
      const model =
        typeof modelReference === 'string'
          ? modelsMap[modelReference]
          : undefined;
      if (modelReference) {
        if (model) {
          actions.push(
            of(
              MarketplaceActions.setDetailsModel({
                reference: modelReference as string,
                isSuggested: false,
              }),
            ),
          );
        } else {
          actions.push(
            of(UIActions.showErrorToast('Agent by this link not found')),
          );
        }
      }
      // workspace tab
      const workSpaceTab =
        query[MarketplaceQueryParams.fromConversation] ||
        !isNil(query[MarketplaceQueryParams.workspace]);
      actions.push(
        of(
          MarketplaceActions.setSelectedTab(
            workSpaceTab
              ? MarketplaceTabs.MY_APPLICATIONS
              : MarketplaceTabs.HOME,
          ),
        ),
      );
      // filters
      const types = ((query[MarketplaceQueryParams.types] as string) ?? '')
        .split(',')
        .filter(Boolean);
      const topics = ((query[MarketplaceQueryParams.topics] as string) ?? '')
        .split(',')
        .filter(Boolean);
      actions.push(
        of(
          MarketplaceActions.setFilters({
            [FilterTypes.ENTITY_TYPE]: types,
            [FilterTypes.TOPICS]: topics,
          }),
        ),
      );
      // search
      const search = (query[MarketplaceQueryParams.search] as string) ?? '';
      actions.push(of(MarketplaceActions.setSearchTerm(search)));

      return concat(...actions);
    }),
  );

export const MarketplaceEpics = combineEpics(
  initQueryParamsEpic,
  setQueryParamsEpic,
);
