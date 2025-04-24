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
  getQuickAppDocumentUrl,
} from '@/src/utils/app/application';
import { ConversationService } from '@/src/utils/app/data/conversation-service';
import { ShareService } from '@/src/utils/app/data/share-service';
import {
  constructPath,
  isAttachmentLink,
  isConversationHasExternalAttachments,
} from '@/src/utils/app/file';
import {
  isApplicationId,
  isConversationId,
  isEntityIdExternal,
  isFolderId,
  isPromptId,
} from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { hasWritePermission } from '@/src/utils/app/share';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils, parseConversationApiKey } from '@/src/utils/server/api';

import { ApplicationType } from '@/src/types/applications';
import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
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

import { FilesSelectors } from '@/src/store/files/files.selectors';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { errorsMessages } from '@/src/constants/errors';
import { DeleteType } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

import { ApplicationActions } from '../application/application.reducers';
import { ApplicationSelectors } from '../application/application.selectors';
import { ApplicationTypesSchemasSelectors } from '../applicationTypeSchemas/applicationTypeSchemas.reducers';
import { CodeEditorActions } from '../codeEditor/codeEditor.reducer';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '../conversations/conversations.reducers';
import { FilesActions } from '../files/files.reducers';
import { MarketplaceActions } from '../marketplace/marketplace.reducers';
import { ModelsActions, ModelsSelectors } from '../models/models.reducers';
import { ModelUpdatedValues } from '../models/models.types';
import { PromptsActions, PromptsSelectors } from '../prompts/prompts.reducers';
import { SettingsSelectors } from '../settings/settings.reducers';
import { UIActions } from '../ui/ui.reducers';
import { ShareActions, ShareSelectors } from './share.reducers';

import { ConversationInfo, Message, UploadStatus } from '@epam/ai-dial-shared';

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

      return ConversationService.getConversation({
        ...parseConversationApiKey(payload.resourceId),
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
              ShareActions.shareFail(
                errorsMessages.shareWithExternalFilesFailed,
              ),
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
              return of(ShareActions.shareFail());
            }),
          );
        }),
        catchError((err) => {
          console.error(err);
          return of(ShareActions.shareFail());
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
              ShareActions.shareFail(
                errorsMessages.shareWithExternalFilesFailed,
              ),
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
              return of(ShareActions.shareFail());
            }),
          );
        }),
        catchError((err) => {
          console.error(err);
          return of(ShareActions.shareFail());
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
          return of(ShareActions.shareFail());
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
          return of(ShareActions.shareFail());
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
          schema?.displayName === 'Quick App') &&
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

      const docUrl = getQuickAppDocumentUrl(applicationDetails);
      if (docUrl?.length) {
        docUrl.forEach((url) =>
          resources.push({
            url: ApiUtils.encodeApiUrl(url),
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
          return of(ShareActions.shareFail());
        }),
      );
    }),
  );

const shareFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.shareFail.type),
    map(({ payload }) => {
      return UIActions.showErrorToast(
        translate(payload ?? errorsMessages.shareFailed),
      );
    }),
  );

const acceptInvitationEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.acceptShareInvitation.type),
    switchMap(({ payload }) => {
      return ShareService.shareAccept({
        invitationId: payload.invitationId,
      }).pipe(
        switchMap(() =>
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

              return of(
                ShareActions.acceptShareInvitationSuccess({
                  acceptedId,
                  isFolder: isFolderId(acceptedIds[0].url),
                  isConversation: isConversationId(acceptedIds[0].url),
                  isPrompt: isPromptId(acceptedIds[0].url),
                  isApplication: isApplicationId(acceptedId),
                }),
              );
            }),
          ),
        ),
        catchError((err) => {
          console.error(err);
          let message = errorsMessages.acceptShareFailed;
          if (err.message.trim().toLowerCase() === 'not found') {
            message = errorsMessages.acceptShareNotExists;
          }
          return of(ShareActions.acceptShareInvitationFail({ message }));
        }),
      );
    }),
  );

const acceptInvitationSuccessEpic: AppEpic = (action$, _state$, { router }) =>
  action$.pipe(
    ofType(ShareActions.acceptShareInvitationSuccess.type),
    switchMap(({ payload }) => {
      if (payload.isApplication) {
        router.push(Routes.Marketplace, undefined, { shallow: true });
        //TODO make request for the shared applications to add them into the state when share invitation is accepted.
        return of(ModelsActions.getModels());
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

      return concat(
        of(ShareActions.resetAcceptedEntityInfo()),
        of(ConversationsActions.initSelectedConversations()),
        of(
          UIActions.showErrorToast(
            translate(payload.message || errorsMessages.acceptShareFailed),
          ),
        ),
      );
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
        return !action.payload.id;
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
          }),
        ),
        of(
          ShareActions.getSharedListing({
            featureType: FeatureType.File,
            sharedWith: ShareRelations.others,
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
          return of(ShareActions.getSharedListingFail());
        }),
      );
    }),
  );

const getSharedListingFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.getSharedListingFail.type),
    switchMap(() => {
      return of(
        UIActions.showErrorToast(
          translate(errorsMessages.shareByMeListingFailed),
        ),
      );
    }),
  );

// TODO: refactor it to something better
const getSharedListingSuccessEpic: AppEpic = (action$, state$) =>
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
          actions.push(
            ConversationsActions.uploadConversationsFromMultipleFolders({
              paths: payload.resources.folders.map((folder) => folder.id),
              recursive: true,
              pathToSelectFrom:
                isFolderAccepted && isConversation ? acceptedId : undefined,
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
          actions.push(
            PromptsActions.uploadPromptsFromMultipleFolders({
              paths: payload.resources.folders.map((folder) => folder.id),
              recursive: true,
              pathToSelectFrom:
                isFolderAccepted && isPrompt ? acceptedId : undefined,
            }),
          );

          if (acceptedId && isPrompt) {
            if (!isFolderAccepted) {
              actions.push(
                PromptsActions.setSelectedPrompt({
                  promptId: acceptedId,
                }),
              );
              actions.push(
                PromptsActions.uploadPrompt({ promptId: acceptedId }),
              );
              actions.push(
                PromptsActions.setIsPromptModalOpen({ isOpen: true }),
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

          actions.push(
            FilesActions.setSharedFileIds({
              ids: payload.resources.entities.map((entity) => entity.id),
            }),
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

          actions.push(
            FilesActions.addSharedFiles({
              files: payload.resources.entities
                // do not override selected files
                .filter((res) => !selectedFilesIds.includes(res.id))
                .map((res) => ({
                  ...res,
                  sharedWithMe: true,
                })) as DialFile[],
            }),
          );

          actions.push(
            FilesActions.addFolders({
              folders: payload.resources.folders.map((res) => ({
                ...res,
                sharedWithMe: true,
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
          //TODO make request for the shared applications to add them into the state when share invitation is accepted.
          //TODO new action-service needs to be created.

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

            const acceptedApplicationReference =
              acceptedId && modelsMap[acceptedId]?.reference;

            if (acceptedApplicationReference) {
              updateSharedActions.push(
                MarketplaceActions.setDetailsModel({
                  reference: acceptedApplicationReference,
                  isSuggested: false,
                }),
              );
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
    switchMap(({ payload }) => {
      const resourceUrl = payload.isFolder
        ? ApiUtils.encodeApiUrl(payload.resourceId) + '/'
        : ApiUtils.encodeApiUrl(payload.resourceId);

      return ShareService.shareRevoke([resourceUrl]).pipe(
        concatMap(() =>
          concat(
            of(ShareActions.revokeAccessSuccess(payload)),
            iif(
              () => payload.featureType === FeatureType.Application,
              of(
                ModelsActions.updateLocalModels({
                  modelsToUpdate: [
                    {
                      reference: payload.resourceId,
                      updatedValues: { isShared: false },
                    },
                  ],
                }),
              ),
              EMPTY,
            ),
          ),
        ),
        catchError(() => of(ShareActions.revokeAccessFail())),
      );
    }),
  );

const revokeAccessSuccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ShareActions.revokeAccessSuccess.type),
    switchMap(({ payload }) => {
      if (!payload.isFolder && payload.featureType === FeatureType.Chat) {
        return of(
          ConversationsActions.updateConversationSuccess({
            id: payload.resourceId,
            conversation: {
              isShared: false,
            },
          }),
        );
      }
      if (payload.isFolder && payload.featureType === FeatureType.Chat) {
        return of(
          ConversationsActions.updateFolder({
            folderId: payload.resourceId,
            values: {
              isShared: false,
            },
          }),
        );
      }
      if (!payload.isFolder && payload.featureType === FeatureType.Prompt) {
        return of(
          PromptsActions.updatePromptSuccess({
            id: payload.resourceId,
            prompt: {
              isShared: false,
            },
          }),
        );
      }
      if (payload.isFolder && payload.featureType === FeatureType.Prompt) {
        return of(
          PromptsActions.updateFolder({
            folderId: payload.resourceId,
            values: {
              isShared: false,
            },
          }),
        );
      }

      if (payload.featureType === FeatureType.File) {
        return of(
          FilesActions.updateFileInfo({
            id: payload.resourceId,
            file: {
              isShared: false,
            },
          }),
        );
      }

      if (payload.featureType === FeatureType.Application) {
        const modelsMap = ModelsSelectors.selectModelsMap(state$.value);
        const applicationReference = modelsMap[payload.resourceId]?.reference;

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

      console.error(`Entity not updated: ${payload.resourceId}`);
      return EMPTY;
    }),
  );

const revokeAccessFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.revokeAccessFail.type),
    switchMap(() => {
      return of(
        UIActions.showErrorToast(translate(errorsMessages.revokeAccessFailed)),
      );
    }),
  );

const discardSharedWithMeEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.discardSharedWithMe.type),
    switchMap(({ payload }) => {
      const resourceUrls = payload.isFolder
        ? payload.resourceIds.map(
            (resourceId) => ApiUtils.encodeApiUrl(resourceId) + '/',
          )
        : payload.resourceIds.map((resourceId) =>
            ApiUtils.encodeApiUrl(resourceId),
          );

      return ShareService.shareDiscard(resourceUrls).pipe(
        switchMap(() => {
          if (!payload.isFolder && payload.featureType === FeatureType.File) {
            return EMPTY;
          }
          const actions: Observable<AppAction>[] = payload.resourceIds.map(
            (resourceId) =>
              of(
                ShareActions.discardSharedWithMeSuccess({
                  resourceId,
                  featureType: payload.featureType,
                  isFolder: payload.isFolder,
                }),
              ),
          );
          return concat(...actions);
        }),
        catchError(() => of(ShareActions.discardSharedWithMeFail())),
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
                names: [translate(DEFAULT_CONVERSATION_NAME)],
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

          of(MarketplaceActions.setDetailsModel()),
        );
      }

      console.error(`Entity not updated: ${payload.resourceId}`);
      return EMPTY;
    }),
  );

const discardSharedWithMeFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ShareActions.discardSharedWithMeFail.type),
    switchMap(() => {
      return of(
        UIActions.showErrorToast(
          translate(errorsMessages.discardSharedWithMeFailed),
        ),
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
              resourceId: folder.id,
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
