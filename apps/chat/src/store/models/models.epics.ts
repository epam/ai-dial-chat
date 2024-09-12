import { signOut } from 'next-auth/react';

import {
  EMPTY,
  catchError,
  concat,
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

import { ClientDataService } from '@/src/utils/app/data/client-data-service';
import { DataService } from '@/src/utils/app/data/data-service';

import { FeatureType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { AppEpic } from '@/src/types/store';

import { PublicationActions } from '../publication/publication.reducers';
import {
  SettingsActions,
  SettingsSelectors,
} from '../settings/settings.reducers';
import { ModelsActions, ModelsSelectors } from './models.reducers';

import { Feature } from '@epam/ai-dial-shared';

const initEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ModelsActions.init.match),
    switchMap(() =>
      of(ModelsActions.getModels(), ModelsActions.getInstalledModelIds()),
    ),
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
          models,
          recentModelsIds,
          defaultRecentModelsIds:
            SettingsSelectors.selectDefaultRecentModelsIds(state$.value),
        })),
        switchMap(({ models, recentModelsIds, defaultRecentModelsIds }) => {
          const filteredRecentModels = recentModelsIds.filter((resentModelId) =>
            models.some(
              ({ reference, id }) =>
                resentModelId === reference || resentModelId === id,
            ),
          );
          const filteredDefaultRecentModelsIds = defaultRecentModelsIds.filter(
            (resentModelId) =>
              models.some(
                ({ reference, id }) =>
                  resentModelId === reference || resentModelId === id,
              ),
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
        switchMap((response: DialAIEntityModel[]) => {
          const isOverlay = SettingsSelectors.selectIsOverlay(state$.value);
          const isHeaderFeatureEnabled = SettingsSelectors.isFeatureEnabled(
            state$.value,
            Feature.Header,
          );
          if (response.length === 0 && isOverlay && !isHeaderFeatureEnabled) {
            signOut();
          }
          return concat(
            of(ModelsActions.getModelsSuccess({ models: response })),
            of(
              PublicationActions.uploadAllPublishedWithMeItems({
                featureType: FeatureType.Application,
              }),
            ),
          );
        }),
        catchError((err) => {
          return of(ModelsActions.getModelsFail({ error: err }));
        }),
        takeUntil(action$.pipe(filter(ModelsActions.getModels.match))),
      );
    }),
  );

const getInstalledModelIdsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ModelsActions.getInstalledModelIds.match),
    switchMap(() => {
      return ClientDataService.getInstalledDeployments().pipe(
        switchMap((installedModels) => {
          if (!installedModels?.length) {
            return of(ModelsActions.getInstalledModelIdsFail());
          }
          return of(ModelsActions.getInstalledModelsSuccess(installedModels));
        }),
        catchError(() => {
          return of(ModelsActions.getInstalledModelIdsFail());
        }),
      );
    }),
  );

const getInstalledModelIdsFailEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ModelsActions.getInstalledModelIdsFail.match),
    switchMap(() => {
      const defaultModelIds = SettingsSelectors.selectDefaultRecentModelsIds(
        state$.value,
      );
      return of(ModelsActions.updateInstalledModelIds(defaultModelIds));
    }),
  );

const updateInstalledModelIdsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ModelsActions.updateInstalledModelIds.match),
    switchMap(({ payload }) => {
      return ClientDataService.saveInstalledDeployments(payload).pipe(
        map(() => ModelsActions.getInstalledModelsSuccess(payload)),
        catchError((err) => {
          console.error(err);
          return of(ModelsActions.updateInstalledModelFail());
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
    switchMap((recentModelIds) => {
      return DataService.setRecentModelsIds(recentModelIds);
    }),
    ignoreElements(),
  );

const getModelsSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ModelsActions.getModelsSuccess.match),
    switchMap(({ payload }) => {
      const defaultModelId = payload.models.find(
        (model) => model.isDefault,
      )?.id;

      if (defaultModelId) {
        return of(SettingsActions.setDefaultModelId({ defaultModelId }));
      }

      return EMPTY;
    }),
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
  getModelsSuccessEpic,
  getModelsFailEpic,
  getInstalledModelIdsEpic,
  getInstalledModelIdsFailEpic,
  updateInstalledModelIdsEpic,
  updateRecentModelsEpic,
  initRecentModelsEpic,
);
