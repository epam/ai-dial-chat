import Router from 'next/router';

import {
  EMPTY,
  Observable,
  concat,
  concatMap,
  forkJoin,
  from,
  interval,
  mergeMap,
  of,
  takeUntil,
} from 'rxjs';
import {
  catchError,
  endWith,
  filter,
  ignoreElements,
  map,
  switchMap,
  take,
  tap,
} from 'rxjs/operators';

import { AnyAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import {
  isApplicationType,
  regenerateApplicationId,
} from '@/src/utils/app/application';
import { encode } from '@/src/utils/app/application-type-schema';
import { ApplicationService } from '@/src/utils/app/data/application-service';
import { DataService } from '@/src/utils/app/data/data-service';
import { isEntityIdExternal, isEntityIdLocal } from '@/src/utils/app/id';
import { translate } from '@/src/utils/app/translation';
import { parseApplicationApiKey } from '@/src/utils/server/api';

import {
  ApplicationStatus,
  CustomApplicationModel,
} from '@/src/types/applications';
import { AppEpic } from '@/src/types/store';

import { PublicationActions } from '@/src/store/publication/publication.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { errorsMessages } from '../../constants/errors';
import { DeleteType, MarketplaceTabs } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

import { ApplicationActions } from '../application/application.reducers';
import { ApplicationTypesSchemasActions } from '../applicationTypeSchemas/applicationTypeSchemas.reducer';
import { AuthSelectors } from '../auth/auth.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '../conversations/conversations.reducers';
import { ModelsActions, ModelsSelectors } from '../models/models.reducers';
import { ShareActions, ShareSelectors } from '../share/share.reducers';

const createApplicationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.create.match),
    switchMap(({ payload }) => {
      const { applicationData, slug, schema } = payload;
      if (!applicationData.version) {
        return EMPTY;
      }

      return ApplicationService.create(
        regenerateApplicationId({ ...applicationData, reference: '' }),
        schema,
      ).pipe(
        switchMap((application) =>
          ApplicationService.get(application.id).pipe(
            switchMap((application) => {
              if (application) {
                return concat(
                  of(
                    ModelsActions.addModels({
                      models: [application],
                    }),
                  ),
                  of(
                    ModelsActions.addInstalledModels({
                      references: [application.reference],
                    }),
                  ),
                  of(
                    ApplicationActions.createSuccess({
                      applicationData: application,
                    }),
                  ),
                );
              }

              return of(ApplicationActions.getFail());
            }),
          ),
        ),
        map((action) => {
          if (
            ModelsActions.addModels.match(action) &&
            action.payload.models?.[0]?.reference
          ) {
            Router.push({
              pathname: Routes.AppsEditorSettings,
              query: {
                slug,
                id: action.payload.models[0].reference,
                add: true,
              },
            });
          }
          return action;
        }),

        catchError((err) => {
          console.error('Failed to create application:', err);
          return of(ApplicationActions.createFail());
        }),
      );
    }),
  );

const createFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.createFail.match),
    switchMap(() =>
      of(UIActions.showErrorToast(translate(errorsMessages.createFailed))),
    ),
  );

const deleteApplicationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.delete.match),
    switchMap(({ payload: { id, reference } }) =>
      ApplicationService.delete(id).pipe(
        switchMap(() => {
          return concat(
            of(
              ModelsActions.removeInstalledModels({
                references: [reference],
                action: DeleteType.DELETE,
              }),
            ),
            of(ApplicationActions.deleteSuccess()),
          );
        }),
        catchError((err) => {
          console.error('Failed to delete application:', err);
          return of(ApplicationActions.deleteFail());
        }),
      ),
    ),
  );

const updateApplicationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ApplicationActions.update.match),
    switchMap(({ payload }) => {
      const initialActions$ = of(
        ApplicationActions.updateStart(),
        ApplicationActions.setShouldSaveApplication(false),
      );

      if (payload.applicationData.sharedWithMe) {
        return concat(
          initialActions$,
          of(
            ApplicationActions.edit({
              oldApplication: payload.oldApplication,
              updatedApplication: payload.applicationData,
              redirectUrl: payload.redirectUrl,
              schema: payload.schema,
            }),
          ),
        );
      }

      const updatedCustomApplication = regenerateApplicationId(
        payload.applicationData,
      ) as CustomApplicationModel;

      const isMoved = payload.oldApplication.id !== updatedCustomApplication.id;

      const move$ = isMoved
        ? DataService.getDataStorage()
            .move({
              sourceUrl: payload.oldApplication.id,
              destinationUrl: updatedCustomApplication.id,
              overwrite: false,
            })
            .pipe(
              map(() => ({ success: true as const })),
              catchError((err) => {
                console.error('Failed to move application:', err);
                return of({
                  success: false as const,
                  actions: [
                    ApplicationActions.updateFail({
                      oldApplication: payload.oldApplication,
                    }),
                    UIActions.showErrorToast(
                      translate('Failed to move application'),
                    ),
                  ],
                });
              }),
            )
        : of({ success: true as const });

      return concat(
        initialActions$,
        move$.pipe(
          switchMap((moveResult) => {
            if (!moveResult.success) {
              return of(...moveResult.actions);
            }

            return ApplicationService.edit(
              updatedCustomApplication,
              payload.schema,
            ).pipe(
              switchMap(() => {
                if (
                  payload.redirectUrl &&
                  !state$.value.application.exitAfterSave
                ) {
                  Router.push({
                    pathname: payload.redirectUrl,
                    query: { id: updatedCustomApplication.id },
                  });
                } else if (state$.value.application.exitAfterSave) {
                  Router.push({
                    pathname: Routes.Marketplace,
                    query: { tab: MarketplaceTabs.MY_WORKSPACE },
                  });
                }

                return of(
                  ApplicationActions.updateSuccess(updatedCustomApplication),
                  ModelsActions.updateModel({
                    model: updatedCustomApplication,
                    oldApplicationId: payload.oldApplication.id,
                  }),
                );
              }),
              catchError((err) => {
                console.error('Failed to update application:', err);
                return of(
                  ApplicationActions.updateFail({
                    oldApplication: payload.oldApplication,
                  }),
                  UIActions.showErrorToast(
                    translate('Failed to update application'),
                  ),
                );
              }),
              endWith(
                ApplicationActions.updateComplete(),
                ApplicationActions.setExitAfterSave(false),
              ),
            );
          }),
        ),
      );
    }),
  );

const editApplicationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ApplicationActions.edit.match),
    switchMap(({ payload }) => {
      if (!payload.updatedApplication.version) {
        return EMPTY;
      }

      return ApplicationService.edit(
        payload.updatedApplication,
        payload.schema,
      ).pipe(
        switchMap(() =>
          of(
            ApplicationActions.editSuccess(),
            ModelsActions.updateModel({
              model: payload.updatedApplication,
              oldApplicationId: payload.updatedApplication.id,
            }),
          ),
        ),
        tap(() => {
          if (payload.redirectUrl && !state$.value.application.exitAfterSave) {
            Router.push({
              pathname: payload.redirectUrl,
              query: { id: payload.updatedApplication.id },
            });
          }
          if (state$.value.application.exitAfterSave) {
            Router.push({
              pathname: Routes.Marketplace,
              query: { tab: MarketplaceTabs.MY_WORKSPACE },
            });
          }
        }),
        catchError((err) => {
          console.error('Failed to edit application:', err);
          return of(
            ApplicationActions.editFail({
              oldApplication: payload.oldApplication,
            }),
            UIActions.showErrorToast(translate('Failed to update application')),
          );
        }),
      );
    }),
  );

const getApplicationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ApplicationActions.get.match),
    switchMap(({ payload }) =>
      ApplicationService.get(payload.applicationId).pipe(
        switchMap((application) => {
          if (!application) {
            return of(ApplicationActions.getFail());
          }

          const modelsMap = ModelsSelectors.selectModelsMap(state$.value);
          const modelFromState = modelsMap[application.reference];

          const actions: Observable<AnyAction>[] = [];
          actions.push(
            of(
              ApplicationActions.getSuccess({
                ...application,
                sharedWithMe: modelFromState?.sharedWithMe,
                permissions: modelFromState?.permissions,
                isShared: modelFromState?.isShared,
              }),
            ),
          );

          if (payload.isForSharing) {
            const permissionsFromState = ShareSelectors.selectSharePermissions(
              state$.value,
            );
            actions.push(
              of(
                ShareActions.shareApplication({
                  resourceId: application.id,
                  permissions: permissionsFromState,
                }),
              ),
            );
          }

          return concat(...actions);
        }),
        catchError(() => {
          Router.push('/404');
          return of(ApplicationActions.getFail());
        }),
      ),
    ),
  );

const updateApplicationStatusEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.startUpdatingFunctionStatus.match),
    mergeMap(({ payload }) => {
      let request;
      switch (payload.status) {
        case ApplicationStatus.DEPLOYING:
          request = ApplicationService.deploy;
          break;
        case ApplicationStatus.REDEPLOYING:
          request = ApplicationService.redeploy;
          break;
        default:
          request = ApplicationService.undeploy;
      }
      return request(payload.id).pipe(
        switchMap(() =>
          concat(
            of(
              ApplicationActions.updateFunctionStatus({
                id: payload.id,
                status: payload.status,
              }),
            ),
            of(
              ModelsActions.updateFunctionStatus({
                id: payload.id,
                status: payload.status,
              }),
            ),
            of(
              ApplicationActions.continueUpdatingFunctionStatus({
                id: payload.id,
                status: payload.status,
              }),
            ),
          ),
        ),
        catchError(() =>
          of(
            ApplicationActions.updateFunctionStatusFail({
              id: payload.id,
              status: payload.status,
            }),
          ),
        ),
      );
    }),
  );

const continueUpdatingApplicationStatusEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.continueUpdatingFunctionStatus.match),
    mergeMap(({ payload }) =>
      interval(5000).pipe(
        concatMap(() =>
          from(ApplicationService.get(payload.id)).pipe(
            concatMap((application) => {
              if (
                !application ||
                application?.function?.status === ApplicationStatus.FAILED
              ) {
                return of(
                  ApplicationActions.updateFunctionStatusFail({
                    id: payload.id,
                    status: payload.status,
                  }),
                );
              }

              if (
                application.function?.status === ApplicationStatus.DEPLOYED ||
                application.function?.status === ApplicationStatus.UNDEPLOYED
              ) {
                return concat(
                  of(
                    ModelsActions.updateFunctionStatus({
                      id: payload.id,
                      status: application.function.status,
                    }),
                  ),
                  of(
                    ApplicationActions.updateFunctionStatus({
                      id: payload.id,
                      status: application.function.status,
                    }),
                  ),
                );
              }

              return EMPTY;
            }),
            catchError(() =>
              of(
                ApplicationActions.updateFunctionStatusFail({
                  id: payload.id,
                  status: payload.status,
                }),
              ),
            ),
          ),
        ),
        takeUntil(
          action$.pipe(
            filter(
              (action) =>
                (ApplicationActions.updateFunctionStatusFail.match(action) ||
                  (ApplicationActions.updateFunctionStatus.match(action) &&
                    (action.payload.status === ApplicationStatus.DEPLOYED ||
                      action.payload.status ===
                        ApplicationStatus.UNDEPLOYED))) &&
                payload.id === action.payload.id,
            ),
          ),
        ),
      ),
    ),
  );

const updateApplicationStatusSuccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        ApplicationActions.updateFunctionStatus.match(action) &&
        (action.payload.status === ApplicationStatus.DEPLOYED ||
          action.payload.status === ApplicationStatus.UNDEPLOYED),
    ),
    switchMap(({ payload }) => {
      const { name } = parseApplicationApiKey(payload.id);
      const isAdmin = AuthSelectors.selectIsAdmin(state$.value);

      return isAdmin || !isEntityIdExternal(payload)
        ? of(
            UIActions.showSuccessToast(
              `Application: ${name.split('/').pop()} was successfully ${payload.status.toLowerCase()}`,
            ),
          )
        : EMPTY;
    }),
  );

const updateApplicationStatusFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.updateFunctionStatusFail.match),
    mergeMap(({ payload }) => {
      const { name } = parseApplicationApiKey(payload.id);

      return concat(
        of(
          ModelsActions.updateFunctionStatus({
            id: payload.id,
            status: ApplicationStatus.FAILED,
          }),
        ),
        of(
          ApplicationActions.updateFunctionStatus({
            id: payload.id,
            status: ApplicationStatus.FAILED,
          }),
        ),
        of(
          UIActions.showErrorToast(
            `Application: ${name.split('/').pop()} ${payload.status.toLowerCase()} failed`,
          ),
        ),
      );
    }),
  );

const getApplicationLogsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.getLogs.match),
    switchMap(({ payload }) =>
      ApplicationService.getLogs(payload).pipe(
        map((logs) => {
          return ApplicationActions.getLogsSuccess(logs);
        }),
        catchError((err) => {
          console.error('Failed to get application:', err);
          return of(ApplicationActions.getLogsFail());
        }),
      ),
    ),
  );

const enterEditModeEpic: AppEpic = (action$, state$, { router }) =>
  action$.pipe(
    filter(ApplicationActions.enterEditMode.match),
    switchMap(({ payload }) => {
      const { entity, applicationType, detailedApplicationTypeSchemaId } =
        payload;

      const selectedConversationIds =
        ConversationsSelectors.selectSelectedConversationsIds(state$.value);

      const initialActions$ = of(
        ApplicationActions.setShouldSaveApplication(false),
        ApplicationActions.setExitAfterSave(false),
        ApplicationActions.setReturnConversationIds(
          selectedConversationIds.filter((id) => !isEntityIdLocal({ id })),
        ),
      );

      const actions: AnyAction[] = [
        ApplicationActions.get({ applicationId: entity.id }),
      ];

      const needSchema =
        !isApplicationType(applicationType) &&
        detailedApplicationTypeSchemaId !== applicationType;

      if (needSchema) {
        actions.push(
          ApplicationTypesSchemasActions.fetchDetailedApplicationTypeSchema(
            applicationType,
          ),
        );
      } else if (isApplicationType(applicationType)) {
        actions.push(
          ApplicationTypesSchemasActions.resetDetailedApplicationTypeSchema(),
        );
      }

      const dispatchActions$ = concat(...actions.map((action) => of(action)));

      const waitForAppLoad$ = action$.pipe(
        filter(ApplicationActions.getSuccess.match),
        take(1),
      );

      const waitForSchema$ = needSchema
        ? action$.pipe(
            filter(
              ApplicationTypesSchemasActions
                .fetchDetailedApplicationTypeSchemaSuccess.match,
            ),
            take(1),
          )
        : of(null);

      const waitForData$ = forkJoin({
        app: waitForAppLoad$,
        schema: waitForSchema$,
      }).pipe(
        tap(() => {
          ConversationsActions.setTalkToConversationId(null);
          router.push({
            pathname: Routes.AppsEditorSettings,
            query: {
              id: encodeURIComponent(entity.reference),
              slug: isApplicationType(applicationType)
                ? applicationType
                : encode(applicationType ?? ''),
            },
          });
        }),
        map(() => ApplicationActions.enterEditModeComplete()),
      );

      return concat(initialActions$, dispatchActions$, waitForData$).pipe(
        catchError((err) => {
          console.error('Failed to enter edit mode:', err);
          return of(
            UIActions.showErrorToast(translate('Failed to enter edit mode')),
          );
        }),
      );
    }),
  );

const exitEditModeEpic: AppEpic = (action$, _state$, { router }) =>
  action$.pipe(
    filter(ApplicationActions.exitEditor.match),
    tap(({ payload }) => {
      if (payload.redirectUrl) {
        router.push({
          pathname: payload.redirectUrl,
        });
      } else {
        router.push({
          pathname: Routes.Marketplace,
          query: { tab: MarketplaceTabs.MY_WORKSPACE },
        });
      }
    }),
    ignoreElements(),
  );

const resetSelectedWidgetEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(
      (action) =>
        ConversationsActions.selectConversations.match(action) ||
        PublicationActions.selectPublication.match(action),
    ),
    switchMap(({ payload }) => {
      if (
        typeof payload !== 'string' && payload
          ? !!payload.conversationIds?.length
          : true
      ) {
        return of(ApplicationActions.selectWidget(undefined));
      }
      return EMPTY;
    }),
  );

export const ApplicationEpics = combineEpics(
  createApplicationEpic,
  createFailEpic,
  deleteApplicationEpic,
  updateApplicationEpic,
  editApplicationEpic,
  getApplicationEpic,
  updateApplicationStatusEpic,
  continueUpdatingApplicationStatusEpic,
  updateApplicationStatusSuccessEpic,
  updateApplicationStatusFailEpic,
  getApplicationLogsEpic,
  enterEditModeEpic,
  exitEditModeEpic,
  resetSelectedWidgetEpic,
);
