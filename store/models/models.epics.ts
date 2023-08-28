import { OpenAIEntityModel } from '@/types/openai';

import { RootState } from '../index';
import {
  getModels,
  getModelsFail,
  getModelsSuccess,
  initRecentModels,
  selectRecentModelsIds,
  updateRecentModels,
} from './models.reducers';

import { Action } from '@reduxjs/toolkit';
import { Epic, combineEpics } from 'redux-observable';
import {
  Observable,
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

const getModelsEpic: Epic = (
  action$: Observable<Action>,
  state$: Observable<RootState>,
) =>
  action$.pipe(
    filter(getModels.match),
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
          getModelsSuccess({ models: response }),
        ),
        catchError((err) => {
          return of(getModelsFail({ error: err }));
        }),
      );
    }),
  );

const updateRecentModelsEpic: Epic = (
  action$: Observable<Action>,
  state$: Observable<RootState>,
) =>
  action$.pipe(
    filter(
      (action) =>
        initRecentModels.match(action) || updateRecentModels.match(action),
    ),
    withLatestFrom(state$),
    map(([_action, state]) => selectRecentModelsIds(state)),
    tap((recentModelIds) => {
      localStorage.setItem('recentModelsIds', JSON.stringify(recentModelIds));
    }),
    ignoreElements(),
  );

export const ModelsEpics = combineEpics(getModelsEpic, updateRecentModelsEpic);
