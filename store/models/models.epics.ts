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

import { combineEpics, ofType } from 'redux-observable';
import {
  Observable,
  catchError,
  from,
  ignoreElements,
  map,
  of,
  switchMap,
  tap,
  throwError,
  withLatestFrom,
} from 'rxjs';

const getModelsEpic = (
  action$: Observable<any>,
  state$: Observable<RootState>,
) =>
  action$.pipe(
    ofType(getModels),
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

const updateRecentModelsEpic = (
  action$: Observable<any>,
  state$: Observable<RootState>,
) =>
  action$.pipe(
    ofType<any, any>(initRecentModels, updateRecentModels),
    withLatestFrom(state$),
    map(([_action, state]) => selectRecentModelsIds(state)),
    tap((recentModelIds) => {
      localStorage.setItem('recentModelsIds', JSON.stringify(recentModelIds));
    }),
    ignoreElements(),
  );

const ModelsEpics: any = combineEpics(getModelsEpic, updateRecentModelsEpic);

export default ModelsEpics;
