import {
  EMPTY,
  Observable,
  catchError,
  concat,
  filter,
  forkJoin,
  iif,
  map,
  of,
  switchMap,
} from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { ClientDataService } from '@/src/utils/app/data/client-data-service';
import { DataService } from '@/src/utils/app/data/data-service';
import { ToolsetService } from '@/src/utils/app/data/toolset-service';
import { refreshToolset$ } from '@/src/utils/app/epics-helpers/toolset.epic-helpers';
import { getIdWithoutFeatureType, isMyEntity } from '@/src/utils/app/id';
import {
  convertToolsetModelToApi,
  encodeToolsetRedirectState,
  getToolsetRedirectUri,
  regenerateToolsetId,
} from '@/src/utils/app/toolsets';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import { AppAction, AppEpic } from '@/src/types/store';
import {
  ToolsetAuthPayload,
  ToolsetCredentialsLevel,
  ToolsetEditorSteps,
} from '@/src/types/toolsets';

import {
  MarketplaceActions,
  PublicationActions,
  UIActions,
} from '@/src/store/actions';
import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { errorsMessages } from '@/src/constants/errors';
import { DeleteType } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';
import { ToolsetEditorQuery } from '@/src/constants/toolsets';

import { ToolsetAuthStatus, ToolsetAuthTypes } from '@epam/ai-dial-shared';
import { uniq } from 'lodash-es';
import { parse } from 'querystring';

const isToolsetEditorStep = (step: string): step is ToolsetEditorSteps => {
  switch (step) {
    case ToolsetEditorSteps.Settings:
    case ToolsetEditorSteps.General:
      return true;
    default:
      return false;
  }
};

const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ToolsetActions.init.type),
    filter(() => !ToolsetSelectors.selectInitialized(state$.value)),
    switchMap(() =>
      concat(of(ToolsetActions.getToolsets()), of(ToolsetActions.initFinish())),
    ),
  );

const getToolsetsEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.getToolsets.type),
    switchMap(() =>
      forkJoin({
        toolsets: ToolsetService.getToolsets(),
      }).pipe(
        switchMap(({ toolsets }) =>
          concat(
            of(ToolsetActions.getToolsetsSuccess(toolsets)),
            of(ToolsetActions.getInstalledToolsets()),
            of(MarketplaceActions.initQueryParams()),
          ),
        ),
        catchError((err) => {
          console.error('Failed to get toolsets', err);
          return of(
            UIActions.showErrorToast(
              translate(errorsMessages.toolsetsGetFailed),
            ),
          );
        }),
      ),
    ),
  );

const createToolsetEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.createToolset.type),
    switchMap(({ payload }) => {
      const data = regenerateToolsetId(payload.data);
      const apiPayload = convertToolsetModelToApi(data);

      const path = ApiUtils.encodeApiUrl(getIdWithoutFeatureType(data.id));

      return ToolsetService.saveToolset(apiPayload, path).pipe(
        switchMap(() =>
          forkJoin({
            toolset: ToolsetService.getToolsetByPath(path),
          }).pipe(
            switchMap(({ toolset }) => {
              return toolset
                ? concat(
                    of(
                      ToolsetActions.setEditorStep(ToolsetEditorSteps.Settings),
                    ),
                    of(ToolsetActions.setToolsets([toolset])),
                    of(ToolsetActions.getToolsetDetailsSuccess(toolset)),
                    of(
                      ToolsetActions.addInstalledToolsets({
                        references: [toolset.reference],
                      }),
                    ),
                  )
                : of(ToolsetActions.createToolsetFailed());
            }),
            catchError((err) => {
              console.error('Failed to get toolset: ', err);
              return of(
                UIActions.showErrorToast(
                  translate(errorsMessages.toolsetGetFailed, {
                    name: path,
                  }),
                ),
              );
            }),
          ),
        ),
        catchError((err) => {
          if (err.status === 412) {
            return of(
              ToolsetActions.createToolsetFailed({
                message: translate(
                  'A toolset with this name and this version already exists.',
                ),
              }),
            );
          }

          return of(ToolsetActions.createToolsetFailed());
        }),
      );
    }),
  );

const createToolsetFailedEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.createToolsetFailed.type),
    switchMap(({ payload }) => {
      return of(
        UIActions.showErrorToast(
          payload?.message ??
            translate(errorsMessages.createFailed, {
              entity: 'toolset',
            }),
        ),
      );
    }),
  );

const getToolsetDetailsEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.getToolsetDetails.type),
    switchMap(({ payload }) => {
      const path = getIdWithoutFeatureType(payload.id);
      return ToolsetService.getToolsetByPath(path).pipe(
        switchMap((toolset) => {
          return toolset
            ? of(ToolsetActions.getToolsetDetailsSuccess(toolset))
            : of(ToolsetActions.getToolsetDetailsFailed({ id: payload.id }));
        }),
        catchError(() =>
          of(ToolsetActions.getToolsetDetailsFailed({ id: payload.id })),
        ),
      );
    }),
  );

const getToolsetDetailsFailedEpic: AppEpic = (action$, _state$, { router }) =>
  action$.pipe(
    ofType(ToolsetActions.getToolsetDetailsFailed.type),
    switchMap(({ payload }) => {
      if (router.route === Routes.ToolsetEditor) {
        void router.push(Routes.NotFound);
      }

      return of(
        UIActions.showErrorToast(
          translate(errorsMessages.toolsetGetFailed, {
            name: payload?.id ?? '...',
          }),
        ),
      );
    }),
  );

const updateToolsetEpic: AppEpic = (action$, _state$, { router }) =>
  action$.pipe(
    ofType(ToolsetActions.updateToolset.type),
    switchMap(({ payload }) => {
      const updatedToolset = regenerateToolsetId(payload.newToolset);

      const isMoved = payload.oldToolset.id !== updatedToolset.id;

      const move$ = isMoved
        ? DataService.getDataStorage()
            .move({
              sourceUrl: payload.oldToolset.id,
              destinationUrl: updatedToolset.id,
              overwrite: false,
            })
            .pipe(
              map(() => ({ success: true as const })),
              catchError((err) => {
                if (err.status === 412) {
                  return of({
                    success: false as const,
                    actions: [
                      ToolsetActions.updateToolsetFailed({
                        oldToolset: payload.oldToolset,
                      }),
                      UIActions.showErrorToast(
                        translate(errorsMessages.toolsetAlreadyExists),
                      ),
                    ],
                  });
                }
                console.error('Failed to move toolset:', err);
                return of({
                  success: false as const,
                  actions: [
                    ToolsetActions.updateToolsetFailed({
                      oldToolset: payload.oldToolset,
                    }),
                    UIActions.showErrorToast(
                      translate(errorsMessages.toolsetMoveFailed),
                    ),
                  ],
                });
              }),
            )
        : of({ success: true as const });

      return move$.pipe(
        switchMap((moveResult) => {
          if (!moveResult.success) {
            return of(...moveResult.actions);
          }
          return ToolsetService.updateToolset(
            convertToolsetModelToApi(updatedToolset),
            getIdWithoutFeatureType(updatedToolset.id),
          ).pipe(
            switchMap(() =>
              ToolsetService.getToolsetByPath(
                getIdWithoutFeatureType(updatedToolset.id),
              ).pipe(
                switchMap((updatedToolset) => {
                  if (payload.isSaveAndExit) {
                    void router.push(
                      router.query.publicationUrl
                        ? Routes.Chat
                        : Routes.Marketplace,
                    );
                  }

                  return concat(
                    of(
                      ToolsetActions.updateToolsetSuccess({
                        oldToolset: payload.oldToolset,
                        newToolset: updatedToolset,
                      }),
                    ),
                    iif(
                      () =>
                        !!payload.isSaveAndExit &&
                        !!router.query.publicationUrl,
                      of(PublicationActions.setIsToolsetReview(true)),
                      EMPTY,
                    ),
                    iif(
                      () => !!payload.tabToOpen,
                      of(ToolsetActions.setEditorStep(payload.tabToOpen!)),
                      EMPTY,
                    ),
                    iif(
                      () => !!payload.auth,
                      of(
                        ToolsetActions.startSignInProcess({
                          authLevel: ToolsetCredentialsLevel.GLOBAL,
                          apiKey: payload?.auth?.apiKey,
                          toolset: updatedToolset,
                        }),
                      ),
                      EMPTY,
                    ),
                  );
                }),
              ),
            ),
            catchError((err) => {
              console.error('Failed to update toolset', err.message);
              return concat(
                of(
                  UIActions.showErrorToast(
                    translate(
                      err.status === 400
                        ? errorsMessages.toolsetOAuthNotSupported
                        : errorsMessages.toolsetUpdateFailed,
                    ),
                  ),
                ),
                iif(
                  () => err.status === 400,
                  of(
                    // Reset toolset auth type to NONE and save other values if OAuth is not supported
                    ToolsetActions.updateToolset({
                      oldToolset: payload.oldToolset,
                      newToolset: {
                        ...payload.newToolset,
                        authSettings: {
                          authenticationType: ToolsetAuthTypes.NONE,
                        },
                      },
                    }),
                  ),
                  of(
                    ToolsetActions.updateToolsetFailed({
                      oldToolset: payload.oldToolset,
                    }),
                  ),
                ),
              );
            }),
          );
        }),
      );
    }),
  );

const getInstalledToolsetsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ToolsetActions.getInstalledToolsets.type),
    switchMap(() => {
      const allToolsets = ToolsetSelectors.selectToolsets(state$.value);

      const myToolsetsReferences = allToolsets
        .filter((toolset) => isMyEntity(toolset) || toolset.sharedWithMe)
        .map((myToolset) => myToolset.reference);

      return ClientDataService.getInstalledToolsets().pipe(
        switchMap((installedToolsets) => {
          if (!installedToolsets) {
            return of(
              ToolsetActions.getInstalledToolsetsFail(myToolsetsReferences),
            );
          }

          const actions: Observable<AppAction>[] = [];

          const installedToolsetsSet = new Set(installedToolsets);

          const references = [...installedToolsets, ...myToolsetsReferences];

          const toolsetsToInstall = references.filter(
            (reference) => !installedToolsetsSet.has(reference),
          );

          if (toolsetsToInstall.length) {
            actions.push(
              of(
                ToolsetActions.addInstalledToolsets({
                  references: toolsetsToInstall,
                }),
              ),
            );
          }

          return concat(
            of(ToolsetActions.getInstalledToolsetsSuccess(installedToolsets)),
            ...actions,
          );
        }),

        catchError((error) => {
          if (error?.message && error?.message.endsWith('Not Found')) {
            return of(
              ToolsetActions.getInstalledToolsetsFail(myToolsetsReferences),
            );
          }

          return EMPTY;
        }),
      );
    }),
  );

const getInstalledToolsetsFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.getInstalledToolsetsFail.type),
    switchMap(({ payload: myToolsetsIds }) => {
      return of(
        ToolsetActions.addInstalledToolsets({
          references: myToolsetsIds,
        }),
      );
    }),
  );

const removeFromInstalledToolsetsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ToolsetActions.removeInstalledToolsets.type),
    switchMap(({ payload }) => {
      const stateValue = state$.value;
      const installedToolsets =
        ToolsetSelectors.selectInstalledToolsets(stateValue);

      //TODO change to check by 'public group keys' when toolsets publication will be ready

      const deletedToolsetsSet = new Set(payload.references);
      const newInstalledToolsets = installedToolsets.filter(
        (toolset) => !deletedToolsetsSet.has(toolset),
      );

      return ClientDataService.saveInstalledToolsets(newInstalledToolsets).pipe(
        switchMap(() => {
          const actions: Observable<AppAction>[] = [];
          if (payload.action === DeleteType.DELETE) {
            //TODO uncomment when ToolsetActions.deleteToolsets will be implemented
            //   actions.push(
            //     of(
            //       ToolsetActions.deleteToolsets({
            //         references: payload.references,
            //       }),
            //     ),
            //   );
          }

          return concat(
            ...actions,
            of(
              ToolsetActions.getInstalledToolsetsSuccess(newInstalledToolsets),
            ),
            of(
              ToolsetActions.updateInstalledToolsetsSuccess({
                installedToolsets: newInstalledToolsets,
              }),
            ),
          );
        }),
        catchError((err) => {
          console.error(err);
          return of(
            UIActions.showErrorToast(
              translate(
                errorsMessages.removeFromMarketplaceFailed(
                  payload.references.length > 1 ? 'toolsets' : 'toolset',
                ),
              ),
            ),
          );
        }),
      );
    }),
  );

const addInstalledToolsetsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ToolsetActions.addInstalledToolsets.type),
    switchMap(({ payload }) => {
      const stateValue = state$.value;
      const installedToolsets =
        ToolsetSelectors.selectInstalledToolsets(stateValue);

      const newInstalledToolsets = uniq([
        ...installedToolsets,
        ...payload.references,
      ]);

      return ClientDataService.saveInstalledToolsets(newInstalledToolsets).pipe(
        switchMap(() => {
          const actions: Observable<AppAction>[] = [];

          if (payload.showSuccessToast) {
            actions.push(
              of(
                UIActions.showSuccessToast(
                  translate(
                    `The toolset${payload.references.length > 1 ? 's' : ''} added to my workspace`,
                  ),
                ),
              ),
            );
          }

          return concat(
            ...actions,
            of(
              ToolsetActions.getInstalledToolsetsSuccess(newInstalledToolsets),
            ),
            of(
              ToolsetActions.updateInstalledToolsetsSuccess({
                installedToolsets: newInstalledToolsets,
              }),
            ),
          );
        }),
        catchError((error) => {
          console.error(error);
          return of(
            UIActions.showErrorToast(
              translate(
                errorsMessages.addToMarketplaceFailed(
                  payload.references.length > 1 ? 'toolsets' : 'toolset',
                ),
              ),
            ),
          );
        }),
      );
    }),
  );

const deleteToolsetEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ToolsetActions.deleteToolset.type),
    switchMap(({ payload }) => {
      const toolsetsMap = ToolsetSelectors.selectToolsetsMap(state$.value);
      const targetToolset = toolsetsMap[payload.reference];

      if (!targetToolset) {
        return of(ToolsetActions.deleteToolsetFail());
      }

      return ToolsetService.deleteToolset(
        getIdWithoutFeatureType(targetToolset.id),
      ).pipe(
        switchMap(() => of(ToolsetActions.deleteToolsetSuccess(payload))),
        catchError((err) => {
          console.error('Failed to delete toolset', err);
          return of(ToolsetActions.deleteToolsetFail());
        }),
      );
    }),
  );

const deleteToolsetFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.deleteToolsetFail.type),
    map(() =>
      UIActions.showErrorToast(translate(errorsMessages.toolsetDeleteFailed)),
    ),
  );

const startSignInProcessEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.startSignInProcess.type),
    switchMap(({ payload }) => {
      const authSettings = payload.toolset.authSettings;

      return forkJoin({
        result:
          authSettings.authStatus?.[payload.authLevel] ===
          ToolsetAuthStatus.FAILED
            ? ToolsetService.signOut({
                url: payload.toolset.id,
                authenticationType: authSettings.authenticationType,
                credentialsLevel: payload.authLevel,
              })
            : of(undefined),
      }).pipe(
        switchMap(() => {
          if (
            authSettings?.authenticationType === ToolsetAuthTypes.API_KEY &&
            payload.apiKey
          ) {
            return of(
              ToolsetActions.logInToolset({
                toolsetId: payload.toolset.id,
                authLevel: payload.authLevel,
                authType: ToolsetAuthTypes.API_KEY,
                apiKey: payload.apiKey,
              }),
            );
          }
          if (
            authSettings?.authenticationType === ToolsetAuthTypes.OAUTH &&
            authSettings?.authorizationEndpoint &&
            typeof window !== 'undefined'
          ) {
            const callbackUrl = `${window.location.pathname}${window.location.search}`;
            const state = {
              callbackUrl,
              toolsetId: payload.toolset.id,
              credentialsLevel: payload.authLevel,
            };

            const url = new URL(authSettings.authorizationEndpoint);
            url.searchParams.set('response_type', 'code');
            url.searchParams.set('client_id', authSettings.clientId as string);
            url.searchParams.set('redirect_uri', getToolsetRedirectUri());
            if (authSettings.codeChallenge) {
              url.searchParams.set(
                'code_challenge',
                authSettings.codeChallenge,
              );
            }
            if (authSettings.codeChallengeMethod) {
              url.searchParams.set(
                'code_challenge_method',
                authSettings.codeChallengeMethod,
              );
            }
            url.searchParams.set('state', encodeToolsetRedirectState(state));
            if (authSettings.scopesSupported) {
              url.searchParams.set(
                'scope',
                authSettings.scopesSupported?.join(' '),
              );
            }

            window.location.assign(url.toString());
          }

          return EMPTY;
        }),
        catchError((err) => {
          console.error('Failed to login', err);
          return of(ToolsetActions.logInToolsetFail());
        }),
      );
    }),
  );

const logInToolsetEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ToolsetActions.logInToolset.type),
    switchMap(({ payload }) => {
      const data: ToolsetAuthPayload = {
        url: payload.toolsetId,
        authenticationType: payload.authType,
        credentialsLevel: payload.authLevel,
        ...(payload.authType === ToolsetAuthTypes.OAUTH
          ? { code: payload.code as string }
          : { apiKey: payload.apiKey as string }),
      };

      let callbackUrl = '/';
      if (payload.authType === ToolsetAuthTypes.OAUTH) {
        try {
          const url = new URL(
            payload.callbackUrl ?? '',
            window.location.origin,
          );
          if (url.origin === window.location.origin) {
            callbackUrl = url.href;
          }
        } catch {
          console.error('Invalid callback url');
        }
      }

      return ToolsetService.signIn(data).pipe(
        switchMap(() => {
          if (payload.authType === ToolsetAuthTypes.OAUTH && window) {
            window.location.href = callbackUrl;
            return EMPTY;
          }

          return refreshToolset$(payload.toolsetId, state$.value);
        }),
        catchError((err) => {
          console.error('Failed to sign in toolset', err);
          if (payload.authType === ToolsetAuthTypes.OAUTH) {
            window.location.href = callbackUrl;
          }
          return concat(
            of(ToolsetActions.logInToolsetFail()),
            of(
              UIActions.showErrorToast(
                translate(errorsMessages.toolsetSignInFailed),
              ),
            ),
          );
        }),
      );
    }),
  );

const logOutToolsetEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ToolsetActions.logOutToolset.type),
    switchMap(({ payload }) => {
      return ToolsetService.signOut({
        url: payload.toolsetId,
        authenticationType: payload.authType,
        credentialsLevel: payload.authLevel,
      }).pipe(
        switchMap(() => {
          return refreshToolset$(payload.toolsetId, state$.value);
        }),
        catchError((err) => {
          console.error('Failed to sign out toolset', err);
          return of(ToolsetActions.logOutToolsetFail());
        }),
      );
    }),
  );

const logOutToolsetFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.logOutToolsetFail.type),
    map(() =>
      UIActions.showErrorToast(translate(errorsMessages.toolsetSignOutFailed)),
    ),
  );

const setQueryParamsEpic: AppEpic = (action$, state$, { router }) =>
  action$.pipe(
    ofType(
      ToolsetActions.setEditorStep.type,
      ToolsetActions.setToolsetDetails.type,
      ToolsetActions.getToolsetDetailsSuccess.type,
      ToolsetActions.updateToolsetSuccess.type,
    ),
    filter(() => router.route === Routes.ToolsetEditor),
    switchMap(() => {
      const state = state$.value;
      const query = parse(window.location.search.slice(1));
      const pathname = window.location.pathname;

      // editor step
      query[ToolsetEditorQuery.Step] = ToolsetSelectors.selectEditorStep(state);

      // toolset reference
      const toolset = ToolsetSelectors.selectToolsetDetails(state);
      if (toolset?.reference) {
        query[ToolsetEditorQuery.Id] = toolset.reference;
      }

      void router.push(
        {
          pathname,
          query,
        },
        undefined,
        {
          shallow: true,
        },
      );

      return EMPTY;
    }),
  );

const initQueryParamsEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.initQueryParams.type),
    switchMap(() => {
      const query = parse(window.location.search.slice(1));
      const stepParam = query[ToolsetEditorQuery.Step]?.toString() ?? '';
      const editorStep = isToolsetEditorStep(stepParam)
        ? stepParam
        : ToolsetEditorSteps.General;

      return of(ToolsetActions.setEditorStep(editorStep));
    }),
  );

export const ToolsetEpics = combineEpics(
  initEpic,
  getToolsetsEpic,
  createToolsetEpic,
  createToolsetFailedEpic,
  getToolsetDetailsEpic,
  getToolsetDetailsFailedEpic,
  updateToolsetEpic,
  setQueryParamsEpic,
  initQueryParamsEpic,

  //Delete
  deleteToolsetEpic,
  deleteToolsetFailEpic,

  //Bookmark
  getInstalledToolsetsEpic,
  getInstalledToolsetsFailEpic,
  removeFromInstalledToolsetsEpic,
  addInstalledToolsetsEpic,

  //Signin
  startSignInProcessEpic,
  logInToolsetEpic,
  logOutToolsetEpic,
  logOutToolsetFailEpic,
);
