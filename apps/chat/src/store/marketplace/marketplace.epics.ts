import { EMPTY, filter, of, switchMap } from 'rxjs';

import { combineEpics } from 'redux-observable';

import { AppEpic } from '@/src/types/store';

import { MarketplaceQueryParams } from '@/src/constants/marketplace';

import { ModelsSelectors } from '../models/models.reducers';
import { UIActions } from '../ui/ui.reducers';
import { MarketplaceActions } from './marketplace.reducers';

const setDetailsModelEpic: AppEpic = (action$, _, { router }) =>
  action$.pipe(
    filter(MarketplaceActions.setDetailsModel.match),
    switchMap(({ payload }) => {
      const reference = payload?.reference;
      const query = router.query;
      if (reference) {
        router.push({
          query: {
            ...query,
            [MarketplaceQueryParams.model]: reference,
          },
        });
      } else {
        delete query[MarketplaceQueryParams.model];
        router.push({
          query,
        });
      }
      return EMPTY;
    }),
  );

const initQueryParamsEpic: AppEpic = (action$, state$, { router }) =>
  action$.pipe(
    filter(MarketplaceActions.initQueryParams.match),
    switchMap(() => {
      const query = router.query;
      const modelReference = query[MarketplaceQueryParams.model] as
        | string
        | undefined;
      const modelsMap = ModelsSelectors.selectModelsMap(state$.value);
      const model = modelReference ? modelsMap[modelReference] : undefined;

      if (modelReference) {
        if (model) {
          return of(
            MarketplaceActions.setDetailsModel({
              reference: modelReference,
              isSuggested: false,
            }),
          );
        } else {
          return of(UIActions.showErrorToast('Agent by this link not found'));
        }
      }

      return EMPTY;
    }),
  );

export const MarketplaceEpics = combineEpics(
  initQueryParamsEpic,
  setDetailsModelEpic,
);
