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
} from '@/src/types/toolsets';

import { UIActions } from '@/src/store/actions';
import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { errorsMessages } from '@/src/constants/errors';
import { DeleteType } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';
import { ToolsetEditorQuery } from '@/src/constants/toolsets';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';
import { uniq } from 'lodash-es';

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
          ),
        ),
        catchError((err) => {
          console.error('Failed to get toolsets: ', err);
          return of(
            UIActions.showErrorToast(translate('Failed to get toolsets')),
          );
        }),
      ),
    ),
  );

const createToolsetEpic: AppEpic = (action$, _state$, { router }) =>
  action$.pipe(
    ofType(ToolsetActions.createToolset.type),
    switchMap(({ payload }) => {
      const data = regenerateToolsetId(payload.data);
      const apiPayload = convertToolsetModelToApi(data);

      const path = ApiUtils.encodeApiUrl(getIdWithoutFeatureType(data.id));
      const shouldUpdateQuery = router.pathname === Routes.ToolsetEditor;

      return ToolsetService.saveToolset(apiPayload, path).pipe(
        switchMap(() =>
          forkJoin({
            toolset: ToolsetService.getToolsetByPath(path),
          }).pipe(
            switchMap(({ toolset }) => {
              if (toolset && shouldUpdateQuery) {
                void router.push({
                  query: {
                    [ToolsetEditorQuery.Id]: toolset.reference,
                  },
                });
              }

              return toolset
                ? concat(
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
                  translate('Failed to get toolset: {{entity}}', {
                    entity: path,
                  }),
                ),
              );
            }),
          ),
        ),
      );
    }),
  );

const createToolsetFailedEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.createToolsetFailed.type),
    switchMap(() => {
      return of(
        UIActions.showErrorToast(
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
            : of(ToolsetActions.getToolsetDetailsFailed());
        }),
      );
    }),
  );

const updateToolsetEpic: AppEpic = (action$, _state, { router }) =>
  action$.pipe(
    ofType(ToolsetActions.updateToolset.type),
    switchMap(({ payload }) => {
      const updatedToolset = regenerateToolsetId(payload.newToolset);

      const isMoved = payload.oldToolset.id !== updatedToolset.id;
      const shouldUpdateQuery =
        router.pathname === Routes.ToolsetEditor && isMoved;

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
                        translate(
                          'A toolset with this name and this version already exists.',
                        ),
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
                      translate('Failed to move toolset'),
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
          return ToolsetService.saveToolset(
            convertToolsetModelToApi(updatedToolset),
            getIdWithoutFeatureType(updatedToolset.id),
          ).pipe(
            switchMap(() =>
              ToolsetService.getToolsetByPath(
                getIdWithoutFeatureType(updatedToolset.id),
              ).pipe(
                switchMap((updatedToolset) => {
                  if (shouldUpdateQuery) {
                    void router.push({
                      query: {
                        [ToolsetEditorQuery.Id]: updatedToolset.reference,
                      },
                    });
                  }

                  return concat(
                    of(
                      ToolsetActions.updateToolsetSuccess({
                        oldToolset: payload.oldToolset,
                        newToolset: updatedToolset,
                      }),
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
              console.error('Failed to update toolset:', err.message);
              return of(
                ToolsetActions.updateToolsetFailed({
                  oldToolset: payload.oldToolset,
                }),
                UIActions.showErrorToast(translate('Failed to update toolset')),
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
                `Failed to remove toolset${payload.references.length > 1 ? 's' : ''} from my workspace`,
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
                `Failed to add toolset${payload.references.length > 1 ? 's' : ''} to my workspace`,
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
    map(() => UIActions.showErrorToast(translate('Failed to delete toolset'))),
  );

const refreshToolset$ = (path: string, route?: string) =>
  ToolsetService.getToolsetByPath(path).pipe(
    switchMap((toolset) => {
      const shouldUpdateDetails = route === Routes.ToolsetEditor;
      return concat(
        of(ToolsetActions.setToolsets([toolset])),
        iif(
          () => shouldUpdateDetails,
          of(ToolsetActions.getToolsetDetailsSuccess(toolset)),
          EMPTY,
        ),
      );
    }),
    catchError(() => {
      return of(UIActions.showErrorToast(translate('Failed to get toolset')));
    }),
  );

const startSignInProcess: AppEpic = (action$, _state) =>
  action$.pipe(
    ofType(ToolsetActions.startSignInProcess.type),
    switchMap(({ payload }) => {
      const authSettings = payload.toolset.authSettings;
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
        url.searchParams.set(
          'code_challenge',
          authSettings.codeChallenge as string,
        );
        url.searchParams.set(
          'code_challenge_method',
          authSettings.codeChallengeMethod as string,
        );
        url.searchParams.set('state', encodeToolsetRedirectState(state));

        window.location.assign(url.toString());
      }

      return EMPTY;
    }),
  );

const logInToolsetEpic: AppEpic = (action$, _state, { router }) =>
  action$.pipe(
    ofType(ToolsetActions.logInToolset.type),
    switchMap(({ payload }) => {
      const data: ToolsetAuthPayload = {
        url: payload.toolsetId,
        authentication_type: payload.authType,
        credentials_level: payload.authLevel,
        ...(payload.authType === ToolsetAuthTypes.OAUTH
          ? { code: payload.code as string }
          : { api_key: payload.apiKey as string }),
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

          return refreshToolset$(
            getIdWithoutFeatureType(payload.toolsetId),
            router.pathname,
          );
        }),
        catchError((err) => {
          console.error('Failed to sign in toolset', err);
          if (payload.authType === ToolsetAuthTypes.OAUTH) {
            window.location.href = callbackUrl;
          }
          return concat(
            of(ToolsetActions.logInToolsetFail()),
            of(
              UIActions.showErrorToast(translate('Failed to sign in toolset')),
            ),
          );
        }),
      );
    }),
  );

const logOutToolsetEpic: AppEpic = (action$, _state, { router }) =>
  action$.pipe(
    ofType(ToolsetActions.logOutToolset.type),
    switchMap(({ payload }) => {
      return ToolsetService.signOut({
        url: payload.toolsetId,
        authentication_type: payload.authType,
        credentials_level: payload.authLevel,
      }).pipe(
        switchMap(() => {
          return refreshToolset$(
            getIdWithoutFeatureType(payload.toolsetId),
            router.pathname,
          );
        }),
        catchError((err) => {
          console.error('Failed to sign out toolset', err);
          return of(
            UIActions.showErrorToast(translate('Failed to sign out toolset')),
          );
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
  updateToolsetEpic,

  //Delete
  deleteToolsetEpic,
  deleteToolsetFailEpic,

  //Bookmark
  getInstalledToolsetsEpic,
  getInstalledToolsetsFailEpic,
  removeFromInstalledToolsetsEpic,
  addInstalledToolsetsEpic,

  //Signin
  startSignInProcess,
  logInToolsetEpic,
  logOutToolsetEpic,
);
