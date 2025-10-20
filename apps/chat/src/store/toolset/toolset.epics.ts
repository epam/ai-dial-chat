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
import { isMyEntity } from '@/src/utils/app/id';
import { getGroupMarketplaceEntityKey } from '@/src/utils/app/marketplace';
import {
  encodeToolsetRedirectState,
  getToolsetRedirectUri,
  regenerateToolsetId,
} from '@/src/utils/app/toolsets';
import { translate } from '@/src/utils/app/translation';

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
import {
  MarketplaceEntitiesTabs,
  MarketplaceQueryParams,
  MarketplaceTabs,
} from '@/src/constants/marketplace';
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

      return ToolsetService.saveToolset(data).pipe(
        switchMap(() =>
          forkJoin({
            toolset: ToolsetService.getToolsetById(data.id),
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
                    name: data.id,
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
      return ToolsetService.getToolsetById(payload.id).pipe(
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
      if (window.location.pathname === Routes.ToolsetEditor) {
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
          return ToolsetService.updateToolset(updatedToolset).pipe(
            switchMap(() =>
              ToolsetService.getToolsetById(updatedToolset.id).pipe(
                switchMap((savedUpdatedToolset) => {
                  if (!savedUpdatedToolset) {
                    return of(
                      UIActions.showErrorToast(
                        translate(errorsMessages.toolsetGetFailed, {
                          name: updatedToolset.id,
                        }),
                      ),
                    );
                  }
                  if (payload.redirectUrl) {
                    void router.push({
                      pathname: payload.redirectUrl,
                      ...(payload.redirectUrl === Routes.Marketplace && {
                        query: {
                          [MarketplaceQueryParams.tab]:
                            MarketplaceTabs.MY_WORKSPACE,
                          [MarketplaceQueryParams.entitiesTab]:
                            MarketplaceEntitiesTabs.TOOLSETS,
                        },
                      }),
                    });
                  }

                  return concat(
                    of(
                      ToolsetActions.updateToolsetSuccess({
                        oldToolset: payload.oldToolset,
                        newToolset: savedUpdatedToolset,
                      }),
                    ),
                    iif(
                      () =>
                        payload.redirectUrl === Routes.Chat &&
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
                          authLevel:
                            payload?.auth?.authLevel ??
                            ToolsetCredentialsLevel.GLOBAL,
                          apiKey: payload?.auth?.apiKey,
                          toolset: savedUpdatedToolset,
                        }),
                      ),
                      EMPTY,
                    ),
                    of(
                      MarketplaceActions.setDetailsEntity(
                        payload.redirectUrl === Routes.Marketplace &&
                          !!payload.shouldSelectToolset
                          ? {
                              reference: savedUpdatedToolset.reference,
                              type: MarketplaceEntitiesTabs.TOOLSETS,
                              isSuggested: false,
                            }
                          : undefined,
                      ),
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
      const toolsets = ToolsetSelectors.selectToolsets(stateValue);
      const toolsetsGroupKeys = ToolsetSelectors.selectAllGroupToolsetsKeySet(
        stateValue,
        payload.references,
      );

      const deletedToolsetsSet = new Set(
        toolsets
          .filter((toolset) =>
            toolsetsGroupKeys.has(getGroupMarketplaceEntityKey(toolset)),
          )
          .map((toolset) => toolset.reference),
      );
      const newInstalledToolsets = installedToolsets.filter(
        (toolset) => !deletedToolsetsSet.has(toolset),
      );

      return ClientDataService.saveInstalledToolsets(newInstalledToolsets).pipe(
        switchMap(() => {
          const actions: Observable<AppAction>[] = [];

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

      const toolsets = ToolsetSelectors.selectToolsets(stateValue);
      const toolsetsGroupKeys = ToolsetSelectors.selectAllGroupToolsetsKeySet(
        stateValue,
        payload.references,
      );

      const newInstalledToolsets = uniq([
        ...installedToolsets,
        ...toolsets
          .filter((toolset) =>
            toolsetsGroupKeys.has(getGroupMarketplaceEntityKey(toolset)),
          )
          .map((toolset) => toolset.reference),
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

      return ToolsetService.deleteToolset(targetToolset.id).pipe(
        switchMap(() => {
          return concat(
            of(
              ToolsetActions.removeInstalledToolsets({
                references: [targetToolset.reference],
              }),
            ),
            of(ToolsetActions.deleteToolsetSuccess(payload)),
          );
        }),
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

const logInToolsetEpic: AppEpic = (action$, state$, { router }) =>
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
            void router.push(new URL(callbackUrl));

            return EMPTY;
          }

          return refreshToolset$(payload.toolsetId, state$.value);
        }),
        catchError((err) => {
          console.error('Failed to sign in toolset', err);
          if (payload.authType === ToolsetAuthTypes.OAUTH) {
            void router.push(new URL(callbackUrl));
          }
          return concat(of(ToolsetActions.logInToolsetFail()));
        }),
      );
    }),
  );

const loginToolsetFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.logInToolsetFail.type),
    map(() =>
      UIActions.showErrorToast(translate(errorsMessages.toolsetSignInFailed)),
    ),
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
    switchMap(() => {
      if (window.location.pathname !== Routes.ToolsetEditor) return EMPTY;
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
  loginToolsetFailEpic,
  logOutToolsetEpic,
  logOutToolsetFailEpic,
);
