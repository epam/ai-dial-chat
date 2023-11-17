import {
  catchError,
  concat,
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

import { DataService } from '@/src/utils/app/data/data-service';

import { OpenAIEntityModel } from '@/src/types/openai';
import { AppEpic } from '@/src/types/store';

import { SettingsSelectors } from '../settings/settings.reducers';
import { ModelsActions, ModelsSelectors } from './models.reducers';

const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ModelsActions.init.match),
    switchMap(() => DataService.getRecentModelsIds()),
    switchMap((modelsIds) =>
      concat(
        of(
          ModelsActions.initRecentModels({
            defaultRecentModelsIds:
              SettingsSelectors.selectDefaultRecentModelsIds(state$.value),
            localStorageRecentModelsIds: modelsIds,
            defaultModelId: SettingsSelectors.selectDefaultModelId(
              state$.value,
            ),
          }),
        ),
        of(ModelsActions.getModels()),
      ),
    ),
  );

const getModelsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ModelsActions.getModels.match),
    withLatestFrom(state$),
    switchMap(() => {
      return fromFetch('api/models', {
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
    switchMap((recentModelIds) => {
      return DataService.setRecentModelsIds(recentModelIds);
    }),
    ignoreElements(),
  );

const getModelsFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ModelsActions.getModelsFail.match),
    tap(({ payload }) => {
      if (payload.error.status === 401) {
        window.location.assign('api/auth/signin');
      }
    }),
    ignoreElements(),
  );

export const ModelsEpics = combineEpics(
  initEpic,
  getModelsEpic,
  updateRecentModelsEpic,
  getModelsFailEpic,
);
