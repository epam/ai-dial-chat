import {
  catchError,
  filter,
  from,
  ignoreElements,
  map,
  of,
  switchMap,
  takeUntil,
  tap,
  throwError,
  withLatestFrom,
} from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import { combineEpics } from 'redux-observable';

import { OpenAIEntityModel } from '@/src/types/openai';
import { AppEpic } from '@/src/types/store';

import { ModelsActions, ModelsSelectors } from './models.reducers';

const getModelsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ModelsActions.getModels.match),
    withLatestFrom(state$),
    switchMap(() => {
      return fromFetch('/api/models', {
        headers: {
          'Content-Type': 'application/json',
        },
      }).pipe(
        switchMap((resp) => {
          if (!resp.ok) {
            return throwError(() => resp);
          }
          return from(resp.json());
        }),
        map((response: OpenAIEntityModel[]) =>
          ModelsActions.getModelsSuccess({ models: response }),
        ),
        catchError((err) => {
          return of(ModelsActions.getModelsFail({ error: err }));
        }),
        takeUntil(action$.pipe(filter(ModelsActions.getModels.match))),
      );
    }),
  );

const updateRecentModelsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        ModelsActions.initRecentModels.match(action) ||
        ModelsActions.updateRecentModels.match(action),
    ),
    withLatestFrom(state$),
    map(([_action, state]) => ModelsSelectors.selectRecentModelsIds(state)),
    tap((recentModelIds) => {
      localStorage.setItem('recentModelsIds', JSON.stringify(recentModelIds));
    }),
    ignoreElements(),
  );

export const ModelsEpics = combineEpics(getModelsEpic, updateRecentModelsEpic);
