import {
  EMPTY,
  Observable,
  catchError,
  concat,
  concatMap,
  filter,
  iif,
  map,
  mergeMap,
  of,
  switchMap,
  zip,
} from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import {
  getApplicationType,
  getQuick2AppDocumentUrl,
  getQuickAppDocumentUrl,
  isQuickApp,
  isQuickApp2,
} from '@/src/utils/app/application';
import { addTrailingSlashIfAbsent } from '@/src/utils/app/common';
import { BucketService } from '@/src/utils/app/data/bucket-service';
import { ConversationService } from '@/src/utils/app/data/conversation-service';
import { ShareService } from '@/src/utils/app/data/share-service';
import { parseApiError } from '@/src/utils/app/epics-helpers/common.epic-helpers';
import { getCurrentReviewBucket } from '@/src/utils/app/epics-helpers/publications.epic-helpers';
import {
  constructPath,
  isAttachmentLink,
  isConversationHasExternalAttachments,
} from '@/src/utils/app/file';
import {
  getEntityBucket,
  isApplicationId,
  isConversationId,
  isEntityIdExternal,
  isFileId,
  isFolderId,
  isMyEntity,
  isPromptId,
} from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { hasWritePermission } from '@/src/utils/app/share';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils, parseEntityApiKey } from '@/src/utils/server/api';

import { ApplicationType } from '@/src/types/applications';
import { Conversation } from '@/src/types/chat';
import { ApiKeys, FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import {
  ShareByLinkResponseModel,
  ShareRelations,
  ShareRequestType,
  ShareResource,
} from '@/src/types/share';
import { AppAction, AppEpic } from '@/src/types/store';
import { ToastType } from '@/src/types/toasts';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  CodeEditorActions,
  ConversationsActions,
  FilesActions,
  MarketplaceActions,
  ModelsActions,
  PromptsActions,
  ShareActions,
  UIActions,
} from '@/src/store/actions';
import { ModelUpdatedValues } from '@/src/store/models/models.types';
import {
  ApplicationSelectors,
  ApplicationTypesSchemasSelectors,
  CodeEditorSelectors,
  ConversationsSelectors,
  FilesSelectors,
  ModelsSelectors,
  PromptsSelectors,
  SettingsSelectors,
  ShareSelectors,
} from '@/src/store/selectors';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { ChatI18nKeys, CommonI18nKeys } from '@/src/constants/i18n';
import {
  DeleteType,
  MarketplaceEntitiesTabs,
} from '@/src/constants/marketplace';
import { NA_VERSION } from '@/src/constants/publication';
import { shareApiErrorsRegex } from '@/src/constants/share';

import { ConversationInfo, Message, UploadStatus } from '@epam/ai-dial-shared';
import sortBy from 'lodash-es/sortBy';

const getResourceSoringWeight = (resource: ShareResource) =>
  splitEntityId(resource.url).apiKey === ApiKeys.Files ? 1 : 0;

const getInternalResourcesUrls = (
  messages: Message[] | undefined,
): string[] => {
  return (messages
    ?.map((message) =>
      message.custom_content?.attachments
        ?.map((attachment) => attachment.url)
        .filter(Boolean)
        .filter((url) => url && !isAttachmentLink(url)),
    )
    .filter(Boolean)
    .flat() || []) as string[];
};

const shareEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.share.type),
    switchMap(({ payload }) => {
      const resourceId = payload.entity.id;
      if (payload.featureType === FeatureType.Chat) {
        if (!payload.isFolder) {
          return of(ShareActions.shareConversation({ resourceId }));
        } else {
          return of(
            ShareActions.shareConversationFolder({
              resourceId,
            }),
          );
        }
      } else if (payload.featureType === FeatureType.Prompt) {
        if (!payload.isFolder) {
          return of(ShareActions.sharePrompt({ resourceId }));
        } else {
          return of(ShareActions.sharePromptFolder({ resourceId }));
        }
      } else {
        return of(
          ShareActions.shareApplication({
            resourceId,
            permissions: payload.permissions,
          }),
        );
      }
    }),
  );

const shareConversationEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.shareConversation.type),
    switchMap(({ payload }) => {
      const { apiKey, bucket, parentPath, name } = splitEntityId(
        payload.resourceId,
      );
      const { modelInfo } = parseEntityApiKey(payload.resourceId, {
        parseModel: true,
      });

      return ConversationService.getConversation({
        ...modelInfo,
        id: payload.resourceId,
        name,
        folderId: constructPath(apiKey, bucket, parentPath),
      }).pipe(
        switchMap((res) => {
          const internalResources = getInternalResourcesUrls(
            res?.playback?.messagesStack || res?.messages,
          );

          if (res && isConversationHasExternalAttachments(res)) {
            return of(
              ShareActions.shareFail({
                message: CommonI18nKeys.ShareWithExternalFilesFailed,
              }),
            );
          }

          return ShareService.share({
            invitationType: ShareRequestType.link,
            resources: [
              {
                url: ApiUtils.encodeApiUrl(payload.resourceId),
              },
              ...internalResources.map((res) => ({
                url: res,
              })),
            ],
          }).pipe(
            map((response: ShareByLinkResponseModel) => {
              return ShareActions.shareSuccess({
                invitationId: response.invitationLink.split('/').slice(-1)?.[0],
              });
            }),
            catchError((err) => {
              console.error(err);
              const { traceId } = parseApiError(err);
              return of(ShareActions.shareFail({ traceId }));
            }),
          );
        }),
        catchError((err) => {
          console.error(err);
          const { traceId } = parseApiError(err);
          return of(ShareActions.shareFail({ traceId }));
        }),
      );
    }),
  );

const shareConversationFolderEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.shareConversationFolder.type),
    switchMap(({ payload }) => {
      return ConversationService.getConversations(
        payload.resourceId,
        true,
      ).pipe(
        switchMap((res) => {
          return zip(
            res.map((res) =>
              ConversationService.getConversation({
                ...res,
              }),
            ),
          );
        }),
        map((res) => res.filter(Boolean) as Conversation[]),
        switchMap((conversations: Conversation[]) => {
          const internalResourcesIds = conversations
            .flatMap((res) =>
              getInternalResourcesUrls(
                res.playback?.messagesStack || res.messages,
              ),
            )
            .map((url) => ({ url }));

          if (conversations.some(isConversationHasExternalAttachments)) {
            return of(
              ShareActions.shareFail({
                message: CommonI18nKeys.ShareWithExternalFilesFailed,
              }),
            );
          }

          return ShareService.share({
            invitationType: ShareRequestType.link,
            resources: [
              {
                url: ApiUtils.encodeApiUrl(payload.resourceId) + '/',
              },
              ...internalResourcesIds,
            ],
          }).pipe(
            map((response: ShareByLinkResponseModel) => {
              return ShareActions.shareSuccess({
                invitationId: response.invitationLink.split('/').slice(-1)?.[0],
              });
            }),
            catchError((err) => {
              console.error(err);
              const { traceId } = parseApiError(err);
              return of(ShareActions.shareFail({ traceId }));
            }),
          );
        }),
        catchError((err) => {
          console.error(err);
          const { traceId } = parseApiError(err);
          return of(ShareActions.shareFail({ traceId }));
        }),
      );
    }),
  );
const sharePromptEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.sharePrompt.type),
    switchMap(({ payload }) => {
      return ShareService.share({
        invitationType: ShareRequestType.link,
        resources: [
          {
            url: ApiUtils.encodeApiUrl(payload.resourceId),
          },
        ],
      }).pipe(
        map((response: ShareByLinkResponseModel) => {
          return ShareActions.shareSuccess({
            invitationId: response.invitationLink.split('/').slice(-1)?.[0],
          });
        }),
        catchError((err) => {
          console.error(err);
          const { traceId } = parseApiError(err);
          return of(ShareActions.shareFail({ traceId }));
        }),
      );
    }),
  );

const sharePromptFolderEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.sharePromptFolder.type),
    switchMap(({ payload }) => {
      return ShareService.share({
        invitationType: ShareRequestType.link,
        resources: [
          {
            url: ApiUtils.encodeApiUrl(payload.resourceId) + '/',
          },
        ],
      }).pipe(
        map((response: ShareByLinkResponseModel) => {
          return ShareActions.shareSuccess({
            invitationId: response.invitationLink.split('/').slice(-1)?.[0],
          });
        }),
        catchError((err) => {
          console.error(err);
          const { traceId } = parseApiError(err);
          return of(ShareActions.shareFail({ traceId }));
        }),
      );
    }),
  );

const shareApplicationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ShareActions.shareApplication.type),
    switchMap(({ payload }) => {
      const modelsMap = ModelsSelectors.selectModelsMap(state$.value);
      const application = modelsMap[payload.resourceId];

      if (!application) {
        return of(ShareActions.shareFail());
      }

      const applicationType = getApplicationType(application);
      const applicationDetails = ApplicationSelectors.selectApplicationDetail(
        state$.value,
      );
      const schema = ApplicationTypesSchemasSelectors.selectSchemaById(
        state$.value,
        applicationType,
      );

      if (
        (applicationType === ApplicationType.CODE_APP ||
          schema?.displayName === 'Quick App' ||
          isQuickApp2(application) ||
          isQuickApp(application)) &&
        applicationDetails?.reference !== application.reference
      ) {
        return of(
          ApplicationActions.get({
            applicationId: payload.resourceId,
            isForSharing: true,
          }),
        );
      }

      const resources: ShareResource[] = [
        {
          url: ApiUtils.encodeApiUrl(payload.resourceId),
          permissions: payload.permissions,
        },
      ];

      const actions: Observable<AppAction>[] = [];

      if (application?.iconUrl) {
        const iconId = application.iconUrl;
        if (isEntityIdExternal({ id: iconId })) {
          actions.push(
            of(
              UIActions.showWarningToast(
                `The icon used for this application is in the "${isEntityIdPublic({ id: iconId }) ? 'Organization' : 'Shared with me'}" section and cannot be shared. Please replace the icon, otherwise the application will be shared with the default one.`,
              ),
            ),
          );
        } else {
          resources.push({
            url: ApiUtils.encodeApiUrl(iconId),
          });
        }
      }

      const docUrl =
        getQuickAppDocumentUrl(applicationDetails) ??
        getQuick2AppDocumentUrl(applicationDetails);

      if (hasWritePermission(payload.permissions) && docUrl?.length) {
        docUrl.forEach((url) =>
          resources.push({
            url: ApiUtils.encodeApiUrl(url),
            permissions: payload.permissions,
          }),
        );
      }

      if (
        hasWritePermission(payload.permissions) &&
        applicationType &&
        applicationDetails?.function?.sourceFolder
      ) {
        resources.push({
          url:
            ApiUtils.encodeApiUrl(applicationDetails.function.sourceFolder) +
            '/',
          permissions: payload.permissions,
        });
      }

      return ShareService.share({
        invitationType: ShareRequestType.link,
        resources,
      }).pipe(
        switchMap((response: ShareByLinkResponseModel) => {
          return concat(
            of(
              ShareActions.shareSuccess({
                invitationId: response.invitationLink.split('/').slice(-1)?.[0],
                permissions: payload.permissions,
              }),
            ),
            ...actions,
          );
        }),
        catchError((err) => {
          console.error(err);
          const { traceId, message } = parseApiError(err);
          const errorMessage = message?.toLowerCase()?.trim() ?? '';
          let failedPayload = undefined;

          if (
            shareApiErrorsRegex.applicationWithPublicFiles.test(errorMessage)
          ) {
            failedPayload =
              CommonI18nKeys.ShareApplicationWithPublicResourcesFailed;
          }

          return of(
            ShareActions.shareFail({ message: failedPayload, traceId }),
          );
        }),
      );
    }),
  );

const shareFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.shareFail.type),
    map(({ payload }) => {
      return UIActions.showErrorToast({
        message: translate(payload?.message ?? CommonI18nKeys.ShareFailed, {
          ns: Translation.Common,
        }),
        traceId: payload?.traceId,
      });
    }),
  );

const acceptInvitationEpic: AppEpic = (action$, state$, { router }) =>
  action$.pipe(
    ofType(ShareActions.acceptShareInvitation.type),
    switchMap(({ payload }) =>
      ShareService.getShareDetails({
        invitationId: payload.invitationId,
      }).pipe(
        switchMap((data) => {
          const acceptedIds = data.resources.filter(
            (resource) =>
              isPromptId(resource.url) ||
              isConversationId(resource.url) ||
              isApplicationId(resource.url),
          );

          const acceptedId = ApiUtils.decodeApiUrl(acceptedIds[0].url);
          const permissions = acceptedIds[0].permissions;
          const isFolder = isFolderId(acceptedIds[0].url);
          const isConversation = isConversationId(acceptedId);
          const isPrompt = isPromptId(acceptedId);
          const isApplication = isApplicationId(acceptedId);

          if (isMyEntity({ id: acceptedId })) {
            if (isApplication) {
              return of(
                ApplicationActions.get({
                  applicationId: acceptedId,
                  showCard: true,
                }),
              );
            }

            void router.push('/', undefined, { shallow: true });

            if (isConversation) {
              return isFolder
                ? of(
                    ConversationsActions.uploadConversationsFromMultipleFolders(
                      {
                        paths: [acceptedId],
                        pathToSelectFrom: acceptedId,
                      },
                    ),
                  )
                : of(
                    ConversationsActions.selectConversations({
                      conversationIds: [acceptedId],
                    }),
                  );
            }

            if (isPrompt) {
              return concat(
                isFolder
                  ? of(
                      PromptsActions.uploadPromptsFromMultipleFolders({
                        paths: [acceptedId],
                        pathToSelectFrom: acceptedId,
                      }),
                    )
                  : of(PromptsActions.selectPrompt({ promptId: acceptedId })),
                of(
                  ConversationsActions.createNewConversations({
                    names: [DEFAULT_CONVERSATION_NAME],
                    headerCreateNew: false,
                  }),
                ),
              );
            }
            return EMPTY;
          }
          return ShareService.shareAccept({
            invitationId: payload.invitationId,
          }).pipe(
            switchMap(() => {
              return of(
                ShareActions.acceptShareInvitationSuccess({
                  acceptedId,
                  permissions,
                  isFolder,
                  isConversation,
                  isPrompt,
                  isApplication,
                }),
              );
            }),
            catchError((err) => {
              console.error(err);
              const { message, traceId } = parseApiError(err);
              return of(
                ShareActions.acceptShareInvitationFail({
                  message: message?.trim()?.toLowerCase(),
                  details: data,
                  traceId,
                }),
              );
            }),
          );
        }),
        catchError((err) => {
          console.error(err);
          const { message, traceId } = parseApiError(err);
          return of(
            ShareActions.acceptShareInvitationFail({
              message: message?.trim()?.toLowerCase(),
              traceId,
            }),
          );
        }),
      ),
    ),
  );

const acceptInvitationSuccessEpic: AppEpic = (action$, state$, { router }) =>
  action$.pipe(
    ofType(ShareActions.acceptShareInvitationSuccess.type),
    switchMap(({ payload }) => {
      if (payload.isApplication) {
        const { acceptedId, permissions } = payload;
        const modelsMap = ModelsSelectors.selectModelsMap(state$.value);
        const applicationFromState = modelsMap[acceptedId];

        if (!applicationFromState) {
          return of(
            ApplicationActions.get({
              applicationId: acceptedId,
              showCard: true,
              acceptSharePermissions: permissions,
            }),
          );
        } else {
          return concat(
            of(
              ModelsActions.updateLocalModels({
                modelsToUpdate: [
                  {
                    reference: applicationFromState.reference,
                    updatedValues: {
                      sharedWithMe: true,
                      permissions,
                    },
                  },
                ],
              }),
            ),

            of(
              MarketplaceActions.setDetailsEntity({
                reference: applicationFromState.reference,
                type: MarketplaceEntitiesTabs.AGENTS,
                isSuggested: false,
              }),
            ),
          );
        }
      } else {
        router.push('/', undefined, { shallow: true });
      }

      if (payload.isPrompt) {
        return of(UIActions.setShowPromptbar(true));
      } else if (payload.isConversation) {
        return of(UIActions.setShowChatbar(true));
      }
      return EMPTY;
    }),
  );

const acceptInvitationFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.acceptShareInvitationFail.type),
    switchMap(({ payload }) => {
      history.replaceState({}, '', window.location.origin);

      const { message: errorMessage, details, traceId } = payload;
      let resourceUrl = sortBy(
        details?.resources ?? [],
        getResourceSoringWeight,
      )?.[0]?.url;

      const resultActions$: Observable<AppAction>[] = [
        of(ShareActions.resetAcceptedEntityInfo()),
        of(ConversationsActions.initSelectedConversations()),
      ];
      if (
        errorMessage?.startsWith('no invitation found') ||
        errorMessage?.includes('not found')
      ) {
        resultActions$.push(
          of(
            UIActions.showErrorToast({
              message: translate(CommonI18nKeys.AcceptShareNotExists, {
                ns: Translation.Common,
              }),
              traceId,
            }),
          ),
        );
      } else if (
        errorMessage?.startsWith(
          'limit is exceeded on the number of accepted users',
        ) &&
        resourceUrl
      ) {
        const parsedUrl = errorMessage?.split(':')?.[1]?.trim();
        resourceUrl =
          parsedUrl && isFileId(parsedUrl) ? parsedUrl : resourceUrl;
        const isFolderResource = isFolderId(resourceUrl);
        const { name, version } = parseEntityApiKey(
          splitEntityId(resourceUrl).name,
          {
            parseVersion: true,
            parseModel: isConversationId(resourceUrl),
          },
        );

        resultActions$.push(
          of(
            UIActions.showToast({
              message: translate(
                isFolderResource || version === NA_VERSION
                  ? CommonI18nKeys.ShareLimitExceeded
                  : CommonI18nKeys.ShareLimitExceededWithVersion,
                {
                  ns: Translation.Common,
                  name: decodeURIComponent(
                    isFolderResource
                      ? (resourceUrl.split('/').at(-2) ?? resourceUrl)
                      : name,
                  ),
                  version,
                },
              ),
              type: ToastType.Error,
              title: translate(CommonI18nKeys.LimitExceeded, {
                ns: Translation.Common,
              }),
              traceId,
            }),
          ),
        );
      } else {
        resultActions$.push(
          of(
            UIActions.showErrorToast({
              message: translate(CommonI18nKeys.AcceptShareFailed, {
                ns: Translation.Common,
              }),
              traceId,
            }),
          ),
        );
      }

      return concat(...resultActions$);
    }),
  );

const triggerGettingSharedListingsConversationsEpic: AppEpic = (
  action$,
  state$,
) =>
  action$.pipe(
    ofType(
      ConversationsActions.initFoldersAndConversationsSuccess.type,
      ShareActions.acceptShareInvitationSuccess.type,
      ShareActions.triggerGettingSharedConversationListings.type,
    ),
    filter(() =>
      SettingsSelectors.isSharingEnabled(state$.value, FeatureType.Chat),
    ),
    switchMap(() => {
      return concat(
        of(
          ShareActions.getSharedListing({
            featureType: FeatureType.Chat,
            sharedWith: ShareRelations.me,
          }),
        ),
        of(
          ShareActions.getSharedListing({
            featureType: FeatureType.Chat,
            sharedWith: ShareRelations.others,
          }),
        ),
      );
    }),
  );

const triggerGettingSharedListingsPromptsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(
      PromptsActions.initFoldersAndPromptsSuccess.type,
      ShareActions.acceptShareInvitationSuccess.type,
      ShareActions.triggerGettingSharedPromptListings.type,
    ),
    filter(() =>
      SettingsSelectors.isSharingEnabled(state$.value, FeatureType.Prompt),
    ),
    switchMap(() => {
      return concat(
        of(
          ShareActions.getSharedListing({
            featureType: FeatureType.Prompt,
            sharedWith: ShareRelations.me,
          }),
        ),
        of(
          ShareActions.getSharedListing({
            featureType: FeatureType.Prompt,
            sharedWith: ShareRelations.others,
          }),
        ),
      );
    }),
  );

const triggerGettingSharedListingsAttachmentsEpic: AppEpic = (
  action$,
  state$,
) =>
  action$.pipe(
    ofType(
      FilesActions.getFilesWithFolders.type,
      ShareActions.acceptShareInvitationSuccess.type,
      ShareActions.triggerGettingSharedFilesListings.type,
      CodeEditorActions.initCodeEditor.type,
    ),
    filter((action) => {
      if (FilesActions.getFilesWithFolders.match(action)) {
        return !action.payload.id && !action.payload.skipShareListingsRefresh;
      }

      return true;
    }),
    filter(() => {
      return SettingsSelectors.isSharingEnabled(state$.value, FeatureType.Chat);
    }),
    switchMap(() => {
      return concat(
        of(
          ShareActions.getSharedListing({
            featureType: FeatureType.File,
            sharedWith: ShareRelations.me,
            includeUserInfo: true,
          }),
        ),
        of(
          ShareActions.getSharedListing({
            featureType: FeatureType.File,
            sharedWith: ShareRelations.others,
            includeUserInfo: true,
          }),
        ),
      );
    }),
  );

const triggerGettingSharedListingsApplicationsEpic: AppEpic = (
  action$,
  state$,
) =>
  action$.pipe(
    ofType(
      ModelsActions.getModelsSuccess.type,
      ShareActions.triggerGettingSharedApplicationsListings.type,
    ),
    filter(() => {
      return SettingsSelectors.isSharingEnabled(
        state$.value,
        FeatureType.Application,
      );
    }),
    switchMap(() => {
      return concat(
        of(
          ShareActions.getSharedListing({
            featureType: FeatureType.Application,
            sharedWith: ShareRelations.me,
          }),
        ),
        of(
          ShareActions.getSharedListing({
            featureType: FeatureType.Application,
            sharedWith: ShareRelations.others,
          }),
        ),
      );
    }),
  );

const getSharedListingEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.getSharedListing.type),
    mergeMap(({ payload }) => {
      return ShareService.getSharedListing({
        order: 'popular_asc',
        resourceTypes: [
          EnumMapper.getBackendResourceTypeByFeatureType(payload.featureType),
        ],
        with: payload.sharedWith,
        includeUserInfo: payload.includeUserInfo,
      }).pipe(
        switchMap((entities) => {
          return of(
            ShareActions.getSharedListingSuccess({
              featureType: payload.featureType,
              sharedWith: payload.sharedWith,
              resources: entities,
            }),
          );
        }),
        catchError((err) => {
          console.error(err);
          const { traceId } = parseApiError(err);
          return of(ShareActions.getSharedListingFail({ traceId }));
        }),
      );
    }),
  );

const getSharedListingFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.getSharedListingFail.type),
    switchMap(({ payload }) => {
      return of(
        UIActions.showErrorToast({
          message: translate(CommonI18nKeys.ShareByMeListingFailed, {
            ns: Translation.Common,
          }),
          traceId: payload?.traceId,
        }),
      );
    }),
  );

// TODO: refactor it to something better
const getSharedListingSuccessEpic: AppEpic = (action$, state$, { router }) =>
  action$.pipe(
    ofType(ShareActions.getSharedListingSuccess.type),
    switchMap(({ payload }) => {
      const actions = [];

      const { acceptedId, isFolderAccepted, isConversation, isPrompt } =
        ShareSelectors.selectAcceptedEntityInfo(state$.value);
      const [selectedConv] = ConversationsSelectors.selectSelectedConversations(
        state$.value,
      );

      if (payload.featureType === FeatureType.Chat) {
        if (payload.sharedWith === ShareRelations.others) {
          const conversations = ConversationsSelectors.selectConversations(
            state$.value,
          );
          const folders = ConversationsSelectors.selectFolders(state$.value);

          actions.push(
            ...(payload.resources.folders
              .map((item) => {
                const isShared = folders.find((res) => res.id === item.id);

                if (isShared) {
                  return ConversationsActions.updateFolder({
                    folderId: item.id,
                    values: {
                      isShared: true,
                    },
                  });
                }
                return undefined;
              })
              .filter(Boolean) as AppAction[]),
          );

          actions.push(
            ...((payload.resources.entities as ConversationInfo[])
              .map((conv) => {
                const sharedConv = conversations.find(
                  (res) => res.id === conv.id,
                );

                if (sharedConv) {
                  return ConversationsActions.updateConversationSuccess({
                    id: conv.id,
                    conversation: {
                      isShared: true,
                      updatedAt: sharedConv.updatedAt,
                    },
                  });
                }
                return undefined;
              })
              .filter(Boolean) as AppAction[]),
          );
        } else {
          const sharedFolderIds = payload.resources.folders.map(
            (folder) => folder.id,
          );
          actions.push(
            ConversationsActions.uploadConversationsFromMultipleFolders({
              paths: sharedFolderIds,
              recursive: true,
              pathToSelectFrom:
                isFolderAccepted && isConversation ? acceptedId : undefined,
              cleanUpEmptySharedFolderPaths: sharedFolderIds,
            }),
          );

          if (acceptedId && isConversation) {
            if (!isFolderAccepted) {
              actions.push(
                ConversationsActions.selectConversations({
                  conversationIds: [acceptedId],
                }),
              );
            }

            actions.push(ShareActions.resetAcceptedEntityInfo());
          }

          if (
            selectedConv &&
            payload.resources.entities.some(
              (conv) => conv.id === selectedConv.id,
            )
          ) {
            actions.push(
              ConversationsActions.selectConversations({
                conversationIds: [selectedConv.id],
              }),
            );
          }

          payload.resources.entities.length &&
            actions.push(
              ConversationsActions.addConversations({
                conversations: payload.resources.entities.map((res) => ({
                  ...res,
                  sharedWithMe: true,
                })) as Conversation[],
              }),
            );
          payload.resources.folders.length &&
            actions.push(
              ConversationsActions.addFolders({
                folders: payload.resources.folders.map((res) => ({
                  ...res,
                  sharedWithMe: true,
                  status: UploadStatus.LOADED,
                })) as FolderInterface[],
              }),
            );
        }
      }
      if (payload.featureType === FeatureType.Prompt) {
        if (payload.sharedWith === ShareRelations.others) {
          const prompts = PromptsSelectors.selectPrompts(state$.value);
          actions.push(
            ...(payload.resources.entities
              .map((item) => {
                const sharedPrompt = prompts.find((res) => res.id === item.id);

                if (sharedPrompt) {
                  return PromptsActions.updatePromptSuccess({
                    id: item.id,
                    prompt: {
                      isShared: true,
                    },
                  });
                }
                return undefined;
              })
              .filter(Boolean) as AppAction[]),
          );
          const folders = PromptsSelectors.selectFolders(state$.value);
          payload.resources.folders.length &&
            actions.push(
              ...(payload.resources.folders
                .map((item) => {
                  const isShared = folders.find((res) => res.id === item.id);

                  if (isShared) {
                    return PromptsActions.updateFolder({
                      folderId: item.id,
                      values: {
                        isShared: true,
                      },
                    });
                  }
                  return undefined;
                })
                .filter(Boolean) as AppAction[]),
            );
        } else {
          const sharedPromptFolderIds = payload.resources.folders.map(
            (folder) => folder.id,
          );
          actions.push(
            PromptsActions.uploadPromptsFromMultipleFolders({
              paths: sharedPromptFolderIds,
              recursive: true,
              pathToSelectFrom:
                isFolderAccepted && isPrompt ? acceptedId : undefined,
              cleanUpEmptySharedFolderPaths: sharedPromptFolderIds,
            }),
          );

          if (acceptedId && isPrompt) {
            if (!isFolderAccepted) {
              actions.push(
                PromptsActions.selectPrompt({
                  promptId: acceptedId,
                }),
              );
            }

            if (!selectedConv) {
              // shared with me could be already selected, so we haven't to upload it twice
              actions.push(ConversationsActions.initSelectedConversations());
            }

            actions.push(ShareActions.resetAcceptedEntityInfo());
          }

          const selectedPrompt = PromptsSelectors.selectSelectedPrompt(
            state$.value,
          );

          payload.resources.entities.length &&
            actions.push(
              PromptsActions.addPrompts({
                prompts: payload.resources.entities
                  // do not override selected prompt
                  .filter((res) => res.id !== selectedPrompt?.id)
                  .map((res) => ({
                    ...res,
                    sharedWithMe: true,
                  })) as Prompt[],
              }),
            );
          payload.resources.folders.length &&
            actions.push(
              PromptsActions.addFolders({
                folders: payload.resources.folders.map((res) => ({
                  ...res,
                  sharedWithMe: true,
                })) as FolderInterface[],
              }),
            );
        }
      }

      if (payload.featureType === FeatureType.File) {
        if (payload.sharedWith === ShareRelations.others) {
          const files = FilesSelectors.selectFiles(state$.value);
          const folders = FilesSelectors.selectFolders(state$.value);

          actions.push(
            FilesActions.setSharedFileIds({
              ids: payload.resources.entities.map((entity) => entity.id),
            }),
          );

          actions.push(
            FilesActions.setSharedFolderIds({
              ids: payload.resources.folders.map((folder) => folder.id),
            }),
          );

          actions.push(
            ...(payload.resources.folders
              .map((item) => {
                const isShared = folders.find((res) => res.id === item.id);

                if (isShared) {
                  return FilesActions.updateFolder({
                    folderId: item.id,
                    values: {
                      isShared: true,
                    },
                  });
                }
                return undefined;
              })
              .filter(Boolean) as AppAction[]),
          );

          actions.push(
            ...(payload.resources.entities
              .map((item) => {
                const sharedFile = files.find((res) => res.id === item.id);
                if (sharedFile) {
                  return FilesActions.updateFileInfo({
                    id: item.id,
                    file: {
                      isShared: true,
                    },
                  });
                }
                return undefined;
              })
              .filter(Boolean) as AppAction[]),
          );
        } else {
          const selectedFilesIds = FilesSelectors.selectSelectedFilesIds(
            state$.value,
          );
          const files = payload.resources.entities as DialFile[];
          const folders = payload.resources.folders;

          const reviewBucket = getCurrentReviewBucket(state$.value, router);
          const selectedCodeEditorFileId =
            CodeEditorSelectors.selectSelectedFile(state$.value);
          const codeEditorBucket = selectedCodeEditorFileId
            ? getEntityBucket({ id: selectedCodeEditorFileId })
            : undefined;

          const sharedWithMeFileIds = files.map((f) => f.id);
          const sharedWithMeFolderIds = folders.map((f) => f.id);
          // Keep this action before addSharedFiles: files reducer uses the fresh
          // sharedWithMe ids to preserve valid nested descendants and clean stale ones.
          actions.push(
            FilesActions.setSharedWithMeFilesAndFoldersIds({
              ids: [...sharedWithMeFileIds, ...sharedWithMeFolderIds],
            }),
          );

          actions.push(
            FilesActions.addSharedFiles({
              files: files
                // do not override selected files
                .filter((res) => !selectedFilesIds.includes(res.id))
                .map((res) => ({
                  ...res,
                  sharedWithMe: true,
                  isRootSharedItem: true,
                })),
              reviewBuckets: [
                reviewBucket,
                codeEditorBucket !== BucketService.getBucket()
                  ? codeEditorBucket
                  : undefined,
              ].filter(Boolean) as string[],
            }),
          );
          actions.push(
            FilesActions.addFolders({
              folders: folders.map((res) => ({
                ...res,
                sharedWithMe: true,
                isRootSharedItem: true,
              })) as FolderInterface[],
            }),
          );
        }
      }

      if (payload.featureType === FeatureType.Application) {
        const modelsMap = ModelsSelectors.selectModelsMap(state$.value);
        if (payload.sharedWith === ShareRelations.others) {
          const modelsToUpdate = payload.resources.entities
            .map((sharedItem) => {
              const sharedModel = modelsMap[sharedItem.id];

              if (sharedModel) {
                return {
                  reference: sharedModel.reference,
                  updatedValues: {
                    isShared: true,
                  },
                };
              }
              return undefined;
            })
            .filter(Boolean) as ModelUpdatedValues[];

          actions.push(ModelsActions.updateLocalModels({ modelsToUpdate }));
        } else {
          const updateSharedActions: AppAction[] = [];
          const modelsToUpdate = payload.resources.entities
            .map((sharedItem) => {
              const sharedModel = modelsMap[sharedItem.id];

              if (sharedModel) {
                return {
                  reference: sharedModel.reference,
                  updatedValues: {
                    sharedWithMe: true,
                    permissions: sharedItem.permissions,
                  },
                };
              }
              return undefined;
            })
            .filter(Boolean) as ModelUpdatedValues[];

          if (modelsToUpdate.length) {
            updateSharedActions.push(
              ModelsActions.updateLocalModels({ modelsToUpdate }),
            );

            updateSharedActions.push(ModelsActions.getInstalledModelIds());

            const { acceptedId } = ShareSelectors.selectAcceptedEntityInfo(
              state$.value,
            );

            if (acceptedId) {
              const acceptedApplication =
                (acceptedId && modelsMap[acceptedId]) || undefined;

              if (acceptedApplication) {
                updateSharedActions.push(
                  MarketplaceActions.setDetailsEntity({
                    reference: acceptedApplication.reference,
                    type: MarketplaceEntitiesTabs.AGENTS,
                    isSuggested: false,
                  }),
                );
              } else {
                updateSharedActions.push(
                  ApplicationActions.get({
                    applicationId: acceptedId,
                    showCard: true,
                  }),
                );
              }

              updateSharedActions.push(ShareActions.resetAcceptedEntityInfo());
            }

            actions.push(...updateSharedActions);
          }
        }
      }

      return concat(actions);
    }),
  );

const revokeAccessEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.revokeAccess.type),
    mergeMap(({ payload }) => {
      const resourceUrls = payload.isFolder
        ? payload.resourceIds.map((id) =>
            addTrailingSlashIfAbsent(ApiUtils.encodeApiUrl(id)),
          )
        : payload.resourceIds.map(ApiUtils.encodeApiUrl);

      return ShareService.shareRevoke(resourceUrls).pipe(
        concatMap(() => concat(of(ShareActions.revokeAccessSuccess(payload)))),
        catchError((err) => {
          const { traceId } = parseApiError(err);
          return of(ShareActions.revokeAccessFail({ traceId }));
        }),
      );
    }),
  );

const revokeAccessSuccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ShareActions.revokeAccessSuccess.type),
    switchMap(({ payload }) => {
      const resourceId = payload.resourceIds[0];
      if (!payload.isFolder && payload.featureType === FeatureType.Chat) {
        return of(
          ConversationsActions.updateConversationSuccess({
            id: resourceId,
            conversation: {
              isShared: false,
            },
          }),
        );
      }
      if (payload.isFolder && payload.featureType === FeatureType.Chat) {
        return of(
          ConversationsActions.updateFolder({
            folderId: resourceId,
            values: {
              isShared: false,
            },
          }),
        );
      }
      if (!payload.isFolder && payload.featureType === FeatureType.Prompt) {
        return of(
          PromptsActions.updatePromptSuccess({
            id: resourceId,
            prompt: {
              isShared: false,
            },
          }),
        );
      }
      if (payload.isFolder && payload.featureType === FeatureType.Prompt) {
        return of(
          PromptsActions.updateFolder({
            folderId: resourceId,
            values: {
              isShared: false,
            },
          }),
        );
      }

      if (payload.featureType === FeatureType.File) {
        if (payload.isFolder) {
          return concat(
            ...payload.resourceIds.map((id) =>
              of(
                FilesActions.updateFolder({
                  folderId: id,
                  values: {
                    isShared: false,
                  },
                }),
              ),
            ),
          );
        }
        return concat(
          ...payload.resourceIds.map((id) =>
            of(
              FilesActions.updateFileInfo({
                id,
                file: {
                  isShared: false,
                },
              }),
            ),
          ),
        );
      }

      if (payload.featureType === FeatureType.Application) {
        const modelsMap = ModelsSelectors.selectModelsMap(state$.value);
        const applicationReference = modelsMap[resourceId]?.reference;

        if (!applicationReference) {
          return EMPTY;
        }
        return of(
          ModelsActions.updateLocalModels({
            modelsToUpdate: [
              {
                reference: applicationReference,
                updatedValues: {
                  isShared: false,
                },
              },
            ],
          }),
        );
      }

      console.error(`Entity not updated: ${payload.resourceIds}`);
      return EMPTY;
    }),
  );

const revokeAccessFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.revokeAccessFail.type),
    switchMap(({ payload }) => {
      return of(
        UIActions.showErrorToast({
          message: translate(CommonI18nKeys.RevokeAccessFailed, {
            ns: Translation.Common,
          }),
          traceId: payload?.traceId,
        }),
      );
    }),
  );

const discardSharedWithMeEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.discardSharedWithMe.type),
    mergeMap(({ payload }) => {
      const resourceUrls = payload.isFolder
        ? payload.resourceIds.map((resourceId) =>
            addTrailingSlashIfAbsent(ApiUtils.encodeApiUrl(resourceId)),
          )
        : payload.resourceIds.map(ApiUtils.encodeApiUrl);

      return ShareService.shareDiscard(resourceUrls).pipe(
        mergeMap(() => {
          const actions: Observable<AppAction>[] = [];

          payload.resourceIds.forEach((resourceId) => {
            actions.push(
              of(
                ShareActions.discardSharedWithMeSuccess({
                  resourceId,
                  featureType: payload.featureType,
                  isFolder: payload.isFolder,
                }),
              ),
            );
          });

          const namesStr = payload.resourceIds
            .map((id) => splitEntityId(id).name)
            .join(', ');

          actions.push(
            of(
              UIActions.showSuccessToast(
                translate(
                  payload.isFolder
                    ? CommonI18nKeys.FolderUnsharedSuccessfully
                    : payload.resourceIds.length === 1
                      ? CommonI18nKeys.ItemUnsharedSuccessfully
                      : CommonI18nKeys.ItemsUnsharedSuccessfully,
                  {
                    ns: Translation.Common,
                    itemName: namesStr,
                  },
                ),
              ),
            ),
          );

          return concat(...actions);
        }),
        catchError((err) => {
          const { traceId } = parseApiError(err);
          const errorActions: Observable<AppAction>[] = payload.resourceIds.map(
            (resourceId) => {
              const { name } = splitEntityId(resourceId);
              return of(
                UIActions.showErrorToast({
                  message: translate(
                    payload.isFolder
                      ? CommonI18nKeys.FailedToUnshareFolder
                      : CommonI18nKeys.FailedToUnshareItem,
                    {
                      ns: Translation.Common,
                      itemName: name,
                    },
                  ),
                }),
              );
            },
          );
          return concat(
            ...errorActions,
            of(ShareActions.discardSharedWithMeFail({ traceId })),
          );
        }),
      );
    }),
  );

const discardSharedWithMeSuccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ShareActions.discardSharedWithMeSuccess.type),
    switchMap(({ payload }) => {
      const state = state$.value;

      if (payload.featureType === FeatureType.Chat) {
        const actions: Observable<AppAction>[] = [];

        const conversations = ConversationsSelectors.selectConversations(state);
        const selectedConversationsIds =
          ConversationsSelectors.selectSelectedConversationsIds(state);
        const newSelectedConversationsIds = payload.isFolder
          ? selectedConversationsIds.filter(
              (id) => !id.startsWith(`${payload.resourceId}/`),
            )
          : selectedConversationsIds.filter((id) => id !== payload.resourceId);
        const newConversations = payload.isFolder
          ? conversations.filter(
              (conv) => !conv.id.startsWith(`${payload.resourceId}/`),
            )
          : conversations.filter((conv) => conv.id !== payload.resourceId);

        if (!newSelectedConversationsIds.length) {
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
        }

        if (!payload.isFolder) {
          return concat(
            of(
              ConversationsActions.setConversations({
                conversations: newConversations,
              }),
            ),
            ...actions,
          );
        }

        const folders = ConversationsSelectors.selectFolders(state);
        return concat(
          of(
            ConversationsActions.setFolders({
              folders: folders.filter(
                (item) =>
                  item.id !== payload.resourceId &&
                  !item.id.startsWith(`${payload.resourceId}/`),
              ),
            }),
          ),
          of(
            ConversationsActions.setConversations({
              conversations: newConversations,
            }),
          ),
          ...actions,
        );
      }

      if (payload.featureType === FeatureType.Prompt) {
        const prompts = PromptsSelectors.selectPrompts(state);

        if (!payload.isFolder) {
          return of(
            PromptsActions.setPrompts({
              prompts: prompts.filter((item) => item.id !== payload.resourceId),
            }),
          );
        }

        const folders = PromptsSelectors.selectFolders(state);
        return concat(
          of(
            PromptsActions.setFolders({
              folders: folders.filter(
                (item) =>
                  item.id !== payload.resourceId &&
                  !item.id.startsWith(`${payload.resourceId}/`),
              ),
            }),
          ),
          of(
            PromptsActions.setPrompts({
              prompts: prompts.filter(
                (p) => !p.id.startsWith(`${payload.resourceId}/`),
              ),
            }),
          ),
        );
      }

      if (payload.featureType === FeatureType.File) {
        const folders = FilesSelectors.selectFolders(state);

        return concat(
          of(
            FilesActions.setFolders({
              folders: folders.filter(
                (item) =>
                  item.id !== payload.resourceId &&
                  !item.id.startsWith(`${payload.resourceId}/`),
              ),
            }),
          ),
          of(FilesActions.deleteFile({ fileId: payload.resourceId })),
        );
      }

      if (payload.featureType === FeatureType.Application) {
        const modelsMap = ModelsSelectors.selectModelsMap(state);
        const applicationReference = modelsMap[payload.resourceId]?.reference;

        return concat(
          iif(
            () => !!applicationReference,
            of(
              ModelsActions.removeInstalledModels({
                references: [applicationReference!],
                action: DeleteType.DELETE,
              }),
            ),
            EMPTY,
          ),

          of(MarketplaceActions.setDetailsEntity()),
        );
      }

      console.error(`Entity not updated: ${payload.resourceId}`);
      return EMPTY;
    }),
  );

const discardSharedWithMeFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.discardSharedWithMeFail.type),
    switchMap(({ payload }) => {
      return of(
        UIActions.showErrorToast({
          message: translate(CommonI18nKeys.DiscardSharedWithMeFailed, {
            ns: Translation.Common,
          }),
          traceId: payload?.traceId,
        }),
      );
    }),
  );

const revokeFolderAccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(
      ConversationsActions.deleteFolder.type,
      PromptsActions.deleteFolder.type,
      ConversationsActions.updateFolder.type,
      PromptsActions.updateFolder.type,
    ),
    filter(
      ({ payload }) =>
        !('values' in payload) ||
        payload.values.name !== undefined ||
        payload.values.folderId !== undefined,
    ),
    switchMap(({ payload }) => {
      const { Selector, featureType } = isConversationId(payload.folderId)
        ? { Selector: ConversationsSelectors, featureType: FeatureType.Chat }
        : { Selector: PromptsSelectors, featureType: FeatureType.Prompt };
      const foldersToRevoke = [
        ...Selector.selectFoldersByFolderId(state$.value, payload.folderId),
        Selector.selectFolderById(state$.value, payload.folderId),
      ].filter((folder) => folder && folder.isShared) as FolderInterface[];

      if (!foldersToRevoke.length) {
        return EMPTY;
      }

      return concat(
        ...foldersToRevoke.map((folder) =>
          of(
            ShareActions.revokeAccess({
              isFolder: true,
              resourceIds: [folder.id],
              featureType,
            }),
          ),
        ),
      );
    }),
  );

export const ShareEpics = combineEpics(
  shareEpic,
  shareFailEpic,

  shareConversationEpic,
  sharePromptEpic,
  shareConversationFolderEpic,
  sharePromptFolderEpic,
  shareApplicationEpic,

  acceptInvitationEpic,
  acceptInvitationSuccessEpic,
  acceptInvitationFailEpic,

  revokeAccessEpic,
  revokeAccessSuccessEpic,
  revokeAccessFailEpic,

  discardSharedWithMeEpic,
  discardSharedWithMeSuccessEpic,
  discardSharedWithMeFailEpic,

  getSharedListingEpic,
  getSharedListingFailEpic,
  getSharedListingSuccessEpic,

  triggerGettingSharedListingsConversationsEpic,
  triggerGettingSharedListingsPromptsEpic,
  triggerGettingSharedListingsAttachmentsEpic,
  triggerGettingSharedListingsApplicationsEpic,

  revokeFolderAccessEpic,
);
