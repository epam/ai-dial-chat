import { signOut } from 'next-auth/react';

import {
  catchError,
  filter,
  from,
  ignoreElements,
  map,
  of,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
  throwError,
  withLatestFrom,
} from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import { combineEpics } from 'redux-observable';

import { DataService } from '@/src/utils/app/data/data-service';

import { Feature } from '@/src/types/features';
import { OpenAIEntityModel } from '@/src/types/openai';
import { AppEpic } from '@/src/types/store';

import { SettingsSelectors } from '../settings/settings.reducers';
import { ModelsActions, ModelsSelectors } from './models.reducers';

const initEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ModelsActions.init.match),
    switchMap(() => of(ModelsActions.getModels())),
  );

const initRecentModelsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ModelsActions.init.match),
    switchMap(() => DataService.getRecentModelsIds()),
    switchMap((recentModelsIds) => {
      return state$.pipe(
        startWith(state$.value),
        map((state) => ModelsSelectors.selectModels(state)),
        filter((models) => models && models.length > 0),
        take(1),
        map((models) => ({
          models: models,
          recentModelsIds,
          defaultRecentModelsIds:
            SettingsSelectors.selectDefaultRecentModelsIds(state$.value),
        })),
        switchMap(({ models, recentModelsIds, defaultRecentModelsIds }) => {
          const filteredRecentModels = recentModelsIds.filter((resentModelId) =>
            models.some(({ id }) => resentModelId === id),
          );
          const filteredDefaultRecentModelsIds = defaultRecentModelsIds.filter(
            (resentModelId) => models.some(({ id }) => resentModelId === id),
          );

          return of(
            ModelsActions.initRecentModels({
              defaultRecentModelsIds: filteredDefaultRecentModelsIds,
              localStorageRecentModelsIds: filteredRecentModels,
              defaultModelId: SettingsSelectors.selectDefaultModelId(
                state$.value,
              ),
            }),
          );
        }),
      );
    }),
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
        map((response: OpenAIEntityModel[]) => {
          const isOverlay = SettingsSelectors.selectIsOverlay(state$.value);
          const enabledFeatures = SettingsSelectors.selectEnabledFeatures(
            state$.value,
          );
          if (
            response.length === 0 &&
            isOverlay &&
            enabledFeatures.has(Feature.Header)
          ) {
            signOut();
          }
          return ModelsActions.getModelsSuccess({ models: response });
        }),
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
  initRecentModelsEpic,
);
