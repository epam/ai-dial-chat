import {
  catchError,
  filter,
  from,
  ignoreElements,
  map,
  of,
  switchMap,
  tap,
  throwError,
  withLatestFrom,
} from 'rxjs';

import { OpenAIEntityModel } from '@/types/openai';
import { AppEpic } from '@/types/store';

import { ModelsActions, ModelsSelectors } from './models.reducers';

import { combineEpics } from 'redux-observable';

const getModelsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ModelsActions.getModels.match),
    withLatestFrom(state$),
    switchMap(() => {
      return from(
        fetch('/api/models', {
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      ).pipe(
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
