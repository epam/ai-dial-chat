import { signOut } from 'next-auth/react';

import {
  EMPTY,
  Observable,
  catchError,
  concat,
  filter,
  from,
  ignoreElements,
  iif,
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

import { combineEpics, ofType } from 'redux-observable';

import { ClientDataService } from '@/src/utils/app/data/client-data-service';
import { DataService } from '@/src/utils/app/data/data-service';
import { BrowserStorage } from '@/src/utils/app/data/storages/browser-storage';
import { isMyApplication } from '@/src/utils/app/id';
import { getGroupModelKey } from '@/src/utils/app/models';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { translate } from '@/src/utils/app/translation';

import { ApplicationStatus } from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { DialAIEntityModel, InstalledModel } from '@/src/types/models';
import { AppAction, AppEpic } from '@/src/types/store';

import {
  ApplicationActions,
  MarketplaceActions,
  ModelsActions,
  PublicationActions,
  SettingsActions,
  UIActions,
} from '@/src/store/actions';
import {
  AuthSelectors,
  ModelsSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import { DEFAULT_AGENT } from '@/src/constants/chat';
import { DeleteType } from '@/src/constants/marketplace';

import { Feature } from '@epam/ai-dial-shared';
import uniqBy from 'lodash-es/uniqBy';

const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ModelsActions.init.type),
    filter(() => !ModelsSelectors.selectInitialized(state$.value)),
    switchMap(() =>
      concat(of(ModelsActions.getModels()), of(ModelsActions.initFinish())),
    ),
  );

const initRecentModelsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ModelsActions.init.type),
    switchMap(() => DataService.getRecentModelsIds()),
    switchMap((recentModelsIds) => {
      return state$.pipe(
        startWith(state$.value),
        map((state) => ModelsSelectors.selectModels(state)),
        filter((models) => models && models.length > 0),
        take(1),
        switchMap((models) => {
          const state = state$.value;
          const filteredRecentModels = recentModelsIds?.filter(
            (resentModelId: string) =>
              models.some(
                ({ reference, id }) =>
                  resentModelId === reference || resentModelId === id,
              ),
          );

          const defaultRecentModelsIds =
            SettingsSelectors.selectDefaultRecentModelsIds(state);
          const modelsMap = ModelsSelectors.selectModelsMap(state);
          const filteredDefaultRecentModelsReferences = defaultRecentModelsIds
            .map((id) => modelsMap[id]?.reference)
            .filter(Boolean) as string[];

          return concat(
            of(
              SettingsActions.setDefaultRecentModelsIds(
                filteredDefaultRecentModelsReferences,
              ),
            ),
            of(
              ModelsActions.initRecentModels({
                defaultRecentModelsIds: filteredDefaultRecentModelsReferences,
                localStorageRecentModelsIds: filteredRecentModels,
                defaultModelReference:
                  SettingsSelectors.selectDefaultModelReference(state),
              }),
            ),
          );
        }),
      );
    }),
  );

const getModelsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ModelsActions.getModels.type),
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
        switchMap((response: DialAIEntityModel[]) => {
          const isOverlay = SettingsSelectors.selectIsOverlay(state$.value);
          const userName = AuthSelectors.selectUserName(state$.value);
          const isHeaderFeatureEnabled = SettingsSelectors.isFeatureEnabled(
            state$.value,
            Feature.Header,
          );

          if (!response.length && isOverlay && !isHeaderFeatureEnabled) {
            signOut();
          }

          const updatingModels = response.filter(
            (model) =>
              model.functionStatus &&
              (model.functionStatus === ApplicationStatus.DEPLOYING ||
                model.functionStatus === ApplicationStatus.UNDEPLOYING),
          );
          const continueUpdateActions: Observable<AppAction>[] =
            updatingModels.map((model) =>
              of(
                ApplicationActions.continueUpdatingFunctionStatus({
                  id: model.id,
                  status: model.functionStatus as ApplicationStatus,
                }),
              ),
            );
          const publicApplicationIds = response
            .filter((model) => isEntityIdPublic(model))
            .map(({ id }) => id);

          return concat(
            of(
              ModelsActions.getModelsSuccess({
                models: response.map((model) =>
                  isMyApplication(model)
                    ? { ...model, owner: userName }
                    : model,
                ),
              }),
            ),
            of(
              PublicationActions.uploadAllPublishedWithMeItems({
                featureType: FeatureType.Application,
              }),
            ),
            of(MarketplaceActions.initQueryParams()),
            iif(
              () => !!publicApplicationIds.length,
              of(ApplicationActions.setFolders(publicApplicationIds)),
              EMPTY,
            ),
            ...continueUpdateActions,
          );
        }),
        catchError((err) => {
          return of(ModelsActions.getModelsFail({ error: err }));
        }),
        takeUntil(action$.pipe(ofType(ModelsActions.getModels.type))),
      );
    }),
  );

const getInstalledModelIdsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ModelsActions.getInstalledModelIds.type),
    switchMap(() => {
      const allModels = ModelsSelectors.selectModels(state$.value);

      const myAppIds = allModels
        .filter((model) => isMyApplication(model) || model.sharedWithMe)
        .map((app) => app.reference);

      return ClientDataService.getInstalledDeployments().pipe(
        switchMap((installedModels) => {
          if (!installedModels) {
            return of(ModelsActions.getInstalledModelIdsFail(myAppIds));
          }

          const actions: Observable<AppAction>[] = [];

          const recentModelsIds = ModelsSelectors.selectRecentModelsIds(
            state$.value,
          );

          const installedModelIds = new Set(
            installedModels.map((model) => model.id),
          );

          const references = [
            ...installedModelIds,
            ...recentModelsIds,
            ...myAppIds,
          ];
          const modelKeys = ModelsSelectors.selectAllGroupModelKeySet(
            state$.value,
            references,
          );

          const referencesToInstall = allModels
            .filter((model) => modelKeys.has(getGroupModelKey(model)))
            .map((model) => model.reference);

          const modelsToInstall = referencesToInstall.filter(
            (reference) => !installedModelIds.has(reference),
          );

          if (modelsToInstall.length) {
            actions.push(
              of(
                ModelsActions.addInstalledModels({
                  references: modelsToInstall,
                }),
              ),
            );
          }

          return concat(
            of(ModelsActions.getInstalledModelsSuccess(installedModels)),
            ...actions,
          );
        }),
        catchError((error) => {
          if (error?.message && error?.message.endsWith('Not Found')) {
            return of(ModelsActions.getInstalledModelIdsFail(myAppIds));
          }

          return EMPTY;
        }),
      );
    }),
  );

const getInstalledModelIdsFailEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ModelsActions.getInstalledModelIdsFail.type),
    switchMap(({ payload: myAppIds }) => {
      const defaultRecentModelIds =
        SettingsSelectors.selectDefaultRecentModelsIds(state$.value);
      const recentModelIds = ModelsSelectors.selectRecentModelsIds(
        state$.value,
      );
      const availableModels = ModelsSelectors.selectModels(state$.value);
      const fallbackModels = availableModels?.[0]?.reference
        ? [availableModels[0].reference]
        : [];

      const modelsToInstall = recentModelIds.length
        ? recentModelIds
        : defaultRecentModelIds;

      const installCandidates = [...myAppIds, ...modelsToInstall];
      const agentsToInstall = installCandidates.length
        ? installCandidates
        : fallbackModels;

      return of(
        ModelsActions.addInstalledModels({
          references: agentsToInstall,
        }),
      );
    }),
  );

const removeInstalledModelsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ModelsActions.removeInstalledModels.type),
    switchMap(({ payload }) => {
      const installedModels = ModelsSelectors.selectInstalledModels(
        state$.value,
      );
      const models = ModelsSelectors.selectModels(state$.value);
      const modelGroupKeys = ModelsSelectors.selectAllGroupModelKeySet(
        state$.value,
        payload.references,
      );

      const deletedReferences = new Set(
        models
          .filter((model) => modelGroupKeys.has(getGroupModelKey(model)))
          .map((model) => model.reference),
      );

      const newInstalledModels = installedModels.filter(
        (model) => !deletedReferences.has(model.id),
      );

      return ClientDataService.saveInstalledDeployments(
        newInstalledModels,
      ).pipe(
        switchMap(() => {
          const recentModelIds = ModelsSelectors.selectRecentModelsIds(
            state$.value,
          );

          const newInstalledModelIds = new Set(
            newInstalledModels.map(({ id }) => id),
          );
          const filteredRecentModelIds = recentModelIds.filter((id) =>
            newInstalledModelIds.has(id),
          );

          return DataService.setRecentModelsIds(filteredRecentModelIds).pipe(
            switchMap(() => {
              const actions: Observable<AppAction>[] = [];

              if (payload.action === DeleteType.DELETE) {
                actions.push(
                  of(
                    ModelsActions.deleteModels({
                      references: payload.references,
                    }),
                  ),
                );
              }

              return concat(
                ...actions,
                of(ModelsActions.getInstalledModelsSuccess(newInstalledModels)),
                of(
                  ModelsActions.updateInstalledModelsSuccess({
                    installedModels: newInstalledModels,
                  }),
                ),
              );
            }),
          );
        }),
        catchError((err) => {
          console.error(err);
          return of(ModelsActions.updateInstalledModelFail());
        }),
      );
    }),
  );

const addInstalledModelsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ModelsActions.addInstalledModels.type),
    switchMap(({ payload }) => {
      const installedModels = ModelsSelectors.selectInstalledModels(
        state$.value,
      );
      const models = ModelsSelectors.selectModels(state$.value);
      const modelGroupKeys = ModelsSelectors.selectAllGroupModelKeySet(
        state$.value,
        payload.references,
      );

      const newInstalledModels = uniqBy<InstalledModel>(
        [
          ...installedModels,
          ...models
            .filter((model) => modelGroupKeys.has(getGroupModelKey(model)))
            .map((model) => ({
              id: model.reference,
            })),
        ],
        'id',
      );

      return ClientDataService.saveInstalledDeployments(
        newInstalledModels,
      ).pipe(
        switchMap(() => {
          const recentModelIds = ModelsSelectors.selectRecentModelsIds(
            state$.value,
          );

          return DataService.setRecentModelsIds(recentModelIds).pipe(
            switchMap(() => {
              const actions: Observable<AppAction>[] = [];

              if (payload.showSuccessToast) {
                actions.push(
                  of(
                    UIActions.showSuccessToast(
                      translate(
                        `The agent${payload.references.length > 1 ? 's' : ''} added to my workspace`,
                      ),
                    ),
                  ),
                );
              }
              if (payload.updateRecentModels) {
                actions.push(
                  ...payload.references.map((reference) =>
                    of(
                      ModelsActions.updateRecentModels({ modelId: reference }),
                    ),
                  ),
                );
              }

              return concat(
                ...actions,
                of(ModelsActions.getInstalledModelsSuccess(newInstalledModels)),
                of(
                  ModelsActions.updateInstalledModelsSuccess({
                    installedModels: newInstalledModels,
                  }),
                ),
              );
            }),
          );
        }),
      );
    }),
  );

const updateRecentModelsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(
      ModelsActions.initRecentModels.type,
      ModelsActions.updateRecentModels.type,
    ),
    withLatestFrom(state$),
    map(([_action, state]) => ModelsSelectors.selectRecentModelsIds(state)),
    switchMap((recentModelIds) => {
      return DataService.setRecentModelsIds(recentModelIds);
    }),
    ignoreElements(),
  );

const getModelsSuccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ModelsActions.getModelsSuccess.type),
    switchMap(({ payload }) => {
      const overlayDefaultModelReference =
        SettingsSelectors.selectOverlayDefaultModelReference(state$.value);

      const defaultModeReference = overlayDefaultModelReference
        ? undefined
        : payload.models.find((model) => model.isDefault)?.reference;

      if (defaultModeReference) {
        return concat(
          of(SettingsActions.setDefaultModeReference({ defaultModeReference })),
          of(ModelsActions.getInstalledModelIds()),
        );
      }

      return of(ModelsActions.getInstalledModelIds());
    }),
  );

const getModelsFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ModelsActions.getModelsFail.type),
    tap(({ payload }) => {
      if (payload.error.status === 401) {
        window.location.assign('/api/auth/signin');
      }
    }),
    ignoreElements(),
  );

const initDefaultModelReferenceEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ModelsActions.init.type),
    switchMap(() => BrowserStorage.getDefaultModelReference()),
    switchMap((defaultModelReference) => {
      return of(
        ModelsActions.setDefaultModelReference(
          defaultModelReference ?? DEFAULT_AGENT,
        ),
      );
    }),
  );

const setDefaultModelReferenceEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ModelsActions.setDefaultModelReference.type),
    tap(({ payload }) => BrowserStorage.setDefaultModelReference(payload)),
    ignoreElements(),
  );

export const ModelsEpics = combineEpics(
  initEpic,
  getModelsEpic,
  getModelsSuccessEpic,
  getModelsFailEpic,
  getInstalledModelIdsEpic,
  getInstalledModelIdsFailEpic,
  addInstalledModelsEpic,
  removeInstalledModelsEpic,
  updateRecentModelsEpic,
  initRecentModelsEpic,
  initDefaultModelReferenceEpic,
  setDefaultModelReferenceEpic,
);
