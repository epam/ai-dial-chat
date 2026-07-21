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
  fitApplicationNameToStorageLimits,
  isApplicationType,
  regenerateApplicationId,
} from '@/src/utils/app/application';
import { cleanSchemaId } from '@/src/utils/app/application-type-schema';
import { getLastPathSegment, getSafeRedirectUrl } from '@/src/utils/app/common';
import { ApplicationService } from '@/src/utils/app/data/application-service';
import { DataService } from '@/src/utils/app/data/data-service';
import { BrowserStorage } from '@/src/utils/app/data/storages/browser-storage';
import { navigateAndThen } from '@/src/utils/app/epics-helpers/application.epic-helpers';
import { parseApiError } from '@/src/utils/app/epics-helpers/common.epic-helpers';
import {
  getFileMovesFromResult,
  updatePathOnMove,
} from '@/src/utils/app/folders';
import {
  isEntityIdExternal,
  isEntityIdLocal,
  isMyApplication,
  isMyEntity,
} from '@/src/utils/app/id';
import { isMarketplaceEditorStep } from '@/src/utils/app/marketplace';
import { mergeFeatures } from '@/src/utils/app/models';
import { translateErrorMessage } from '@/src/utils/app/translateErrorMessage';
import { translate } from '@/src/utils/app/translation';
import { parseEntityApiKey } from '@/src/utils/server/api';

import { ApplicationTypeSchemaProperties } from '@/src/types/application-type-schema';
import {
  ApplicationStatus,
  CustomApplicationModel,
} from '@/src/types/applications';
import { MarketplaceEditorSteps } from '@/src/types/marketplace';
import { DialAIEntityFeatures } from '@/src/types/models';
import { AppAction, AppEpic } from '@/src/types/store';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationTypesSchemasActions,
  ChatActions,
  ConversationsActions,
  FilesActions,
  MarketplaceActions,
  ModelsActions,
  PromptsActions,
  PublicationActions,
  ShareActions,
  UIActions,
} from '@/src/store/actions';
import {
  ApplicationSelectors,
  ApplicationTypesSchemasSelectors,
  AuthSelectors,
  ConversationsSelectors,
  ModelsSelectors,
  ShareSelectors,
} from '@/src/store/selectors';

import { AppsEditorQuery } from '@/src/constants/applications';
import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { errorsMessages } from '@/src/constants/errors';
import { CommonI18nKeys, MarketplaceI18nKeys } from '@/src/constants/i18n';
import {
  DeleteType,
  MarketplaceEntitiesTabs,
  MarketplaceQueryParams,
  MarketplaceTabs,
} from '@/src/constants/marketplace';
import { DEFAULT_QUICK_APPS_SCHEMA_2_ID } from '@/src/constants/quick-apps';
import { Routes } from '@/src/constants/routes';

import { parse } from 'querystring';

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
      const { applicationData, schema } = payload;
      if (!applicationData.version) {
        return EMPTY;
      }

      return ApplicationService.create(
        regenerateApplicationId(
          fitApplicationNameToStorageLimits({
            ...applicationData,
            reference: '',
          }),
        ),
        schema,
      ).pipe(
        switchMap((application) =>
          forkJoin({
            retrievedApplication: ApplicationService.get(application.id),
            dialEntity: ApplicationService.getDialEntity(application.id),
          }).pipe(
            switchMap(({ retrievedApplication, dialEntity }) => {
              if (retrievedApplication) {
                const featuresRecord = {
                  ...(dialEntity?.features ??
                    retrievedApplication.features ??
                    {}),
                  ...(!!retrievedApplication.function && {
                    chat_completion: true,
                  }),
                };

                const modelData = {
                  ...retrievedApplication,
                  features: mergeFeatures(featuresRecord),
                };
                return concat(
                  of(
                    ApplicationActions.setEditorStep(
                      MarketplaceEditorSteps.Settings,
                    ),
                  ),
                  of(
                    ModelsActions.addModels({
                      models: [modelData],
                    }),
                  ),
                  of(
                    ModelsActions.addInstalledModels({
                      references: [retrievedApplication.reference],
                    }),
                  ),
                  of(
                    ApplicationActions.createSuccess({
                      applicationData: retrievedApplication,
                    }),
                  ),
                );
              }

              return of(ApplicationActions.getFail());
            }),
          ),
        ),
        map((action) => {
          return action;
        }),

        catchError((err) => {
          console.error('Failed to create application:', err);

          return concat(
            of(ApplicationActions.createFail()),
            iif(
              () => err.status === 412,
              of(
                UIActions.showErrorToast({
                  message: translate(
                    CommonI18nKeys.ApplicationNameVersionAlreadyExists,
                    {
                      ns: Translation.Common,
                    },
                  ),
                }),
              ),
              EMPTY,
            ),
          );
        }),
      );
    }),
  );

const createFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ApplicationActions.createFail.type),
    switchMap(() =>
      of(
        UIActions.showErrorToast({
          message: translateErrorMessage(errorsMessages.createFailed, {
            entity: 'application',
          }),
        }),
      ),
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
      const initialActions$ = of(ApplicationActions.updateStart());

      if (payload.applicationData.sharedWithMe) {
        return concat(
          initialActions$,
          of(
            ApplicationActions.edit({
              oldApplication: payload.oldApplication,
              updatedApplication: payload.applicationData,
              redirectUrl: payload.redirectUrl?.toString(),
              schema: payload.schema,
            }),
          ),
        );
      }

      const updatedCustomApplication = regenerateApplicationId(
        fitApplicationNameToStorageLimits(payload.applicationData),
      ) as CustomApplicationModel;

      const isMoved = payload.oldApplication.id !== updatedCustomApplication.id;

      if (payload.publicationUrl) {
        const payloadToUpdatePublication = {
          isSaveAndExit: !!payload.isSaveAndExit,
          publicationUrl: payload.publicationUrl,
          oldApplication: payload.oldApplication,
          newApplication: updatedCustomApplication,
          tabToOpen: payload.tabToOpen,
        };

        if (isMoved) {
          return concat(
            initialActions$,
            of(
              PublicationActions.updateApplicationPublicationUrls(
                payloadToUpdatePublication,
              ),
            ),
          );
        } else if (
          updatedCustomApplication.iconUrl &&
          isMyEntity({ id: updatedCustomApplication.iconUrl })
        ) {
          return concat(
            initialActions$,
            of(
              PublicationActions.updatePublicationRequestAndApplicationIcon(
                payloadToUpdatePublication,
              ),
            ),
          );
        }
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
                const failActions = [
                  ApplicationActions.updateFail({
                    oldApplication: payload.oldApplication,
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
                          CommonI18nKeys.ApplicationNameVersionAlreadyExists,
                          {
                            ns: Translation.Common,
                          },
                        ),
                      }),
                    ],
                  });
                }
                console.error('Failed to move application:', err);
                return of({
                  success: false as const,
                  actions: [
                    ...failActions,
                    UIActions.showErrorToast({
                      traceId,
                      message: translate(
                        CommonI18nKeys.FailedToMoveApplication,
                        {
                          ns: Translation.Common,
                        },
                      ),
                    }),
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
                const modelsMap = ModelsSelectors.selectModelsMap(state$.value);
                const model = modelsMap[updatedCustomApplication.id];
                const featuresRecord =
                  model?.features ?? updatedCustomApplication.features ?? {};

                const modelData = {
                  ...updatedCustomApplication,
                  features: mergeFeatures(featuresRecord),
                };

                const actions: Observable<AppAction>[] = [
                  of(
                    ModelsActions.updateModel({
                      model: modelData,
                      oldApplicationId: payload.oldApplication.id,
                    }),
                  ),
                  of(
                    ApplicationActions.updateSuccess({
                      appDetails: updatedCustomApplication,
                      isExitingAfterSave: payload.isSaveAndExit,
                    }),
                  ),
                  of(ApplicationActions.setEditorError()),
                ];

                if (payload.isSaveAndExit) {
                  actions.push(
                    of(
                      ApplicationActions.exitEditor({
                        redirectUrl: payload.redirectUrl,
                        shouldSelectApplication:
                          payload.shouldSelectApplication,
                      }),
                    ),
                  );
                } else {
                  if (payload.tabToOpen) {
                    actions.push(
                      of(ApplicationActions.setEditorStep(payload.tabToOpen!)),
                    );
                  }
                }

                const schemaId =
                  updatedCustomApplication.applicationTypeSchemaId;
                if (schemaId && schemaId === DEFAULT_QUICK_APPS_SCHEMA_2_ID) {
                  actions.push(
                    of(
                      ChatActions.getConfigurationSchema({
                        modelId: updatedCustomApplication.id,
                        replaceExisting: true,
                      }),
                    ),
                  );
                }

                return concat(...actions);
              }),
              catchError((err) => {
                console.error('Failed to update application:', err);
                return concat(
                  of(
                    ApplicationActions.updateFail({
                      oldApplication: payload.oldApplication,
                    }),
                  ),
                  of(
                    UIActions.showErrorToast({
                      message: translate(
                        CommonI18nKeys.FailedToUpdateApplication,
                        {
                          ns: Translation.Common,
                        },
                      ),
                    }),
                  ),
                  iif(
                    () => !!payload.shouldSetEditorError,
                    of(
                      ApplicationActions.setEditorError(
                        err.message ??
                          translate(
                            MarketplaceI18nKeys.AppSettingsNotMatchingSchema,
                            {
                              ns: Translation.Marketplace,
                            },
                          ),
                      ),
                    ),
                    EMPTY,
                  ),
                  of(UIActions.setEditorLoader(false)),
                );
              }),
              endWith(ApplicationActions.updateComplete()),
            );
          }),
        ),
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
        switchMap(() => {
          const modelsMap = ModelsSelectors.selectModelsMap(state$.value);
          const model = modelsMap[payload.updatedApplication.id];
          const featuresRecord =
            model?.features ?? payload.updatedApplication.features ?? {};

          const modelData = {
            ...payload.updatedApplication,
            features: mergeFeatures(featuresRecord),
          };

          const actions: Observable<AppAction>[] = [
            of(
              ApplicationActions.editSuccess(),
              ModelsActions.updateModel({
                model: modelData,
                oldApplicationId: payload.updatedApplication.id,
              }),
            ),
          ];

          const schemaId = payload.updatedApplication.applicationTypeSchemaId;
          if (schemaId && schemaId === DEFAULT_QUICK_APPS_SCHEMA_2_ID) {
            actions.push(
              of(
                ChatActions.getConfigurationSchema({
                  modelId: payload.updatedApplication.id,
                  replaceExisting: true,
                }),
              ),
            );
          }

          return concat(...actions);
        }),
        tap(() => {
          if (payload.redirectUrl) {
            Router.push({
              pathname: payload.redirectUrl,
              query: { id: payload.updatedApplication.id },
            });
          }
        }),
        catchError((err) => {
          console.error('Failed to edit application:', err);
          return of(
            ApplicationActions.editFail({
              oldApplication: payload.oldApplication,
            }),
            UIActions.showErrorToast({
              message: translate(CommonI18nKeys.FailedToUpdateApplication, {
                ns: Translation.Common,
              }),
            }),
          );
        }),
      );
    }),
  );

const getApplicationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ApplicationActions.get.type),
    switchMap(({ payload }) =>
      forkJoin({
        application: ApplicationService.get(payload.applicationId),
        dialEntity: payload.acceptSharePermissions?.length
          ? ApplicationService.getDialEntity(payload.applicationId)
          : of(null),
      }).pipe(
        switchMap(({ application, dialEntity }) => {
          if (!application) {
            return of(ApplicationActions.getFail());
          }

          const actions: Observable<AppAction>[] = [];

          const modelsMap = ModelsSelectors.selectModelsMap(state$.value);
          const modelFromState = modelsMap[application.reference];

          const acceptSharedWithMe = payload.acceptSharePermissions?.length
            ? true
            : undefined;

          const successAction = acceptSharedWithMe
            ? ApplicationActions.setAppDetails() // Avoid to set app details on accepting share. We need them only for the editor.
            : ApplicationActions.getSuccess({
                ...application,
                sharedWithMe: modelFromState?.sharedWithMe,
                permissions: modelFromState?.permissions,
                isShared: modelFromState?.isShared,
              });

          actions.push(of(successAction));

          if (!modelFromState || acceptSharedWithMe) {
            const isQuickApp2 =
              application.applicationTypeSchemaId ===
              DEFAULT_QUICK_APPS_SCHEMA_2_ID;
            const featuresRecord = {
              ...(dialEntity?.features ?? application.features ?? {}),
            };
            const updatedModel = {
              ...application,
              features: {
                ...mergeFeatures(featuresRecord),
                ...(isQuickApp2 && { configuration: true }),
              } as DialAIEntityFeatures,
              sharedWithMe: acceptSharedWithMe ?? modelFromState?.sharedWithMe,
              permissions:
                payload.acceptSharePermissions ?? modelFromState?.permissions,
            };

            const refreshModelAction = modelFromState
              ? ModelsActions.updateModel({
                  model: updatedModel,
                  oldApplicationId: modelFromState.reference,
                })
              : ModelsActions.addModels({ models: [updatedModel] });

            actions.push(of(refreshModelAction));
          }

          if (payload.acceptSharePermissions) {
            actions.push(
              of(
                ModelsActions.addInstalledModels({
                  references: [application.reference],
                }),
              ),
              of(ShareActions.triggerGettingSharedApplicationsListings()),
            );
          }

          if (payload.showCard) {
            actions.push(
              of(
                MarketplaceActions.setDetailsEntity({
                  reference: application.reference,
                  type: MarketplaceEntitiesTabs.AGENTS,
                  isSuggested: false,
                }),
              ),
            );
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
          console.error(
            'NotFound',
            `Application is not found: ${payload.applicationId}`,
          );
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
        catchError((err) =>
          of(
            ApplicationActions.updateFunctionStatusFail({
              id: payload.id,
              status: payload.status,
              ...parseApiError(err),
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
                application.function?.status === ApplicationStatus.REDEPLOYED ||
                application.function?.status === ApplicationStatus.UNDEPLOYED
              ) {
                const status =
                  payload.status === ApplicationStatus.REDEPLOYING &&
                  application.function.status === ApplicationStatus.DEPLOYED
                    ? ApplicationStatus.REDEPLOYED
                    : application.function.status;

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
                      status,
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
                      ApplicationStatus.REDEPLOYED,
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
      [
        ApplicationStatus.DEPLOYED,
        ApplicationStatus.REDEPLOYED,
        ApplicationStatus.UNDEPLOYED,
      ].includes(payload.status),
    ),
    switchMap(({ payload }) => {
      const { name } = parseEntityApiKey(payload.id, { parseVersion: true });
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
      const { name } = parseEntityApiKey(payload.id, { parseVersion: true });

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
          UIActions.showErrorToast({
            traceId: payload?.traceId,
            message: `Application: ${getLastPathSegment(name)} ${payload.status.toLowerCase().replace(/ing$/, '')} failed`,
          }),
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
          return of(ApplicationActions.getLogsFail(parseApiError(err)));
        }),
      ),
    ),
  );

const enterEditModeEpic: AppEpic = (action$, state$, { router }) =>
  action$.pipe(
    ofType(ApplicationActions.enterEditMode.type),
    switchMap(({ payload }) => {
      const { entity, applicationType } = payload;

      const selectedConversationIds =
        ConversationsSelectors.selectSelectedConversationsIds(state$.value);

      const initialAction$ = of(
        ApplicationActions.setReturnConversationIds(
          selectedConversationIds.filter((id) => !isEntityIdLocal({ id })),
        ),
      );

      const actions: AppAction[] = [
        ApplicationActions.get({ applicationId: entity.id }),
      ];

      const needSchema = !isApplicationType(applicationType);

      if (needSchema) {
        actions.push(
          ApplicationTypesSchemasActions.fetchDetailedApplicationTypeSchema(
            applicationType,
          ),
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
            pathname: Routes.AppsEditor,
            query: {
              [AppsEditorQuery.Id]: encodeURIComponent(entity.reference),
              [AppsEditorQuery.Schema]: encodeURIComponent(
                cleanSchemaId(applicationType),
              ),
              [AppsEditorQuery.PublicationUrl]: payload.publicationUrl,
              [AppsEditorQuery.Step]: MarketplaceEditorSteps.Settings,
              [AppsEditorQuery.ReturnUrl]:
                window.location.pathname + window.location.search,
            },
          });
        }),
        map(() => ApplicationActions.enterEditModeComplete()),
      );

      return concat(initialAction$, dispatchActions$, waitForData$).pipe(
        catchError((err) => {
          console.error('Failed to enter edit mode:', err);
          return of(
            UIActions.showErrorToast({
              message: translate(CommonI18nKeys.FailedToEnterEditMode, {
                ns: Translation.Common,
              }),
            }),
          );
        }),
      );
    }),
  );

const exitEditModeEpic: AppEpic = (action$, state$, { router }) =>
  action$.pipe(
    ofType(ApplicationActions.exitEditor.type),
    switchMap(({ payload }) => {
      const returnConversationIds =
        ApplicationSelectors.selectReturnConversationIds(state$.value);
      const schema =
        ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema(
          state$.value,
        );
      const hasCustomEditor =
        !!schema?.[ApplicationTypeSchemaProperties.applicationTypeEditorUrl];

      const query = parse(window.location.search.slice(1));
      const publicationUrl = query[AppsEditorQuery.PublicationUrl]?.toString();
      const returnUrlQuery = query[AppsEditorQuery.ReturnUrl]?.toString();
      const reference = query[AppsEditorQuery.Id]?.toString();
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
          ? { pathname: Routes.Chat }
          : {
              pathname: Routes.Marketplace,
              query: {
                [MarketplaceQueryParams.tab]: MarketplaceTabs.MY_WORKSPACE,
                [MarketplaceQueryParams.entitiesTab]:
                  MarketplaceEntitiesTabs.AGENTS,
              },
            });

      const actions: Observable<AppAction>[] = [
        of(PromptsActions.clearSkillValidations()),
      ];

      if (hasCustomEditor) {
        actions.push(
          of(
            ApplicationTypesSchemasActions.resetDetailedApplicationTypeSchema(),
          ),
        );
      }

      if (route.pathname === Routes.Marketplace) {
        if (payload.shouldSelectApplication && reference) {
          actions.push(
            of(
              MarketplaceActions.setDetailsEntity({
                reference: reference as string,
                type: MarketplaceEntitiesTabs.AGENTS,
                isSuggested: false,
              }),
            ),
          );
        }
      }

      if (publicationUrl) {
        actions.push(
          of(
            ConversationsActions.selectConversations({
              conversationIds: [],
            }),
            PublicationActions.setIsApplicationReview(true),
          ),
        );
      } else if (returnConversationIds?.length) {
        actions.push(
          of(
            ConversationsActions.selectConversations({
              conversationIds: returnConversationIds as string[],
            }),
          ),
        );
      } else {
        actions.push(
          of(
            ConversationsActions.createNewConversations({
              names: [DEFAULT_CONVERSATION_NAME],
            }),
          ),
        );
      }

      actions.push(of(UIActions.setEditorLoader(false)));

      if (!publicationUrl) {
        actions.push(
          of(
            ApplicationTypesSchemasActions.resetDetailedApplicationTypeSchema(),
          ),
        );
        actions.push(of(ApplicationActions.setAppDetails()));
      }

      return navigateAndThen(router, route, concat(...actions));
    }),
  );

const setSelectedWidgetEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ApplicationActions.setSelectedWidget.type),
    tap(({ payload }) => BrowserStorage.setSelectedWidget(payload)),
    ignoreElements(),
  );

const initQueryParamsEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ApplicationActions.initQueryParams.type),
    switchMap(() => {
      const query = parse(window.location.search.slice(1));
      const stepParam = query[AppsEditorQuery.Step]?.toString() ?? '';
      const editorStep = isMarketplaceEditorStep(stepParam)
        ? stepParam
        : MarketplaceEditorSteps.General;

      return of(ApplicationActions.setEditorStep(editorStep));
    }),
  );

const setQueryParamsEpic: AppEpic = (action$, state$, { router }) =>
  action$.pipe(
    ofType(
      ApplicationActions.setEditorStep.type,
      ApplicationActions.getSuccess.type,
      ApplicationActions.editSuccess.type,
      ApplicationActions.updateSuccess.type,
      ApplicationActions.createSuccess.type,
    ),
    switchMap((action) => {
      const isExitingAfterSave =
        action.type === ApplicationActions.updateSuccess.type &&
        action.payload.isExitingAfterSave;

      if (window.location.pathname !== Routes.AppsEditor || isExitingAfterSave)
        return EMPTY;
      const state = state$.value;
      const query = parse(window.location.search.slice(1));
      const pathname = window.location.pathname;

      // editor-step
      query[AppsEditorQuery.Step] =
        ApplicationSelectors.selectEditorStep(state);

      // app reference
      const app = ApplicationSelectors.selectApplicationDetail(state);
      if (app?.reference) {
        query[AppsEditorQuery.Id] = app.reference;
      }

      void router.push({ pathname, query }, undefined, { shallow: true });

      return EMPTY;
    }),
  );

const updateApplicationIconsOnFileMoveEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(FilesActions.moveFilesSuccess.type),
    mergeMap(({ payload }) => {
      const moves = getFileMovesFromResult(payload.result);

      if (!moves.length) {
        return EMPTY;
      }

      const affectedApplications = ModelsSelectors.selectModels(state$.value)
        .filter((model) => isMyApplication(model) && !!model.iconUrl)
        .map((model) => ({
          model,
          newIconUrl: updatePathOnMove(model.iconUrl as string, moves),
        }))
        .filter(({ model, newIconUrl }) => newIconUrl !== model.iconUrl);

      if (!affectedApplications.length) {
        return EMPTY;
      }

      return from(affectedApplications).pipe(
        mergeMap(({ model, newIconUrl }) =>
          ApplicationService.get(model.id).pipe(
            mergeMap((application) =>
              application
                ? of(
                    ApplicationActions.edit({
                      oldApplication: application,
                      updatedApplication: {
                        ...application,
                        iconUrl: newIconUrl,
                      },
                    }),
                  )
                : EMPTY,
            ),
            catchError((err) => {
              console.error(
                'Failed to update application icon after file move:',
                err,
              );
              return EMPTY;
            }),
          ),
        ),
      );
    }),
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
  initQueryParamsEpic,
  setQueryParamsEpic,
  updateApplicationIconsOnFileMoveEpic,
);
