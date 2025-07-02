import Router from 'next/router';

import {
  EMPTY,
  Observable,
  concat,
  concatMap,
  forkJoin,
  from,
  iif,
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

import { combineEpics, ofType } from 'redux-observable';

import {
  isApplicationType,
  regenerateApplicationId,
} from '@/src/utils/app/application';
import { cleanSchemaId } from '@/src/utils/app/application-type-schema';
import { getLastPathSegment } from '@/src/utils/app/common';
import { ApplicationService } from '@/src/utils/app/data/application-service';
import { DataService } from '@/src/utils/app/data/data-service';
import { BrowserStorage } from '@/src/utils/app/data/storages/browser-storage';
import { isEntityIdExternal, isEntityIdLocal } from '@/src/utils/app/id';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import { translate } from '@/src/utils/app/translation';
import { parseApplicationApiKey } from '@/src/utils/server/api';

import {
  ApplicationStatus,
  CustomApplicationModel,
} from '@/src/types/applications';
import { AppAction, AppEpic } from '@/src/types/store';

import {
  ApplicationActions,
  ApplicationTypesSchemasActions,
  ConversationsActions,
  ModelsActions,
  PublicationActions,
  ShareActions,
  UIActions,
} from '@/src/store/actions';
import {
  ApplicationSelectors,
  AuthSelectors,
  ConversationsSelectors,
  ModelsSelectors,
  PublicationSelectors,
  ShareSelectors,
} from '@/src/store/selectors';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { errorsMessages } from '@/src/constants/errors';
import { DeleteType, MarketplaceTabs } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ApplicationActions.init.type),
    filter(() => !ApplicationSelectors.selectInitialized(state$.value)),
    switchMap(() =>
      forkJoin({
        selectedWidget: BrowserStorage.getSelectedWidget(),
      }).pipe(
        switchMap(({ selectedWidget }) =>
          concat(
            iif(
              () => !!selectedWidget,
              of(
                ApplicationActions.setSelectedWidget(selectedWidget as string),
              ),
              EMPTY,
            ),
            of(ApplicationActions.initFinish()),
          ),
        ),
      ),
    ),
  );

const createApplicationEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ApplicationActions.create.type),
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
    ofType(ApplicationActions.createFail.type),
    switchMap(() =>
      of(UIActions.showErrorToast(translate(errorsMessages.createFailed))),
    ),
  );

const deleteApplicationEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ApplicationActions.delete.type),
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
    ofType(ApplicationActions.update.type),
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

      if (isMoved && payload.publicationUrl) {
        return of(
          ApplicationActions.updateApplicationPublicationUrls({
            publicationUrl: payload.publicationUrl,
            oldApplicationId: payload.oldApplication.id,
            newApplicationId: updatedCustomApplication.id,
          }),
        );
      }

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

const updateApplicationPublicationUrlsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ApplicationActions.updateApplicationPublicationUrls.type),
    switchMap(({ payload }) => {
      const publication = PublicationSelectors.selectPublicationByUrl(
        state$.value,
        payload.publicationUrl as string,
      );
      if (!publication || !publication?.resources) {
        return EMPTY;
      }
      const { name } = splitEntityId(payload.newApplicationId);

      return of(
        PublicationActions.updatePublicationRequest({
          url: publication.url,
          dataToUpdate: {
            targetFolder: publication.targetFolder,
            resources: publication.resources.map((resource) => ({
              action: resource.action,
              sourceUrl: resource.sourceUrl ?? '',
              targetUrl:
                resource.reviewUrl === payload.oldApplicationId
                  ? resource.targetUrl
                      .split('/')
                      .slice(0, -1)
                      .concat(name)
                      .join('/')
                  : resource.targetUrl,
            })),
          },
        }),
      );
    }),
  );

const editApplicationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ApplicationActions.edit.type),
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
    ofType(ApplicationActions.get.type),
    switchMap(({ payload }) =>
      ApplicationService.get(payload.applicationId).pipe(
        switchMap((application) => {
          if (!application) {
            return of(ApplicationActions.getFail());
          }

          const actions: Observable<AppAction>[] = [];

          const modelsMap = ModelsSelectors.selectModelsMap(state$.value);
          const modelFromState = modelsMap[application.reference];

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

          if (!modelFromState) {
            actions.push(of(ModelsActions.addModelToMap(application)));
          }

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
          Router.push(Routes.NotFound);
          return of(ApplicationActions.getFail());
        }),
      ),
    ),
  );

const updateApplicationStatusEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ApplicationActions.startUpdatingFunctionStatus.type),
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
    ofType(ApplicationActions.continueUpdatingFunctionStatus.type),
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
                    [
                      ApplicationStatus.DEPLOYED,
                      ApplicationStatus.UNDEPLOYED,
                    ].includes(action.payload.status))) &&
                payload.id === action.payload.id,
            ),
          ),
        ),
      ),
    ),
  );

const updateApplicationStatusSuccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ApplicationActions.updateFunctionStatus.type),
    filter(({ payload }) =>
      [ApplicationStatus.DEPLOYED, ApplicationStatus.UNDEPLOYED].includes(
        payload.status,
      ),
    ),
    switchMap(({ payload }) => {
      const { name } = parseApplicationApiKey(payload.id);
      const isAdmin = AuthSelectors.selectIsAdmin(state$.value);

      return isAdmin || !isEntityIdExternal(payload)
        ? of(
            UIActions.showSuccessToast(
              `Application: ${getLastPathSegment(name)} was successfully ${payload.status.toLowerCase()}`,
            ),
          )
        : EMPTY;
    }),
  );

const updateApplicationStatusFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ApplicationActions.updateFunctionStatusFail.type),
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
            `Application: ${getLastPathSegment(name)} ${payload.status.toLowerCase()} failed`,
          ),
        ),
      );
    }),
  );

const getApplicationLogsEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ApplicationActions.getLogs.type),
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
    ofType(ApplicationActions.enterEditMode.type),
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

      const actions: AppAction[] = [
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
        ofType(ApplicationActions.getSuccess.type),
        take(1),
      );

      const waitForSchema$ = needSchema
        ? action$.pipe(
            ofType(
              ApplicationTypesSchemasActions
                .fetchDetailedApplicationTypeSchemaSuccess.type,
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
              slug: cleanSchemaId(applicationType),
              publicationUrl: payload.publicationUrl,
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

const exitEditModeEpic: AppEpic = (action$, state$, { router }) =>
  action$.pipe(
    ofType(ApplicationActions.exitEditor.type),
    switchMap(({ payload }) => {
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
      const returnConversationIds =
        ApplicationSelectors.selectReturnConversationIds(state$.value);
      if (returnConversationIds?.length) {
        return concat(
          of(
            ConversationsActions.selectConversations({
              conversationIds: returnConversationIds,
            }),
          ),
          of(ApplicationActions.setReturnConversationIds(undefined)),
        );
      }
      return of(
        ConversationsActions.createNewConversations({
          names: [DEFAULT_CONVERSATION_NAME],
        }),
      );
    }),
  );

const setSelectedWidgetEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ApplicationActions.setSelectedWidget.type),
    tap(({ payload }) => BrowserStorage.setSelectedWidget(payload)),
    ignoreElements(),
  );

export const ApplicationEpics = combineEpics(
  initEpic,
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
  setSelectedWidgetEpic,
  updateApplicationPublicationUrlsEpic,
);
