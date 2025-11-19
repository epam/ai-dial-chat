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
import { getLastPathSegment, getSafeRedirectUrl } from '@/src/utils/app/common';
import { ApplicationService } from '@/src/utils/app/data/application-service';
import { DataService } from '@/src/utils/app/data/data-service';
import { BrowserStorage } from '@/src/utils/app/data/storages/browser-storage';
import {
  isEntityIdExternal,
  isEntityIdLocal,
  isMyEntity,
} from '@/src/utils/app/id';
import { isMarketplaceEditorStep } from '@/src/utils/app/marketplace';
import { mergeFeatures } from '@/src/utils/app/models';
import { translate } from '@/src/utils/app/translation';
import { parseEntityApiKey } from '@/src/utils/server/api';

import { ApplicationTypeSchemaProperties } from '@/src/types/application-type-schema';
import {
  ApplicationStatus,
  CustomApplicationModel,
} from '@/src/types/applications';
import { MarketplaceEditorSteps } from '@/src/types/marketplace';
import { AppAction, AppEpic } from '@/src/types/store';

import {
  ApplicationActions,
  ApplicationTypesSchemasActions,
  ConversationsActions,
  MarketplaceActions,
  ModelsActions,
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
import {
  DeleteType,
  MarketplaceEntitiesTabs,
  MarketplaceQueryParams,
  MarketplaceTabs,
} from '@/src/constants/marketplace';
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
        regenerateApplicationId({ ...applicationData, reference: '' }),
        schema,
      ).pipe(
        switchMap((application) =>
          ApplicationService.get(application.id).pipe(
            switchMap((retrievedApplication) => {
              if (retrievedApplication) {
                const featuresRecord: Record<string, boolean | undefined> = {
                  ...(retrievedApplication.features || {}),
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
                UIActions.showErrorToast(
                  translate(
                    'An application with this name and this version already exists.',
                  ),
                ),
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
        UIActions.showErrorToast(
          translate(errorsMessages.createFailed, {
            entity: 'application',
          }),
        ),
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

const updateApplicationEpic: AppEpic = (action$) =>
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
        payload.applicationData,
      ) as CustomApplicationModel;

      const isMoved = payload.oldApplication.id !== updatedCustomApplication.id;

      if (payload.publicationUrl) {
        const payloadToUpdatePublication = {
          publicationUrl: payload.publicationUrl,
          oldApplication: payload.oldApplication,
          newApplication: updatedCustomApplication,
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
                if (err.status === 412) {
                  return of({
                    success: false as const,
                    actions: [
                      ApplicationActions.updateFail({
                        oldApplication: payload.oldApplication,
                      }),
                      UIActions.showErrorToast(
                        translate(
                          'An application with this name and this version already exists.',
                        ),
                      ),
                    ],
                  });
                }
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
                const featuresRecord: Record<string, boolean | undefined> = {
                  ...(updatedCustomApplication.features || {}),
                };

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

                return concat(...actions);
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
              endWith(ApplicationActions.updateComplete()),
            );
          }),
        ),
      );
    }),
  );

const editApplicationEpic: AppEpic = (action$) =>
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
          const featuresRecord: Record<string, boolean | undefined> = {
            ...(payload.updatedApplication.features || {}),
          };

          const modelData = {
            ...payload.updatedApplication,
            features: mergeFeatures(featuresRecord),
          };

          return of(
            ApplicationActions.editSuccess(),
            ModelsActions.updateModel({
              model: modelData,
              oldApplicationId: payload.updatedApplication.id,
            }),
          );
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

      const actions: Observable<AppAction>[] = [];

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

      if (route.pathname === Routes.Chat) {
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
      }

      return from(router.push(route)).pipe(switchMap(() => concat(...actions)));
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
);
