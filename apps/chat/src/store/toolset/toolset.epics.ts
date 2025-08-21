import {
  EMPTY,
  Observable,
  catchError,
  concat,
  filter,
  forkJoin,
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
  regenerateToolsetId,
} from '@/src/utils/app/toolsets';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import { AppAction, AppEpic } from '@/src/types/store';
import { ToolsetModel } from '@/src/types/toolsets';

import { UIActions } from '@/src/store/actions';
import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { errorsMessages } from '@/src/constants/errors';
import { DeleteType } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';
import { ToolsetEditorQuery } from '@/src/constants/toolsets';

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
            switchMap(() => {
              if (shouldUpdateQuery) {
                void router.push({
                  query: {
                    [ToolsetEditorQuery.Id]: updatedToolset.reference,
                  },
                });
              }

              return of(
                ToolsetActions.updateToolsetSuccess({
                  oldToolset: payload.oldToolset,
                  newToolset: updatedToolset,
                }),
              );
            }),
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
          return of(ToolsetActions.updateInstalledToolsetsFail());
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

  //Bookmark
  getInstalledToolsetsEpic,
  getInstalledToolsetsFailEpic,
  removeFromInstalledToolsetsEpic,
  addInstalledToolsetsEpic,
);
