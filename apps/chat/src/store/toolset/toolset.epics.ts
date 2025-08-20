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
            of(ToolsetActions.getBookmarkedToolsets()),
          ),
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
                    of(
                      ToolsetActions.addBookmarkedToolsets({
                        references: [toolset.reference],
                      }),
                    ),
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

const getBookmarkedToolsetsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ToolsetActions.getBookmarkedToolsets.type),
    switchMap(() => {
      const allToolsets = ToolsetSelectors.selectToolsets(state$.value);

      const myToolsetsReferences = allToolsets
        .filter((toolset) => isMyEntity(toolset) || toolset.sharedWithMe)
        .map((myToolset) => myToolset.reference);

      return ClientDataService.getBookmarkedToolsets().pipe(
        switchMap((bookmarkedToolsets) => {
          if (!bookmarkedToolsets) {
            return of(
              ToolsetActions.getBookmarkedToolsetsFail(myToolsetsReferences),
            );
          }

          const actions: Observable<AppAction>[] = [];

          const bookmarkedToolsetsSet = new Set(bookmarkedToolsets);

          const references = [...bookmarkedToolsets, ...myToolsetsReferences];

          const toolsetsToInstall = references.filter(
            (reference) => !bookmarkedToolsetsSet.has(reference),
          );

          if (toolsetsToInstall.length) {
            actions.push(
              of(
                ToolsetActions.addBookmarkedToolsets({
                  references: toolsetsToInstall,
                }),
              ),
            );
          }

          return concat(
            of(ToolsetActions.getBookmarkedToolsetsSuccess(bookmarkedToolsets)),
            ...actions,
          );
        }),

        catchError((error) => {
          if (error?.message && error?.message.endsWith('Not Found')) {
            return of(
              ToolsetActions.getBookmarkedToolsetsFail(myToolsetsReferences),
            );
          }

          return EMPTY;
        }),
      );
    }),
  );

const getBookmarkedToolsetsFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.getBookmarkedToolsetsFail.type),
    switchMap(({ payload: myToolsetsIds }) => {
      return of(
        ToolsetActions.addBookmarkedToolsets({
          references: myToolsetsIds,
        }),
      );
    }),
  );

const removeFromBookmarkedToolsetsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ToolsetActions.removeBookmarkedToolsets.type),
    switchMap(({ payload }) => {
      const stateValue = state$.value;
      const bookmarkedToolsets =
        ToolsetSelectors.selectBookmarkedToolsets(stateValue);

      //TODO change to check by 'public group keys' when toolsets publication will be ready

      const deletedToolsetsSet = new Set(payload.references);
      const newBookmarkedToolsets = bookmarkedToolsets.filter(
        (toolset) => !deletedToolsetsSet.has(toolset),
      );

      return ClientDataService.saveBookmarkedToolsets(
        newBookmarkedToolsets,
      ).pipe(
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
              ToolsetActions.getBookmarkedToolsetsSuccess(
                newBookmarkedToolsets,
              ),
            ),
            of(
              ToolsetActions.updateBookmarkedToolsetsSuccess({
                bookmarkedToolsets: newBookmarkedToolsets,
              }),
            ),
          );
        }),
        catchError((err) => {
          console.error(err);
          return of(ToolsetActions.updateBookmarkedToolsetsFail());
        }),
      );
    }),
  );

const addBookmarkedToolsetsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ToolsetActions.addBookmarkedToolsets.type),
    switchMap(({ payload }) => {
      const stateValue = state$.value;
      const bookmarkedToolsets =
        ToolsetSelectors.selectBookmarkedToolsets(stateValue);

      const newBookmarkedToolsets = uniq([
        ...bookmarkedToolsets,
        ...payload.references,
      ]);

      return ClientDataService.saveBookmarkedToolsets(
        newBookmarkedToolsets,
      ).pipe(
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
              ToolsetActions.getBookmarkedToolsetsSuccess(
                newBookmarkedToolsets,
              ),
            ),
            of(
              ToolsetActions.updateBookmarkedToolsetsSuccess({
                bookmarkedToolsets: newBookmarkedToolsets,
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
  getBookmarkedToolsetsEpic,
  getBookmarkedToolsetsFailEpic,
  removeFromBookmarkedToolsetsEpic,
  addBookmarkedToolsetsEpic,
);
