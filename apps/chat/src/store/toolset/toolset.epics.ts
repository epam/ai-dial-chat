import {
  EMPTY,
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

import { DataService } from '@/src/utils/app/data/data-service';
import { ToolsetService } from '@/src/utils/app/data/toolset-service';
import { getIdWithoutFeatureType } from '@/src/utils/app/id';
import {
  convertToolsetModelToApi,
  regenerateToolsetId,
} from '@/src/utils/app/toolsets';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import { AppEpic } from '@/src/types/store';
import {
  ToolsetAuthPayload,
  ToolsetCredentialsLevel,
  ToolsetModel,
} from '@/src/types/toolsets';

import { UIActions } from '@/src/store/actions';
import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { errorsMessages } from '@/src/constants/errors';
import { Routes } from '@/src/constants/routes';
import { ToolsetEditorQuery } from '@/src/constants/toolsets';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';

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
          concat(of(ToolsetActions.getToolsetsSuccess(toolsets))),
        ),
      ),
    ),
  );

const createToolsetEpic: AppEpic = (action$, _state$, { router }) =>
  action$.pipe(
    ofType(ToolsetActions.createToolset.type),
    switchMap(({ payload }) => {
      const data = regenerateToolsetId(payload.data);
      const apiPayload = convertToolsetModelToApi(data as ToolsetModel);

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
                  )
                : of(ToolsetActions.createToolsetFailed());
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
              console.error('Failed to update toolset:', err);
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

const startSignInProcess: AppEpic = (action$, _state, { router }) =>
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
        const callbackUrl = router.asPath;
        const state = {
          callbackUrl,
          toolsetId: payload.toolset.id,
          credentialsLevel: payload.authLevel,
        };

        const url = new URL(authSettings.authorizationEndpoint);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('client_id', authSettings.clientId as string);
        url.searchParams.set(
          'redirect_uri',
          `${router.basePath}${Routes.ToolsetSignIn}`,
        );
        url.searchParams.set(
          'code_challenge',
          authSettings.codeChallenge as string,
        );
        url.searchParams.set(
          'code_challenge_method',
          authSettings.codeChallengeMethod as string,
        );
        url.searchParams.set(
          'state',
          encodeURIComponent(JSON.stringify(state)),
        );

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

      return ToolsetService.signIn(data).pipe(
        switchMap(() =>
          refreshToolset$(
            getIdWithoutFeatureType(payload.toolsetId),
            router.pathname,
          ),
        ),
        catchError((err) => {
          console.error('Failed to sign in toolset', err);
          return of(
            UIActions.showErrorToast(translate('Failed to sign in toolset')),
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
  startSignInProcess,
  logInToolsetEpic,
  logOutToolsetEpic,
);
