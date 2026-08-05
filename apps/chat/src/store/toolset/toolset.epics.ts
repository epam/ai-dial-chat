import {
  EMPTY,
  Observable,
  catchError,
  concat,
  defer,
  filter,
  forkJoin,
  from,
  iif,
  map,
  mergeMap,
  of,
  switchMap,
} from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { getSafeRedirectUrl } from '@/src/utils/app/common';
import { ClientDataService } from '@/src/utils/app/data/client-data-service';
import { DataService } from '@/src/utils/app/data/data-service';
import { ToolsetService } from '@/src/utils/app/data/toolset-service';
import { navigateAndThen } from '@/src/utils/app/epics-helpers/application.epic-helpers';
import { parseApiError } from '@/src/utils/app/epics-helpers/common.epic-helpers';
import { refreshToolset$ } from '@/src/utils/app/epics-helpers/toolset.epic-helpers';
import {
  getEntityNameFromId,
  isMyEntity,
  isPredefinedEntity,
} from '@/src/utils/app/id';
import { getGroupMarketplaceEntityKey } from '@/src/utils/app/marketplace';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import {
  encodeToolsetRedirectState,
  fitToolsetNameToStorageLimits,
  getToolsetRedirectUri,
  isToolsetSignedIn,
  regenerateToolsetId,
} from '@/src/utils/app/toolsets';
import { translate } from '@/src/utils/app/translation';
import { signInToolset } from '@/src/utils/auth/auth-toolset';
import { getVersionFromId } from '@/src/utils/server/api';

import { ChatEventOperations } from '@/src/types/chat-events';
import { AppAction, AppEpic } from '@/src/types/store';
import {
  ToolsetAuthPayload,
  ToolsetCredentialsLevel,
  ToolsetEditorSteps,
  ToolsetModel,
} from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import {
  ChatEventsActions,
  ConversationsActions,
  MarketplaceActions,
  PublicationActions,
  UIActions,
} from '@/src/store/actions';
import { AuthSelectors } from '@/src/store/selectors';
import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { ChatI18nKeys, CommonI18nKeys } from '@/src/constants/i18n';
import {
  MarketplaceEntitiesTabs,
  MarketplaceQueryParams,
  MarketplaceTabs,
} from '@/src/constants/marketplace';
import {
  QUERY_VALUE_FALSE,
  QUERY_VALUE_TRUE,
  Routes,
} from '@/src/constants/routes';
import {
  ToolsetEditorQuery,
  ToolsetLoginQuery,
} from '@/src/constants/toolsets';

import { ToolsetAuthStatus, ToolsetAuthTypes } from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';
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

const getMyWorkspaceUrl = (
  params?: Partial<Record<MarketplaceQueryParams, unknown>>,
) => {
  const route = new URL(Routes.Marketplace);
  route.searchParams.append(
    MarketplaceQueryParams.tab,
    MarketplaceTabs.MY_WORKSPACE,
  );

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      route.searchParams.append(key, value as string);
    });
  }

  return route;
};

const getLoginSuccessMessage = (
  isAdminAndPublic: boolean,
  authLevel: ToolsetCredentialsLevel,
) => {
  switch (authLevel) {
    case ToolsetCredentialsLevel.GLOBAL:
      return isAdminAndPublic
        ? 'Successful login\nYou have successfully logged into the "{{name}}" version {{version}} with credentials to entire organization.'
        : 'Successful login\nYou have successfully logged into the "{{name}}" version {{version}}.';
    case ToolsetCredentialsLevel.USER:
      return 'Successful login\nYou have successfully logged into the "{{name}}" version {{version}} with personal credentials.';
    default:
      return '';
  }
};
const getLogoutSuccessMessage = (
  isAdminAndPublic: boolean,
  authLevel: ToolsetCredentialsLevel,
) => {
  switch (authLevel) {
    case ToolsetCredentialsLevel.GLOBAL:
      return isAdminAndPublic
        ? 'Successful logout\nYou have successfully logged out of the "{{name}}" version {{version}} with credentials to entire organization.'
        : 'Successful logout\nYou have successfully logged out of the "{{name}}" version {{version}}.';
    case ToolsetCredentialsLevel.USER:
      return 'Successful logout\nYou have successfully logged out of the "{{name}}" version {{version}} using your personal credentials.';
    default:
      return '';
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
          const { traceId } = parseApiError(err);
          return of(
            UIActions.showErrorToast({
              traceId,
              message: translate(CommonI18nKeys.ToolsetsGetFailed, {
                ns: Translation.Common,
              }),
            }),
          );
        }),
      ),
    ),
  );

const createToolsetEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.createToolset.type),
    switchMap(({ payload }) => {
      const data = regenerateToolsetId(
        fitToolsetNameToStorageLimits(payload.data),
      );

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
              const { traceId } = parseApiError(err);
              return of(
                UIActions.showErrorToast({
                  traceId,
                  message: translate(CommonI18nKeys.ToolsetGetFailed, {
                    ns: Translation.Common,
                    name: data.id,
                  }),
                }),
              );
            }),
          ),
        ),
        catchError((err) => {
          const { traceId } = parseApiError(err);

          if (err.status === 412) {
            return of(
              ToolsetActions.createToolsetFailed({
                message: translate(
                  CommonI18nKeys.ToolsetNameVersionAlreadyExists,
                  { ns: Translation.Common },
                ),
                traceId,
              }),
            );
          }

          return of(ToolsetActions.createToolsetFailed({ traceId }));
        }),
      );
    }),
  );

const createToolsetFailedEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.createToolsetFailed.type),
    switchMap(({ payload }) => {
      return of(
        UIActions.showErrorToast({
          message:
            payload?.message ??
            translate(CommonI18nKeys.CreateFailed, {
              ns: Translation.Common,
              entity: 'toolset',
            }),
          traceId: payload?.traceId,
        }),
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
        catchError((err) =>
          of(
            ToolsetActions.getToolsetDetailsFailed({
              ...parseApiError(err),
              id: payload.id,
            }),
          ),
        ),
      );
    }),
  );

const getToolsetDetailsFailedEpic: AppEpic = (action$, _state$, { router }) =>
  action$.pipe(
    ofType(ToolsetActions.getToolsetDetailsFailed.type),
    switchMap(({ payload }) => {
      if (window.location.pathname === Routes.ToolsetEditor) {
        console.error(
          'NotFound',
          `Toolset with id ${payload?.id} is not found`,
        );
        void router.push(Routes.NotFound);
      }

      return of(
        UIActions.showErrorToast({
          traceId: payload?.traceId,
          message: translate(CommonI18nKeys.ToolsetGetFailed, {
            ns: Translation.Common,
            name: payload?.id ?? '...',
          }),
        }),
      );
    }),
  );

const updateToolsetEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.updateToolset.type),
    switchMap(({ payload }) => {
      const updatedToolset = regenerateToolsetId(
        fitToolsetNameToStorageLimits(payload.newToolset),
      );

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
                const failActions = [
                  ToolsetActions.updateToolsetFailed({
                    oldToolset: payload.oldToolset,
                  }),
                  UIActions.setEditorLoader(false),
                ];
                const { traceId } = parseApiError(err);
                if (err.status === 412) {
                  return of({
                    success: false as const,
                    actions: [
                      ...failActions,
                      UIActions.showErrorToast({
                        traceId,
                        message: translate(
                          CommonI18nKeys.ToolsetAlreadyExists,
                          {
                            ns: Translation.Common,
                          },
                        ),
                      }),
                    ],
                  });
                }
                console.error('Failed to move toolset:', err);
                return of({
                  success: false as const,
                  actions: [
                    ...failActions,
                    UIActions.showErrorToast({
                      traceId,
                      message: translate(CommonI18nKeys.ToolsetMoveFailed, {
                        ns: Translation.Common,
                      }),
                    }),
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
                      UIActions.showErrorToast({
                        message: translate(CommonI18nKeys.ToolsetGetFailed, {
                          ns: Translation.Common,
                          name: updatedToolset.id,
                        }),
                      }),
                    );
                  }

                  const actions: Observable<AppAction>[] = [
                    of(UIActions.setEditorLoader(false)),
                    of(
                      ToolsetActions.updateToolsetSuccess({
                        oldToolset: payload.oldToolset,
                        newToolset: savedUpdatedToolset,
                        isExitingAfterSave: payload.exitAfterSave,
                      }),
                    ),
                  ];

                  if (payload.exitAfterSave) {
                    actions.push(
                      of(
                        ToolsetActions.exitEditor({
                          redirectUrl: payload.redirectUrl,
                          shouldSelectToolset: payload.shouldSelectToolset,
                        }),
                      ),
                    );
                  } else {
                    if (payload.tabToOpen) {
                      actions.push(
                        of(ToolsetActions.setEditorStep(payload.tabToOpen)),
                      );
                    }
                  }
                  if (payload.auth) {
                    actions.push(
                      of(
                        ToolsetActions.startSignInProcess({
                          authLevel:
                            payload?.auth?.authLevel ??
                            ToolsetCredentialsLevel.GLOBAL,
                          apiKey: payload?.auth?.apiKey,
                          toolset: savedUpdatedToolset,
                        }),
                      ),
                    );
                  }

                  return concat(...actions);
                }),
              ),
            ),
            catchError((err) => {
              console.error('Failed to update toolset', err.message);
              const { traceId } = parseApiError(err);
              return concat(
                of(
                  UIActions.showErrorToast({
                    traceId,
                    message: translate(
                      err.status === 400
                        ? CommonI18nKeys.ToolsetOAuthNotSupported
                        : CommonI18nKeys.ToolsetUpdateFailed,
                      { ns: Translation.Common },
                    ),
                  }),
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
                  concat(
                    of(
                      ToolsetActions.updateToolsetFailed({
                        oldToolset: payload.oldToolset,
                      }),
                    ),
                    of(UIActions.setEditorLoader(false)),
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
      const allToolsets = ToolsetSelectors.selectToolsets(state$.value, true);

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
          const { message } = parseApiError(error);
          if (message?.endsWith('Not Found')) {
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
      const toolsets = ToolsetSelectors.selectToolsets(stateValue, true);
      const toolsetsGroupKeys = ToolsetSelectors.selectAllGroupToolsetsKeySet(
        stateValue,
        payload.references,
      );

      const deletedToolsetsSet = new Set(
        toolsets
          .filter((toolset) => {
            if (isMyEntity(toolset)) {
              return payload.references.includes(toolset.reference);
            }

            return toolsetsGroupKeys.has(getGroupMarketplaceEntityKey(toolset));
          })
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
          const { traceId } = parseApiError(err);

          return of(
            UIActions.showErrorToast({
              message: translate(CommonI18nKeys.RemoveFromMarketplaceFailed, {
                ns: Translation.Common,
                entityType:
                  payload.references.length > 1 ? 'toolsets' : 'toolset',
              }),
              traceId,
            }),
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

      const toolsets = ToolsetSelectors.selectToolsets(stateValue, true);
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
                    payload.references.length > 1
                      ? CommonI18nKeys.ToolsetsAddedToMyWorkspace
                      : CommonI18nKeys.ToolsetAddedToMyWorkspace,
                    { ns: Translation.Common },
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
          const { traceId } = parseApiError(error);

          return of(
            UIActions.showErrorToast({
              message: translate(CommonI18nKeys.AddToMarketplaceFailed, {
                ns: Translation.Common,
                entityType:
                  payload.references.length > 1 ? 'toolsets' : 'toolset',
              }),
              traceId,
            }),
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
          return of(ToolsetActions.deleteToolsetFail(parseApiError(err)));
        }),
      );
    }),
  );

const deleteToolsetFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.deleteToolsetFail.type),
    map(({ payload }) =>
      UIActions.showErrorToast({
        message: translate(CommonI18nKeys.ToolsetDeleteFailed, {
          ns: Translation.Common,
        }),
        traceId: payload?.traceId,
      }),
    ),
  );

const startSignInProcessEpic: AppEpic = (action$, state$) =>
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
            const isAdmin = AuthSelectors.selectIsAdmin(state$.value);
            const callbackUrl = `${window.location.pathname}${window.location.search}`;
            const state = {
              callbackUrl,
              toolsetId: payload.toolset.id,
              credentialsLevel: payload.authLevel,
              isAdmin,
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
            if (authSettings.scopesSupported?.length) {
              url.searchParams.set(
                'scope',
                authSettings.scopesSupported?.join(' '),
              );
            }

            return defer(() =>
              from(signInToolset(url.href)).pipe(
                switchMap((isPopup) =>
                  !isPopup
                    ? of(ToolsetActions.logInToolsetFail())
                    : refreshToolset$(payload.toolset.id, state$.value).pipe(
                        mergeMap((actions) =>
                          concat(
                            of(actions),
                            of(
                              ToolsetActions.logInToolsetSuccess({
                                toolsetId: payload.toolset.id,
                                authLevel: payload.authLevel,
                              }),
                            ),
                          ),
                        ),
                      ),
                ),
              ),
            );
          }

          return EMPTY;
        }),
        catchError((err) => {
          console.error('Failed to login', err);
          return of(ToolsetActions.logInToolsetFail(parseApiError(err)));
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
          ? {
              code: payload.code as string,
              redirectUri: getToolsetRedirectUri(),
            }
          : { apiKey: payload.apiKey as string }),
      };

      const callbackUrl = payload.callbackUrl ?? '/';

      return ToolsetService.signIn(data).pipe(
        switchMap(() => {
          if (payload.authType === ToolsetAuthTypes.OAUTH && window) {
            if (payload.isPopup) {
              void router.push(
                {
                  pathname: router.pathname,
                  query: {
                    [ToolsetLoginQuery.LoginComplete]: QUERY_VALUE_TRUE,
                  },
                },
                undefined,
                { shallow: true },
              );
            } else {
              void router.push(callbackUrl);
            }

            return concat(
              of(
                ToolsetActions.logInToolsetSuccess({
                  skipToastMessage: payload.isPopup,
                  toolsetId: payload.toolsetId,
                  authLevel: payload.authLevel,
                  isAdmin: payload.isAdmin,
                }),
              ),
            );
          }

          return refreshToolset$(payload.toolsetId, state$.value).pipe(
            mergeMap((actions) =>
              concat(
                of(actions),
                of(
                  ToolsetActions.logInToolsetSuccess({
                    toolsetId: payload.toolsetId,
                    authLevel: payload.authLevel,
                    isAdmin: payload.isAdmin,
                  }),
                ),
              ),
            ),
          );
        }),
        catchError((err) => {
          console.error('Failed to sign in toolset', err);
          if (payload.authType === ToolsetAuthTypes.OAUTH) {
            if (payload.isPopup) {
              void router.push(
                {
                  pathname: router.pathname,
                  query: {
                    [ToolsetLoginQuery.LoginComplete]: QUERY_VALUE_FALSE,
                  },
                },
                undefined,
                { shallow: true },
              );
            } else {
              void router.push(new URL(callbackUrl));
            }
          }
          return of(
            ToolsetActions.logInToolsetFail({
              ...parseApiError(err),
              skipToastMessage: payload.isPopup,
            }),
          );
        }),
      );
    }),
  );

const loginToolsetSuccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ToolsetActions.logInToolsetSuccess.type),
    filter(({ payload }) => !payload.skipToastMessage),
    map(({ payload }) => {
      const isAdmin = AuthSelectors.selectIsAdmin(state$.value);
      const isPublic =
        isEntityIdPublic({ id: payload.toolsetId }) ||
        isPredefinedEntity({ id: payload.toolsetId });
      const name = getEntityNameFromId(payload.toolsetId, {
        removeVersion: true,
      });
      const version = getVersionFromId(payload.toolsetId);

      return UIActions.showSuccessToast(
        translate(
          getLoginSuccessMessage(
            (payload.isAdmin ?? isAdmin) && isPublic,
            payload.authLevel,
          ),
          { name, version },
        ),
      );
    }),
  );

const loginToolsetFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.logInToolsetFail.type),
    filter(({ payload }) => !payload?.skipToastMessage),
    map(({ payload }) =>
      UIActions.showErrorToast({
        traceId: payload?.traceId,
        message: translate(CommonI18nKeys.ToolsetSignInFailed, {
          ns: Translation.Common,
        }),
      }),
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
          const isAdmin = AuthSelectors.selectIsAdmin(state$.value);
          const isPublic =
            isEntityIdPublic({ id: payload.toolsetId }) ||
            isPredefinedEntity({ id: payload.toolsetId });
          const name = getEntityNameFromId(payload.toolsetId, {
            removeVersion: true,
          });
          const version = getVersionFromId(payload.toolsetId);

          return refreshToolset$(payload.toolsetId, state$.value).pipe(
            mergeMap((actions) =>
              concat(
                of(actions),
                of(
                  UIActions.showSuccessToast(
                    translate(
                      getLogoutSuccessMessage(
                        isAdmin && isPublic,
                        payload.authLevel,
                      ),
                      { name, version },
                    ),
                  ),
                ),
                of(ToolsetActions.logOutToolsetSuccess()),
              ),
            ),
          );
        }),
        catchError((err) => {
          console.error('Failed to sign out toolset', err);
          return of(ToolsetActions.logOutToolsetFail(parseApiError(err)));
        }),
      );
    }),
  );

const logOutToolsetFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.logOutToolsetFail.type),
    map(({ payload }) =>
      UIActions.showErrorToast({
        traceId: payload?.traceId,
        message: translate(CommonI18nKeys.ToolsetSignOutFailed, {
          ns: Translation.Common,
        }),
      }),
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
    switchMap((action) => {
      const isExitingAfterSave =
        action.type === ToolsetActions.updateToolsetSuccess.type &&
        action.payload.isExitingAfterSave;

      if (
        window.location.pathname !== Routes.ToolsetEditor ||
        isExitingAfterSave
      )
        return EMPTY;
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

const exitEditorEpic: AppEpic = (action$, _state$, { router }) =>
  action$.pipe(
    ofType(ToolsetActions.exitEditor.type),
    switchMap(({ payload }) => {
      const query = parse(window.location.search.slice(1));
      const publicationUrl =
        query[ToolsetEditorQuery.PublicationUrl]?.toString();
      const returnUrlQuery = query[ToolsetEditorQuery.ReturnUrl]?.toString();
      const reference = query[ToolsetEditorQuery.Id]?.toString();
      const returnUrl = returnUrlQuery
        ? getSafeRedirectUrl(decodeURIComponent(returnUrlQuery))
        : undefined;
      const redirectUrl = payload.redirectUrl
        ? getSafeRedirectUrl(payload.redirectUrl.toString())
        : undefined;

      const route =
        redirectUrl ??
        returnUrl ??
        (publicationUrl
          ? new URL(Routes.Chat)
          : getMyWorkspaceUrl({
              [MarketplaceQueryParams.entitiesTab]:
                MarketplaceEntitiesTabs.TOOLSETS,
            }));

      if (
        route.pathname === Routes.Marketplace &&
        payload.shouldSelectToolset &&
        reference
      ) {
        route.searchParams.append(MarketplaceQueryParams.toolset, reference);
      }

      const actions: Observable<AppAction>[] = [];

      if (route.pathname === Routes.Marketplace) {
        if (payload.shouldSelectToolset && reference) {
          actions.push(
            of(
              MarketplaceActions.setDetailsEntity({
                reference: reference as string,
                type: MarketplaceEntitiesTabs.TOOLSETS,
                isSuggested: false,
              }),
            ),
          );
        }
      }

      if (!publicationUrl) {
        actions.push(
          of(
            ConversationsActions.createNewConversations({
              names: [
                translate(ChatI18nKeys.NewConversation, {
                  ns: Translation.Chat,
                }),
              ],
            }),
          ),
        );
      } else {
        actions.push(
          of(ConversationsActions.selectConversations({ conversationIds: [] })),
          of(PublicationActions.setIsToolsetReview(true)),
        );
      }

      actions.push(of(UIActions.setEditorLoader(false)));
      actions.push(of(ToolsetActions.clearToolsetDetails()));

      return navigateAndThen(router, route, concat(...actions));
    }),
  );

const expireLoggedInToolsetsCredsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ChatEventsActions.addEvents.type),
    switchMap(({ payload }) => {
      const toolsetEvents = payload.filter(
        ({ method }) => method === ChatEventOperations.ToolsetSignIn,
      );

      if (!toolsetEvents.length) return EMPTY;

      const toolsetsMap = ToolsetSelectors.selectToolsetsMap(state$.value);
      const toolsetsWithExpiredCreds = (
        toolsetEvents
          .map(({ params }) => toolsetsMap[params.toolsetId])
          .filter(
            (t) =>
              !!t &&
              isToolsetSignedIn(
                t,
                isEntityIdPublic(t)
                  ? ToolsetCredentialsLevel.USER
                  : ToolsetCredentialsLevel.GLOBAL,
              ),
          ) as ToolsetModel[]
      ).map((t) => ({
        ...t,
        authSettings: {
          ...t.authSettings,
          authStatus: {
            ...t.authSettings.authStatus,
            [isEntityIdPublic(t)
              ? ToolsetCredentialsLevel.USER
              : ToolsetCredentialsLevel.GLOBAL]: ToolsetAuthStatus.FAILED,
          } as Record<ToolsetCredentialsLevel, ToolsetAuthStatus>,
        },
      }));

      return toolsetsWithExpiredCreds.length
        ? of(ToolsetActions.setToolsets(toolsetsWithExpiredCreds))
        : EMPTY;
    }),
  );

const repairToolsetEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.repairToolset.type),
    switchMap(({ payload }) =>
      ToolsetService.repair(payload.id).pipe(
        switchMap(() =>
          ToolsetService.getToolsetById(payload.id).pipe(
            switchMap((toolset) => {
              return toolset
                ? concat(
                    of(ToolsetActions.getToolsetDetailsSuccess(toolset)),
                    of(
                      UIActions.showSuccessToast(
                        translate(CommonI18nKeys.ToolsetRepairSuccessMessage, {
                          ns: Translation.Common,
                        }),
                      ),
                    ),
                  )
                : of(ToolsetActions.repairToolsetFailed(payload));
            }),
          ),
        ),
        catchError((err) => {
          const { traceId } = parseApiError(err);

          return of(
            ToolsetActions.repairToolsetFailed({
              ...payload,
              traceId,
              status: err.status as number | undefined,
            }),
          );
        }),
      ),
    ),
  );

const repairToolsetFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.repairToolsetFailed.type),
    map(({ payload }) => {
      const message =
        payload.status === 424
          ? CommonI18nKeys.ToolsetRepairFailedMessage
          : CommonI18nKeys.GeneralServerError;

      return UIActions.showErrorToast({
        message: translate(message, {
          ns: Translation.Common,
        }),
        traceId: payload.traceId,
      });
    }),
  );

const getAllowedToolsEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.getAllowedTools.type),
    switchMap(({ payload }) => {
      return ToolsetService.getTools(payload.id).pipe(
        switchMap((tools) =>
          of(ToolsetActions.getAllowedToolsSuccess({ id: payload.id, tools })),
        ),
        catchError((err) => {
          const { traceId } = parseApiError(err);

          return of(ToolsetActions.getAllowedToolsFailed({ traceId }));
        }),
      );
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
  exitEditorEpic,
  expireLoggedInToolsetsCredsEpic,
  repairToolsetEpic,
  repairToolsetFailEpic,

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
  loginToolsetSuccessEpic,
  loginToolsetFailEpic,
  logOutToolsetEpic,
  logOutToolsetFailEpic,

  //Allowed tools
  getAllowedToolsEpic,
);
