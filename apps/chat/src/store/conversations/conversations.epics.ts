import { PlotParams } from 'react-plotly.js';

import {
  EMPTY,
  Observable,
  Subject,
  TimeoutError,
  catchError,
  concat,
  concatMap,
  delay,
  filter,
  forkJoin,
  from,
  ignoreElements,
  iif,
  map,
  merge,
  mergeMap,
  of,
  startWith,
  switchMap,
  take,
  takeUntil,
  takeWhile,
  tap,
  throwError,
  timeout,
  zip,
} from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import { AnyAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import { clearStateForMessages } from '@/src/utils/app/clear-messages-state';
import {
  combineEntities,
  updateEntitiesFoldersAndIds,
} from '@/src/utils/app/common';
import {
  addPausedError,
  getConversationInfoFromId,
  getGeneratedConversationId,
  getNewConversationName,
  isChosenConversationValidForCompare,
  isSettingsChanged,
  regenerateConversationId,
  sortByDateAndName,
} from '@/src/utils/app/conversation';
import { ConversationService } from '@/src/utils/app/data/conversation-service';
import { FileService } from '@/src/utils/app/data/file-service';
import { getOrUploadConversation } from '@/src/utils/app/data/storages/api/conversation-api-storage';
import {
  addGeneratedFolderId,
  generateNextName,
  getFolderFromId,
  getFoldersFromIds,
  getNextDefaultName,
  getParentFolderIdsFromEntityId,
  getParentFolderIdsFromFolderId,
  splitEntityId,
  updateMovedEntityId,
  updateMovedFolderId,
} from '@/src/utils/app/folders';
import { getConversationRootId } from '@/src/utils/app/id';
import {
  mergeMessages,
  parseStreamMessages,
} from '@/src/utils/app/merge-streams';
import { isMediumScreen } from '@/src/utils/app/mobile';
import { updateSystemPromptInMessages } from '@/src/utils/app/overlay';
import {
  isEntityPublic,
  mapPublishedItems,
} from '@/src/utils/app/publications';
import { isEntityOrParentsExternal } from '@/src/utils/app/share';
import { filterUnfinishedStages } from '@/src/utils/app/stages';
import { translate } from '@/src/utils/app/translation';
import {
  getPublicItemIdWithoutVersion,
  parseConversationApiKey,
} from '@/src/utils/server/api';

import { ChatBody, Conversation, Playback, RateBody } from '@/src/types/chat';
import { EntityType, FeatureType } from '@/src/types/common';
import { FolderType } from '@/src/types/folder';
import { HTTPMethod } from '@/src/types/http';
import { AppEpic } from '@/src/types/store';

import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { ShareActions } from '@/src/store/share/share.reducers';

import { resetShareEntity } from '@/src/constants/chat';
import {
  DEFAULT_CONVERSATION_NAME,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
} from '@/src/constants/default-ui-settings';
import { errorsMessages } from '@/src/constants/errors';
import { defaultReplay } from '@/src/constants/replay';

import { AddonsActions } from '../addons/addons.reducers';
import { FilesActions } from '../files/files.reducers';
import { ModelsActions, ModelsSelectors } from '../models/models.reducers';
import { OverlaySelectors } from '../overlay/overlay.reducers';
import { PublicationActions } from '../publication/publication.reducers';
import { UIActions, UISelectors } from '../ui/ui.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from './conversations.reducers';

import {
  ConversationInfo,
  CustomVisualizerData,
  Message,
  MessageSettings,
  Role,
  UploadStatus,
} from '@epam/ai-dial-shared';
import omit from 'lodash-es/omit';
import uniq from 'lodash-es/uniq';

const initEpic: AppEpic = (action$) =>
  action$.pipe(
    filter((action) => ConversationsActions.init.match(action)),
    switchMap(() =>
      concat(
        of(ConversationsActions.initSelectedConversations()),
        of(ConversationsActions.initFoldersAndConversations()),
      ),
    ),
  );

const initSelectedConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.initSelectedConversations.match),
    takeUntil(action$.pipe(filter(ShareActions.acceptShareInvitation.match))),
    // use getSelectedConversations to load selected conversations, we can unsubscribe from this action if we try to accept a share link
    switchMap(() => {
      const isOverlay = SettingsSelectors.selectIsOverlay(state$.value);
      const optionsReceived = OverlaySelectors.selectOptionsReceived(
        state$.value,
      );

      return concat(
        iif(
          () => !isOverlay,
          of(ConversationsActions.getSelectedConversations()),
          EMPTY,
        ),
        iif(
          () => isOverlay && !!optionsReceived,
          of(ConversationsActions.getSelectedConversations()),
          EMPTY,
        ),
      );
    }),
  );

const getSelectedConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.getSelectedConversations.match),
    switchMap(() =>
      ConversationService.getSelectedConversationsIds().pipe(
        switchMap((selectedConversationsIds) => {
          const overlayConversationId =
            SettingsSelectors.selectOverlayConversationId(state$.value);

          const isOverlay = SettingsSelectors.selectIsOverlay(state$.value);

          const selectedIds =
            isOverlay && overlayConversationId
              ? [overlayConversationId]
              : selectedConversationsIds;

          if (!selectedIds.length) {
            return forkJoin({
              selectedConversations: of([]),
              selectedIds: of([]),
            });
          }
          return forkJoin({
            selectedConversations: zip(
              selectedIds.map((id) =>
                ConversationService.getConversation(
                  getConversationInfoFromId(id),
                ).pipe(
                  catchError((err) => {
                    console.error(
                      'The selected conversation was not found:',
                      err,
                    );
                    return of(null);
                  }),
                ),
              ),
            ),
            selectedIds: of(selectedIds),
          });
        }),
        map(({ selectedConversations, selectedIds }) => {
          const conversations = selectedConversations
            .filter(Boolean)
            .map((conv) => regenerateConversationId(conv!));
          if (!selectedIds.length || !conversations.length) {
            return {
              conversations: [],
              selectedConversationsIds: [],
            };
          }

          const existingSelectedConversationsIds = selectedIds.filter((id) =>
            conversations.some((conv) => conv.id === id),
          );

          return {
            conversations,
            selectedConversationsIds: existingSelectedConversationsIds,
          };
        }),
        switchMap(({ conversations, selectedConversationsIds }) => {
          const actions: Observable<AnyAction>[] = [];
          const isIsolatedView = SettingsSelectors.selectIsIsolatedView(
            state$.value,
          );

          // Always create new conversation in isolated view
          if (isIsolatedView) {
            const isolatedModelId = SettingsSelectors.selectIsolatedModelId(
              state$.value,
            );

            actions.push(
              of(
                ConversationsActions.createNewConversations({
                  names: [`isolated_${isolatedModelId}`],
                  shouldUploadConversationsForCompare: true,
                }),
              ),
            );
            return concat(...actions);
          }

          if (conversations.length) {
            actions.push(
              of(
                ConversationsActions.addConversations({
                  conversations: conversations.map((conv) => {
                    const isPublicConv = isEntityPublic(conv);

                    if (!isPublicConv) {
                      return conv;
                    }

                    const parsedApiKey = parseConversationApiKey(
                      splitEntityId(conv.id).name,
                      { parseVersion: true },
                    );

                    return {
                      ...conv,
                      name: parsedApiKey.name,
                      publicationInfo: parsedApiKey.publicationInfo,
                    };
                  }),
                }),
              ),
            );
            const paths = selectedConversationsIds.flatMap((id) =>
              getParentFolderIdsFromEntityId(id),
            );
            actions.push(
              of(
                UIActions.setOpenedFoldersIds({
                  openedFolderIds: paths,
                  featureType: FeatureType.Chat,
                }),
              ),
            );
          }
          actions.push(
            of(
              ConversationsActions.selectConversations({
                conversationIds: selectedConversationsIds,
              }),
            ),
          );
          if (!conversations.length) {
            actions.push(
              of(
                ConversationsActions.createNewConversations({
                  names: [translate(DEFAULT_CONVERSATION_NAME)],
                  shouldUploadConversationsForCompare: true,
                }),
              ),
            );
          }

          return concat(...actions);
        }),
      ),
    ),
  );

const initFoldersAndConversationsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.initFoldersAndConversations.match),
    switchMap(() =>
      ConversationService.getConversations(undefined, true).pipe(
        switchMap((conversations) => {
          const paths = uniq(
            conversations.flatMap((c) =>
              getParentFolderIdsFromFolderId(c.folderId),
            ),
          );

          return concat(
            of(
              ConversationsActions.addConversations({
                conversations,
              }),
            ),
            of(
              ConversationsActions.addFolders({
                folders: paths.map((path) => ({
                  ...getFolderFromId(path, FolderType.Chat),
                  status: UploadStatus.LOADED,
                })),
              }),
            ),
            of(ConversationsActions.initFoldersAndConversationsSuccess()),
            of(
              PublicationActions.uploadPublishedWithMeItems({
                featureType: FeatureType.Chat,
              }),
            ),
          );
        }),
        catchError((err) => {
          console.error('Error during upload conversations and folders', err);
          return of(ConversationsActions.uploadConversationsFail());
        }),
      ),
    ),
  );

const createNewConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.createNewConversations.match),
    map(({ payload }) => ({
      names: payload.names,
      folderId: payload.folderId,
      lastConversation: ConversationsSelectors.selectLastConversation(
        state$.value,
      ),
      conversations: ConversationsSelectors.selectConversations(state$.value),
      shouldUploadConversationsForCompare:
        payload.shouldUploadConversationsForCompare,
      modelReference: payload.modelReference,
    })),
    switchMap(
      ({
        names,
        folderId,
        lastConversation,
        conversations,
        shouldUploadConversationsForCompare,
        modelReference,
      }) =>
        forkJoin({
          modelReference: of(modelReference),
          names: of(names),
          folderId: of(folderId),
          lastConversation:
            lastConversation && lastConversation.status !== UploadStatus.LOADED
              ? ConversationService.getConversation(lastConversation).pipe(
                  catchError((err) => {
                    console.error(
                      'The last used conversation was not found:',
                      err,
                    );
                    return of(null);
                  }),
                )
              : (of(lastConversation) as Observable<Conversation>),
          conversations: shouldUploadConversationsForCompare
            ? ConversationService.getConversations().pipe(
                catchError((err) => {
                  console.error(
                    'The conversations were not upload successfully:',
                    err,
                  );
                  return of([]);
                }),
              )
            : of(conversations),
        }),
    ),
    switchMap(
      ({
        names,
        lastConversation,
        conversations,
        modelReference,
        folderId,
      }) => {
        return state$.pipe(
          startWith(state$.value),
          map((state) => {
            const isIsolatedView =
              SettingsSelectors.selectIsIsolatedView(state);
            const isolatedModelId =
              SettingsSelectors.selectIsolatedModelId(state);
            if (isIsolatedView && isolatedModelId) {
              const models = ModelsSelectors.selectModels(state);
              return models.filter((i) => i?.reference === isolatedModelId)[0]
                ?.reference;
            }

            if (modelReference) {
              return modelReference;
            }

            const recentModels = ModelsSelectors.selectRecentModels(state);
            if (lastConversation?.model.id) {
              const lastModelId = lastConversation.model.id;
              const models = ModelsSelectors.selectModels(state);
              return [
                ...models.filter((i) => i?.reference === lastModelId),
                ...recentModels,
              ][0]?.reference;
            }

            return recentModels[0]?.reference;
          }),
          filter(Boolean),
          take(1),
          switchMap((modelReference) => {
            if (!modelReference) {
              return EMPTY;
            }
            const conversationFolderId = folderId ?? getConversationRootId();
            const newConversations: Conversation[] = names.map(
              (name, index): Conversation =>
                regenerateConversationId({
                  name:
                    name !== DEFAULT_CONVERSATION_NAME
                      ? name
                      : getNextDefaultName(
                          DEFAULT_CONVERSATION_NAME,
                          conversations.filter(
                            (conv) => conv.folderId === conversationFolderId, // only my root conversations
                          ),
                          index,
                        ),
                  messages: [],
                  model: {
                    id: modelReference,
                  },
                  prompt: DEFAULT_SYSTEM_PROMPT,
                  temperature:
                    lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
                  selectedAddons: [],
                  lastActivityDate: Date.now(),
                  status: UploadStatus.LOADED,
                  folderId: conversationFolderId,
                }),
            );

            return zip(
              newConversations.map((info) =>
                ConversationService.createConversation(info),
              ),
            ).pipe(
              switchMap((conversations) => {
                const newNames = newConversations.map((c) => c.name);
                const apiNames = conversations
                  .filter(Boolean)
                  .map((c) => (c as Conversation).name);

                return concat(
                  iif(
                    // check if something renamed
                    () => apiNames.some((name) => !newNames.includes(name)),
                    concat(
                      of(
                        ConversationsActions.uploadConversationsWithFoldersRecursive(),
                      ),
                      of(
                        ShareActions.triggerGettingSharedConversationListings(),
                      ),
                    ),
                    concat(
                      of(
                        ConversationsActions.addConversations({
                          conversations: newConversations,
                        }),
                      ),
                      of(
                        ConversationsActions.selectConversations({
                          conversationIds: newConversations.map((c) => c.id),
                        }),
                      ),
                    ),
                  ),
                  of(
                    ConversationsActions.setIsActiveConversationRequest(false),
                  ),
                );
              }),
              catchError((err) => {
                console.error("New conversation wasn't created: ", err);
                return concat(
                  of(
                    UIActions.showErrorToast(
                      translate(
                        'An error occurred while creating a new conversation. Most likely the conversation already exists. Please refresh the page.',
                      ),
                    ),
                  ),
                  of(
                    ConversationsActions.setIsActiveConversationRequest(false),
                  ),
                );
              }),
            );
          }),
        );
      },
    ),
  );

const createNewReplayConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.createNewReplayConversation.match),
    switchMap(({ payload }) =>
      forkJoin({
        conversationAndPayload: getOrUploadConversation(payload, state$.value),
        conversations: of(
          ConversationsSelectors.selectConversations(state$.value),
        ),
      }),
    ),
    switchMap(({ conversationAndPayload, conversations }) => {
      const { conversation } = conversationAndPayload;
      if (!conversation)
        return of(
          UIActions.showErrorToast(
            translate(
              'It looks like this conversation has been deleted. Please reload the page',
            ),
          ),
        );

      const folderId = ConversationsSelectors.hasExternalParent(
        state$.value,
        conversation.folderId,
      )
        ? getConversationRootId()
        : conversation.folderId;

      const newConversationName = getNextDefaultName(
        `[Replay] ${conversation.name}`,
        conversations.filter((conv) => conv.folderId === folderId), //only conversations in the same folder
        0,
        true,
      );

      const userMessages = conversation.messages.filter(
        ({ role }) => role === Role.User,
      );
      const newConversation: Conversation = regenerateConversationId({
        ...conversation,
        ...resetShareEntity,
        folderId,
        name: newConversationName,
        messages: [],
        lastActivityDate: Date.now(),

        replay: {
          isReplay: true,
          replayUserMessagesStack: userMessages,
          activeReplayIndex: 0,
          replayAsIs: true,
        },
        isReplay: true,
        isPlayback: false,
        playback: undefined,
      });

      return of(
        ConversationsActions.saveNewConversation({
          newConversation,
        }),
      );
    }),
  );

const createNewPlaybackConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.createNewPlaybackConversation.match),
    switchMap(({ payload }) =>
      forkJoin({
        conversationAndPayload: getOrUploadConversation(payload, state$.value),
        conversations: of(
          ConversationsSelectors.selectConversations(state$.value),
        ),
      }),
    ),
    switchMap(({ conversationAndPayload, conversations }) => {
      const { conversation } = conversationAndPayload;
      if (!conversation)
        return of(
          UIActions.showErrorToast(
            translate(
              'It looks like this conversation has been deleted. Please reload the page',
            ),
          ),
        );

      const folderId = ConversationsSelectors.hasExternalParent(
        state$.value,
        conversation.folderId,
      )
        ? getConversationRootId()
        : conversation.folderId;

      const newConversationName = getNextDefaultName(
        `[Playback] ${conversation.name}`,
        conversations.filter((conv) => conv.folderId === folderId), //only conversations in the same folder
        0,
        true,
      );

      const newConversation: Conversation = regenerateConversationId({
        ...conversation,
        ...resetShareEntity,
        folderId,
        name: newConversationName,
        messages: [],
        lastActivityDate: Date.now(),

        playback: {
          messagesStack: conversation.messages.filter(
            (m) => m.role !== Role.System,
          ),
          activePlaybackIndex: 0,
          isPlayback: true,
        },
        isReplay: false,
        isPlayback: true,
      });

      return of(
        ConversationsActions.saveNewConversation({
          newConversation,
        }),
      );
    }),
  );

const duplicateConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.duplicateConversation.match),
    switchMap(({ payload }) =>
      forkJoin({
        conversation: getOrUploadConversation(payload, state$.value).pipe(
          map((data) => data.conversation),
        ),
      }),
    ),
    switchMap(({ conversation }) => {
      if (!conversation) {
        return of(
          UIActions.showErrorToast(
            translate(
              'It looks like this conversation has been deleted. Please reload the page',
            ),
          ),
        );
      }

      const conversations = ConversationsSelectors.selectConversations(
        state$.value,
      );
      const conversationFolderId = isEntityOrParentsExternal(
        state$.value,
        conversation,
        FeatureType.Chat,
      )
        ? getConversationRootId() // duplicate external entities in the root only
        : conversation.folderId;

      const newConversation: Conversation = regenerateConversationId({
        ...omit(conversation, ['publicationInfo']),
        ...resetShareEntity,
        folderId: conversationFolderId,
        name: generateNextName(
          DEFAULT_CONVERSATION_NAME,
          conversation.name,
          conversations.filter((c) => c.folderId === conversationFolderId), // only root conversations for external entities
        ),
        lastActivityDate: Date.now(),
      });

      newConversation.id = conversation.publicationInfo?.version
        ? getPublicItemIdWithoutVersion(
            conversation.publicationInfo.version,
            newConversation.id,
          )
        : newConversation.id;

      return of(
        ConversationsActions.saveNewConversation({
          newConversation,
          selectedIdToReplaceWithNewOne: conversation.id,
        }),
      );
    }),
  );

const createNewConversationsSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.createNewConversations.match),
    switchMap(() =>
      merge(
        of(ModelsActions.getModels()),
        of(AddonsActions.getAddons()),
        of(ConversationsActions.resetChosenConversations()),
      ),
    ),
  );

const saveNewConversationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.saveNewConversation.match),
    mergeMap(({ payload }) =>
      ConversationService.createConversation(payload.newConversation).pipe(
        switchMap(() =>
          of(ConversationsActions.saveNewConversationSuccess(payload)),
        ),
        catchError((err) => {
          console.error(err);
          return of(
            UIActions.showErrorToast(
              translate(
                'An error occurred while saving the conversation. Most likely the conversation already exists. Please refresh the page.',
              ),
            ),
          );
        }),
      ),
    ),
  );

const deleteFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.deleteFolder.match),
    switchMap(({ payload }) =>
      forkJoin({
        folderId: of(payload.folderId),
        conversations: ConversationService.getConversations(
          payload.folderId,
          true,
        ).pipe(
          catchError((err) => {
            console.error('Error during delete folder:', err);
            return of([]);
          }),
        ),
        folders: of(ConversationsSelectors.selectFolders(state$.value)),
      }),
    ),
    switchMap(({ folderId, conversations, folders }) => {
      const actions: Observable<AnyAction>[] = [];
      const conversationIds = conversations.map((conv) => conv.id);

      if (conversationIds.length) {
        actions.push(
          of(ConversationsActions.deleteConversations({ conversationIds })),
        );
      } else
        actions.push(
          of(
            ConversationsActions.deleteConversationsComplete({
              conversationIds: new Set([]),
            }),
          ),
        );

      return concat(
        of(
          ConversationsActions.setFolders({
            folders: folders.filter(
              (folder) =>
                folder.id !== folderId && !folder.id.startsWith(`${folderId}/`),
            ),
          }),
        ),
        ...actions,
      );
    }),
  );

const updateFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.updateFolder.match),
    switchMap(({ payload }) => {
      const folder = getFolderFromId(payload.folderId, FolderType.Chat);

      const newFolder = addGeneratedFolderId({ ...folder, ...payload.values });

      if (payload.folderId === newFolder.id) {
        return EMPTY;
      }

      return ConversationService.getConversations(payload.folderId, true).pipe(
        switchMap((conversations) => {
          const updateFolderId = updateMovedFolderId.bind(
            null,
            payload.folderId,
            newFolder.id,
          );
          const updateEntityId = updateMovedEntityId.bind(
            null,
            payload.folderId,
            newFolder.id,
          );

          const folders = ConversationsSelectors.selectFolders(state$.value);
          const allConversations = ConversationsSelectors.selectConversations(
            state$.value,
          );
          const openedFoldersIds = UISelectors.selectOpenedFoldersIds(
            state$.value,
            FeatureType.Chat,
          );
          const selectedConversationsIds =
            ConversationsSelectors.selectSelectedConversationsIds(state$.value);

          const { updatedFolders, updatedOpenedFoldersIds } =
            updateEntitiesFoldersAndIds(
              conversations,
              folders,
              updateFolderId,
              openedFoldersIds,
            );

          const updatedConversations = combineEntities(
            allConversations.map((conv) =>
              regenerateConversationId({
                ...conv,
                folderId: updateFolderId(conv.folderId),
              }),
            ),
            conversations.map((conv) =>
              regenerateConversationId({
                ...conv,
                folderId: updateFolderId(conv.folderId),
              }),
            ),
          );

          const updatedSelectedConversationsIds = selectedConversationsIds.map(
            (id) => updateEntityId(id),
          );

          const actions: Observable<AnyAction>[] = [];
          if (conversations.length) {
            conversations.forEach((conversation) => {
              actions.push(
                of(
                  ConversationsActions.updateConversation({
                    id: conversation.id,
                    values: {
                      folderId: updateFolderId(conversation.folderId),
                    },
                  }),
                ),
              );
            });
          }
          actions.push(
            of(
              ConversationsActions.updateFolderSuccess({
                folders: updatedFolders,
                conversations: updatedConversations,
                selectedConversationsIds: updatedSelectedConversationsIds,
              }),
            ),
            of(
              UIActions.setOpenedFoldersIds({
                openedFolderIds: updatedOpenedFoldersIds,
                featureType: FeatureType.Chat,
              }),
            ),
          );

          return concat(...actions);
        }),
        catchError((err) => {
          console.error('Error during upload conversations and folders', err);
          return of(ConversationsActions.uploadConversationsFail());
        }),
      );
    }),
  );

const clearConversationsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.clearConversations.match),
    switchMap(() => {
      return concat(
        of(ConversationsActions.clearConversationsSuccess()),
        of(ConversationsActions.deleteFolder({})),
      );
    }),
  );

const deleteConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.deleteConversations.match),
    map(({ payload }) => ({
      conversations: ConversationsSelectors.selectConversations(state$.value),
      selectedConversationsIds:
        ConversationsSelectors.selectSelectedConversationsIds(state$.value),
      conversationIds: new Set(payload.conversationIds),
      suppressErrorMessage: payload.suppressErrorMessage || false,
    })),
    switchMap(
      ({
        conversations,
        selectedConversationsIds,
        conversationIds,
        suppressErrorMessage,
      }) => {
        const otherConversations = conversations.filter(
          (conv) => !conversationIds.has(conv.id),
        );

        const newSelectedConversationsIds = selectedConversationsIds.filter(
          (id) => !conversationIds.has(id),
        );

        const actions: Observable<AnyAction>[] = [];

        const isIsolatedView = SettingsSelectors.selectIsIsolatedView(
          state$.value,
        );

        // No need to recreate conversation for isolated view
        if (!isIsolatedView) {
          if (otherConversations.length === 0) {
            actions.push(
              of(
                ConversationsActions.createNewConversations({
                  names: [translate(DEFAULT_CONVERSATION_NAME)],
                  suspendHideSidebar: isMediumScreen(),
                }),
              ),
            );
          } else if (newSelectedConversationsIds.length === 0) {
            actions.push(
              of(
                ConversationsActions.selectConversations({
                  conversationIds: [
                    sortByDateAndName(otherConversations)[0].id,
                  ],
                  suspendHideSidebar: isMediumScreen(),
                }),
              ),
            );
          } else if (
            newSelectedConversationsIds.length !==
            selectedConversationsIds.length
          ) {
            actions.push(
              of(
                ConversationsActions.selectConversations({
                  conversationIds: newSelectedConversationsIds,
                  suspendHideSidebar: isMediumScreen(),
                }),
              ),
            );
          }
        }

        return concat(
          ...actions,
          zip(
            Array.from(conversationIds).map((id) =>
              ConversationService.deleteConversation(
                getConversationInfoFromId(id),
              ).pipe(
                map(() => null),
                catchError((err) => {
                  const { name } = getConversationInfoFromId(id);
                  !suppressErrorMessage &&
                    console.error(`Error during deleting "${name}"`, err);
                  return of(name);
                }),
              ),
            ),
          ).pipe(
            switchMap((failedNames) =>
              concat(
                iif(
                  () =>
                    failedNames.filter(Boolean).length > 0 &&
                    !suppressErrorMessage,
                  of(
                    UIActions.showErrorToast(
                      translate(
                        `An error occurred while deleting the conversation(s): "${failedNames.filter(Boolean).join('", "')}"`,
                      ),
                    ),
                  ),
                  EMPTY,
                ),
                of(
                  ConversationsActions.deleteConversationsComplete({
                    conversationIds,
                  }),
                ),
              ),
            ),
          ),
        );
      },
    ),
  );

const rateMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.rateMessage.match),
    map(({ payload }) => ({
      payload,
      conversations: ConversationsSelectors.selectConversations(state$.value),
    })),
    switchMap(({ conversations, payload }) => {
      const conversation = conversations.find(
        (conv) => conv.id === payload.conversationId,
      );
      if (!conversation) {
        return of(
          ConversationsActions.rateMessageFail({
            error: translate(
              'No conversation exists for rating with provided conversation id',
            ),
          }),
        );
      }
      const message = (conversation as Conversation).messages[
        payload.messageIndex
      ];

      if (!message || !message.responseId) {
        return of(
          ConversationsActions.rateMessageFail({
            error: translate('Message cannot be rated'),
          }),
        );
      }

      const rateBody: RateBody = {
        responseId: message.responseId,
        modelId: conversation.model.id,
        id: conversation.id,
        value: payload.rate > 0 ? true : false,
      };

      return fromFetch('api/rate', {
        method: HTTPMethod.POST,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rateBody),
      }).pipe(
        switchMap((resp) => {
          if (!resp.ok) {
            return throwError(() => resp);
          }
          return from(resp.json());
        }),
        map(() => {
          return ConversationsActions.rateMessageSuccess(payload);
        }),
        catchError((e: Response) => {
          return of(
            ConversationsActions.rateMessageFail({
              error: e,
            }),
          );
        }),
      );
    }),
  );

const updateMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.updateMessage.match),
    map(({ payload }) => ({
      payload,
      conversations: ConversationsSelectors.selectConversations(state$.value),
    })),
    switchMap(({ conversations, payload }) => {
      const conversation = conversations.find(
        (conv) => conv.id === payload.conversationId,
      ) as Conversation;
      if (!conversation || !conversation.messages[payload.messageIndex]) {
        return EMPTY;
      }

      const actions = [];
      const messages = [...conversation.messages];
      messages[payload.messageIndex] = {
        ...messages[payload.messageIndex],
        ...payload.values,
      };

      actions.push(
        of(
          ConversationsActions.updateConversation({
            id: payload.conversationId,
            values: {
              messages: [...messages],
            },
          }),
        ),
      );
      const attachments =
        messages[payload.messageIndex].custom_content?.attachments;

      if (attachments) {
        const attachmentParentFolders = uniq(
          attachments
            .map(
              (attachment) =>
                attachment.url &&
                getParentFolderIdsFromEntityId(
                  decodeURIComponent(attachment.url),
                ),
            )
            .filter(Boolean),
        ).flat();

        if (attachmentParentFolders.length) {
          actions.push(
            of(
              FilesActions.updateFoldersStatus({
                foldersIds: attachmentParentFolders,
                status: UploadStatus.UNINITIALIZED,
              }),
            ),
          );
        }
      }

      return concat(...actions);
    }),
  );

const rateMessageSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.rateMessageSuccess.match),
    switchMap(({ payload }) => {
      return of(
        ConversationsActions.updateMessage({
          conversationId: payload.conversationId,
          messageIndex: payload.messageIndex,
          values: {
            like: payload.rate,
          },
        }),
      );
    }),
  );

const sendMessagesEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.sendMessages.match),
    switchMap(({ payload }) => {
      return concat(
        of(ConversationsActions.createAbortController()),
        ...payload.conversations.map((conv) => {
          return of(
            ConversationsActions.sendMessage({
              conversation: conv,
              message: payload.message,
              deleteCount: payload.deleteCount,
              activeReplayIndex: payload.activeReplayIndex,
            }),
          );
        }),
      );
    }),
  );

const sendMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.sendMessage.match),
    map(({ payload }) => ({
      payload,
      modelsMap: ModelsSelectors.selectModelsMap(state$.value),
      conversations: ConversationsSelectors.selectConversations(state$.value),
      selectedConversationIds:
        ConversationsSelectors.selectSelectedConversationsIds(state$.value),
      overlaySystemPrompt: OverlaySelectors.selectOverlaySystemPrompt(
        state$.value,
      ),
      isOverlay: SettingsSelectors.selectIsOverlay(state$.value),
    })),
    map(
      ({
        payload,
        modelsMap,
        conversations,
        selectedConversationIds,
        overlaySystemPrompt,
        isOverlay,
      }) => {
        const messageModel: Message[EntityType.Model] = {
          id: payload.conversation.model.id,
        };
        const messageSettings: Message['settings'] = {
          prompt: payload.conversation.prompt,
          temperature: payload.conversation.temperature,
          selectedAddons: payload.conversation.selectedAddons,
          assistantModelId: payload.conversation.assistantModelId,
        };

        const assistantMessage: Message = {
          content: '',
          model: messageModel,
          settings: messageSettings,
          role: Role.Assistant,
        };

        const userMessage: Message = {
          ...payload.message,
          model: messageModel,
          settings: messageSettings,
        };

        let currentMessages =
          payload.deleteCount > 0
            ? payload.conversation.messages.slice(
                0,
                payload.deleteCount * -1 || undefined,
              )
            : payload.conversation.messages;

        /*
          Overlay needs to share host application state information
          We storing state information in systemPrompt (message with role: Role.System)
        */
        if (isOverlay && overlaySystemPrompt) {
          currentMessages = updateSystemPromptInMessages(
            currentMessages,
            overlaySystemPrompt,
          );
        }

        const updatedMessages = currentMessages.concat(
          userMessage,
          assistantMessage,
        );

        const newConversationName =
          payload.conversation.replay?.isReplay ||
          updatedMessages.filter((msg) => msg.role === Role.User).length > 1 ||
          payload.conversation.isNameChanged
            ? payload.conversation.name
            : getNextDefaultName(
                getNewConversationName(payload.conversation, payload.message),
                conversations.filter(
                  (conv) =>
                    conv.folderId === payload.conversation.folderId &&
                    !selectedConversationIds.includes(conv.id),
                ),
                Math.max(
                  selectedConversationIds.indexOf(payload.conversation.id),
                  0,
                ),
                true,
              );

        const updatedConversation: Conversation = regenerateConversationId({
          ...payload.conversation,
          lastActivityDate: Date.now(),
          replay: payload.conversation.replay
            ? {
                ...payload.conversation.replay,
                activeReplayIndex: payload.activeReplayIndex,
              }
            : undefined,
          messages: updatedMessages,
          name: newConversationName,
          isMessageStreaming: true,
        });

        return {
          oldConversationId: payload.conversation.id,
          updatedConversation,
          modelsMap,
          assistantMessage,
        };
      },
    ),
    switchMap(
      ({
        oldConversationId,
        modelsMap,
        updatedConversation,
        assistantMessage,
      }) => {
        return concat(
          of(
            ConversationsActions.updateConversation({
              id: oldConversationId,
              values: updatedConversation,
            }),
          ),
          of(
            ModelsActions.updateRecentModels({
              modelId: updatedConversation.model.id,
              rearrange: true,
            }),
          ),
          iif(
            () =>
              updatedConversation.selectedAddons.length > 0 &&
              modelsMap[updatedConversation.model.id]?.type !==
                EntityType.Application,
            of(
              AddonsActions.updateRecentAddons({
                addonIds: updatedConversation.selectedAddons,
              }),
            ),
            EMPTY,
          ),
          of(
            ConversationsActions.streamMessage({
              conversation: updatedConversation,
              message: assistantMessage,
            }),
          ),
        );
      },
    ),
  );

const streamMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.streamMessage.match),
    map(({ payload }) => ({
      payload,
      modelsMap: ModelsSelectors.selectModelsMap(state$.value),
    })),
    map(({ payload, modelsMap }) => {
      const lastModel = modelsMap[payload.conversation.model.id];
      const selectedAddons = uniq([
        ...payload.conversation.selectedAddons,
        ...(lastModel?.selectedAddons ?? []),
      ]);
      const assistantModelId = payload.conversation.assistantModelId;
      const conversationModelType = lastModel?.type ?? EntityType.Model;
      let modelAdditionalSettings = {};

      if (conversationModelType === EntityType.Model) {
        modelAdditionalSettings = {
          prompt: lastModel?.features?.systemPrompt
            ? payload.conversation.prompt
            : undefined,
          temperature: payload.conversation.temperature,
          selectedAddons,
        };
      }
      if (conversationModelType === EntityType.Assistant && assistantModelId) {
        modelAdditionalSettings = {
          assistantModelId,
          temperature: payload.conversation.temperature,
          selectedAddons,
        };
      }

      const chatBody: ChatBody = {
        modelId: payload.conversation.model.id,
        messages: payload.conversation.messages
          .filter(
            (message, index) =>
              message.role !== Role.Assistant ||
              index !== payload.conversation.messages.length - 1,
          )
          .map((message) => ({
            content: message.content,
            role: message.role,
            like: void 0,
            ...((message.custom_content?.state ||
              message.custom_content?.attachments) && {
              custom_content: {
                state: message.custom_content?.state,
                attachments: message.custom_content?.attachments,
              },
            }),
          })),
        id: payload.conversation.id,
        ...modelAdditionalSettings,
      };

      return {
        payload,
        chatBody,
      };
    }),
    mergeMap(({ payload, chatBody }) => {
      const conversationSignal =
        ConversationsSelectors.selectConversationSignal(state$.value);
      const decoder = new TextDecoder();
      let eventData = '';
      let message = payload.message;

      return from(
        fetch('api/chat', {
          method: HTTPMethod.POST,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chatBody),
          signal: conversationSignal.signal,
        }),
      ).pipe(
        switchMap((response) => {
          const body = response.body;

          if (!response.ok) {
            return throwError(
              () => new Error('ServerError', { cause: response }),
            );
          }
          if (!body) {
            return throwError(() => new Error('No body received'));
          }

          const reader = body.getReader();
          const subj = new Subject<ReadableStreamReadResult<Uint8Array>>();
          const observable = subj.asObservable();
          const observer = async () => {
            try {
              // eslint-disable-next-line no-constant-condition
              while (true) {
                const val = await reader.read();

                subj.next(val);
                if (val.done) {
                  subj.complete();
                  break;
                }
              }
            } catch (e) {
              subj.error(e);
              subj.complete();
            }
          };
          observer();
          return observable;
        }),
        // TODO: get rid of this https://github.com/epam/ai-dial-chat/issues/115
        timeout(120000),
        mergeMap((resp) =>
          iif(
            () => resp.done,
            concat(
              of(
                ConversationsActions.updateConversation({
                  id: payload.conversation.id,
                  values: {
                    isMessageStreaming: false,
                  },
                }),
              ),
              of(ConversationsActions.streamMessageSuccess()),
            ),
            of(resp).pipe(
              tap((resp) => {
                const decodedValue = decoder.decode(resp.value);
                eventData += decodedValue;
              }),
              filter(() => eventData[eventData.length - 1] === '\0'),
              map((resp) => {
                const chunkValue = parseStreamMessages(eventData);
                return {
                  updatedMessage: mergeMessages(message, chunkValue),
                  isCompleted: resp.done,
                };
              }),
              tap(({ updatedMessage }) => {
                eventData = '';
                message = updatedMessage;
              }),
              map(({ updatedMessage }) =>
                ConversationsActions.updateMessage({
                  conversationId: payload.conversation.id,
                  messageIndex: payload.conversation.messages.length - 1,
                  values: updatedMessage,
                }),
              ),
            ),
          ),
        ),
        catchError((error: Error) => {
          if (error.name === 'AbortError') {
            return of(
              ConversationsActions.updateConversation({
                id: payload.conversation.id,
                values: {
                  isMessageStreaming: false,
                },
              }),
            );
          }

          if (error instanceof TimeoutError) {
            return of(
              ConversationsActions.streamMessageFail({
                conversation: payload.conversation,
                message: translate(errorsMessages.timeoutError),
              }),
            );
          }

          if (error.message === 'ServerError') {
            return of(
              ConversationsActions.streamMessageFail({
                conversation: payload.conversation,
                message:
                  (!!error.cause &&
                    (error.cause as { message?: string }).message) ||
                  translate(errorsMessages.generalServer),
                response:
                  error.cause instanceof Response ? error.cause : undefined,
              }),
            );
          }

          return of(
            ConversationsActions.streamMessageFail({
              conversation: payload.conversation,
              message: translate(errorsMessages.generalClient),
            }),
          );
        }),
      );
    }),
  );

const streamMessageFailEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.streamMessageFail.match),
    switchMap(({ payload }) => {
      return (
        payload.response ? from(payload.response.json()) : of(undefined)
      ).pipe(
        map((response: { message: string } | undefined) => ({
          payload,
          responseJSON: response,
        })),
      );
    }),
    switchMap(({ payload, responseJSON }) => {
      if (payload.response?.status === 401) {
        window.location.assign('api/auth/signin');
        return EMPTY;
      }

      const isReplay =
        ConversationsSelectors.selectIsReplaySelectedConversations(
          state$.value,
        );

      const errorMessage = responseJSON?.message || payload.message;

      const messages = [...payload.conversation.messages];
      messages[messages.length - 1] = {
        ...messages[messages.length - 1],
        errorMessage,
      };

      const values: Partial<Conversation> = {
        isMessageStreaming: false,
        messages: [...messages],
      };
      if (isReplay) {
        values.replay = {
          ...defaultReplay,
          ...payload.conversation.replay,
          isError: true,
        };
      }

      return concat(
        of(
          ConversationsActions.updateConversation({
            id: payload.conversation.id,
            values,
          }),
        ),
        isReplay ? of(ConversationsActions.stopReplayConversation()) : EMPTY,
        of(UIActions.showErrorToast(translate(errorMessage))),
        of(
          ConversationsActions.updateMessage({
            conversationId: payload.conversation.id,
            messageIndex: payload.conversation.messages.length - 1,
            values: {
              errorMessage,
            },
          }),
        ),
      );
    }),
  );

const stopStreamMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.stopStreamMessage.match),
    tap(() => {
      const conversationSignal =
        ConversationsSelectors.selectConversationSignal(state$.value);

      if (!conversationSignal.signal.aborted) {
        conversationSignal.abort();
      }
    }),
    switchMap(() => {
      const isReplay =
        ConversationsSelectors.selectIsReplaySelectedConversations(
          state$.value,
        );
      return isReplay
        ? of(ConversationsActions.stopReplayConversation())
        : EMPTY;
    }),
  );

const cleanMessagesEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.stopStreamMessage.match),
    map(() => ({
      selectedConversations: ConversationsSelectors.selectSelectedConversations(
        state$.value,
      ),
      selectedModels: ConversationsSelectors.selectSelectedConversationsModels(
        state$.value,
      ),
    })),
    switchMap(({ selectedConversations, selectedModels }) => {
      return concat(
        ...selectedConversations.map((conv) => {
          return of(
            ConversationsActions.updateConversation({
              id: conv.id,
              values: {
                messages: addPausedError(
                  conv,
                  selectedModels,
                  filterUnfinishedStages(conv.messages),
                ),
              },
            }),
          );
        }),
      );
    }),
  );

const deleteMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.deleteMessage.match),
    map(({ payload }) => ({
      payload,
      selectedConversations: ConversationsSelectors.selectSelectedConversations(
        state$.value,
      ),
    })),
    switchMap(({ payload, selectedConversations }) => {
      return concat(
        ...selectedConversations.map((conv) => {
          const { messages } = conv;
          let newMessages = [];

          if (
            payload.index < messages.length - 1 &&
            messages[payload.index + 1].role === Role.Assistant
          ) {
            newMessages = messages.filter(
              (message, index) =>
                index !== payload.index && index !== payload.index + 1,
            );
          } else {
            newMessages = messages.filter(
              (message, index) => index !== payload.index,
            );
          }

          return of(
            ConversationsActions.updateConversation({
              id: conv.id,
              values: {
                messages: newMessages,
              },
            }),
          );
        }),
      );
    }),
  );

const replayConversationsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.replayConversations.match),
    switchMap(({ payload }) => {
      return concat(
        of(ConversationsActions.createAbortController()),
        ...payload.conversationsIds.map((id) => {
          return of(
            ConversationsActions.replayConversation({
              ...payload,
              conversationId: id,
              activeReplayIndex: 0,
            }),
          );
        }),
      );
    }),
  );

const replayConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.replayConversation.match),
    map(({ payload }) => ({
      payload,
      conversation: ConversationsSelectors.selectConversation(
        state$.value,
        payload.conversationId,
      ) as Conversation,
    })),
    filter(({ conversation }) => !!conversation),
    switchMap(({ payload, conversation }) => {
      const conv = conversation as Conversation;
      const messagesStack = conv.replay?.replayUserMessagesStack;

      if (
        !messagesStack ||
        conv.replay?.activeReplayIndex === messagesStack.length
      ) {
        return of(
          ConversationsActions.endReplayConversation({
            conversationId: payload.conversationId,
          }),
        );
      }
      const activeMessage = messagesStack[conv.replay?.activeReplayIndex ?? 0];

      if (Object.keys(activeMessage.templateMapping ?? {}).length) {
        return concat(
          of(ConversationsActions.setIsReplayRequiresVariables(true)),
          of(ConversationsActions.stopReplayConversation()),
        );
      }

      let updatedConversation: Conversation = conv;

      if (
        conv.replay?.replayAsIs &&
        activeMessage.model &&
        activeMessage.model.id
      ) {
        const { prompt, temperature, selectedAddons, assistantModelId } =
          activeMessage.settings ? activeMessage.settings : conv;

        const newConversationSettings: MessageSettings = {
          prompt,
          temperature,
          selectedAddons,
          assistantModelId,
        };

        const model =
          ModelsSelectors.selectModel(state$.value, activeMessage.model.id) ??
          conv.model;

        const messages =
          conv.model.id !== model.id ||
          isSettingsChanged(conv, newConversationSettings)
            ? clearStateForMessages(conv.messages)
            : conv.messages;

        updatedConversation = regenerateConversationId({
          ...conv,
          model: model,
          messages,
          replay: {
            ...conv.replay,
            isError: false,
          },
          ...newConversationSettings,
        });
      }

      return concat(
        of(
          ConversationsActions.sendMessage({
            conversation: updatedConversation,
            deleteCount: payload.isRestart
              ? (conversation?.messages.length &&
                  (conversation.messages[conversation.messages.length - 1]
                    .role === Role.Assistant
                    ? 2
                    : 1)) ||
                0
              : 0,
            activeReplayIndex:
              updatedConversation.replay?.activeReplayIndex ?? 0,
            message: activeMessage,
          }),
        ),
        action$.pipe(
          takeWhile(() => {
            return !ConversationsSelectors.selectIsReplayPaused(state$.value);
          }),
          filter(ConversationsActions.streamMessageSuccess.match),
          filter(() => {
            return !ConversationsSelectors.selectIsConversationsStreaming(
              state$.value,
            );
          }),
          switchMap(() => {
            const convReplay = (
              ConversationsSelectors.selectConversation(
                state$.value,
                conv.id,
              ) as Conversation
            ).replay;

            return of(
              ConversationsActions.replayConversation({
                conversationId: updatedConversation.id,
                activeReplayIndex: (convReplay?.activeReplayIndex ?? 0) + 1,
              }),
            );
          }),
        ),
        action$.pipe(
          takeWhile(() => {
            return !ConversationsSelectors.selectIsReplayPaused(state$.value);
          }),
          filter(ConversationsActions.streamMessageFail.match),
          switchMap(() => {
            return of(ConversationsActions.stopReplayConversation());
          }),
        ),
      );
    }),
  );

const endReplayConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.endReplayConversation.match),
    map(() => ({
      selectedConversations: ConversationsSelectors.selectSelectedConversations(
        state$.value,
      ),
    })),
    switchMap(({ selectedConversations }) => {
      return concat(
        ...selectedConversations.map((conv) => {
          return of(
            ConversationsActions.updateConversation({
              id: conv.id,
              values: {
                isReplay: false,
                replay: {
                  ...conv.replay,
                  isReplay: false,
                  replayAsIs: false,
                },
              },
            }),
          );
        }),
      );
    }),
  );

const saveFoldersEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        ConversationsActions.createFolder.match(action) ||
        ConversationsActions.deleteFolder.match(action) ||
        ConversationsActions.updateFolderSuccess.match(action) ||
        ConversationsActions.clearConversations.match(action) ||
        ConversationsActions.importConversationsSuccess.match(action) ||
        ConversationsActions.addFolders.match(action) ||
        ConversationsActions.setFolders.match(action),
    ),
    map(() => ({
      conversationsFolders: ConversationsSelectors.selectFolders(state$.value),
    })),
    switchMap(({ conversationsFolders }) => {
      return ConversationService.setConversationFolders(
        conversationsFolders,
      ).pipe(
        catchError((err) => {
          console.error(
            'An error occurred during the saving conversation folders: ',
            err,
          );
          return of(
            UIActions.showErrorToast(
              translate(
                'An error occurred during the saving conversation folders',
              ),
            ),
          );
        }),
      );
    }),
    ignoreElements(),
  );

const hideChatbarEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(
      (action) =>
        (ConversationsActions.createNewConversations.match(action) &&
          !action.payload?.suspendHideSidebar) ||
        (ConversationsActions.selectConversations.match(action) &&
          !action.payload?.suspendHideSidebar) ||
        ConversationsActions.createNewPlaybackConversation.match(action) ||
        ConversationsActions.createNewReplayConversation.match(action) ||
        ConversationsActions.saveNewConversationSuccess.match(action) ||
        (ConversationsActions.addConversations.match(action) &&
          !action.payload?.suspendHideSidebar),
      // will be fixed with https://github.com/epam/ai-dial-chat/issues/792
    ),
    switchMap(() =>
      isMediumScreen() ? of(UIActions.setShowChatbar(false)) : EMPTY,
    ),
  );

const selectConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        ConversationsActions.updateFolderSuccess.match(action) ||
        ConversationsActions.selectConversations.match(action) ||
        ConversationsActions.unselectConversations.match(action) ||
        ConversationsActions.updateConversationSuccess.match(action) ||
        ConversationsActions.saveNewConversationSuccess.match(action) ||
        ConversationsActions.deleteConversationsComplete.match(action) ||
        ConversationsActions.addConversations.match(action),
    ),
    map(() =>
      ConversationsSelectors.selectSelectedConversationsIds(state$.value),
    ),
    switchMap((selectedConversationsIds) =>
      forkJoin({
        selectedConversationsIds: of(selectedConversationsIds),
        _: selectedConversationsIds.length
          ? ConversationService.setSelectedConversationsIds(
              selectedConversationsIds,
            )
          : EMPTY,
      }),
    ),
    switchMap(({ selectedConversationsIds }) =>
      of(UIActions.setIsCompareMode(selectedConversationsIds.length > 1)),
    ),
  );

const uploadSelectedConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter((action) => ConversationsActions.selectConversations.match(action)),
    map(() =>
      ConversationsSelectors.selectSelectedConversationsIds(state$.value),
    ),
    switchMap((selectedConversationsIds) =>
      concat(
        of(
          ConversationsActions.uploadConversationsByIds({
            conversationIds: selectedConversationsIds,
            showLoader: true,
          }),
        ),
      ),
    ),
  );

const compareConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.selectForCompare.match),
    switchMap(({ payload }) => getOrUploadConversation(payload, state$.value)),
    switchMap(({ conversation: chosenConversation }) => {
      const selectedConversation =
        ConversationsSelectors.selectSelectedConversations(state$.value)[0];
      const isInvalid =
        !chosenConversation ||
        !isChosenConversationValidForCompare(
          selectedConversation,
          chosenConversation as Conversation,
        );
      const actions: Observable<AnyAction>[] = [];
      if (isInvalid) {
        actions.push(
          of(
            UIActions.showErrorToast(
              translate(
                'Incorrect conversation was chosen for comparison. Please choose another one.\r\nOnly conversations containing the same number of messages can be compared.',
              ),
            ),
          ),
        );
      } else {
        actions.push(
          of(
            ConversationsActions.selectConversations({
              conversationIds: [selectedConversation.id, chosenConversation.id],
            }),
          ),
        );
      }
      actions.push(
        of(
          ConversationsActions.selectForCompareCompleted(
            chosenConversation as Conversation,
          ),
        ),
      );

      return concat(...actions);
    }),
  );

const playbackNextMessageStartEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.playbackNextMessageStart.match),
    map(() => ({
      selectedConversations: ConversationsSelectors.selectSelectedConversations(
        state$.value,
      ),
    })),
    switchMap(({ selectedConversations }) => {
      return concat(
        ...selectedConversations.map((conv) => {
          if (!conv.playback) {
            return EMPTY;
          }
          const activeIndex = conv.playback.activePlaybackIndex;
          const userMessage: Message = conv.playback.messagesStack[activeIndex];

          const originalAssistantMessage: Message =
            conv.playback.messagesStack[activeIndex + 1];

          const assistantMessage: Message = {
            ...originalAssistantMessage,
            content: '',
            role: Role.Assistant,
          };
          const updatedMessages = conv.messages.concat(
            userMessage,
            assistantMessage,
          );
          const { prompt, temperature, selectedAddons, assistantModelId } =
            assistantMessage.settings ? assistantMessage.settings : conv;

          return concat(
            of(
              ConversationsActions.updateConversation({
                id: conv.id,
                values: {
                  messages: updatedMessages,
                  isMessageStreaming: true,
                  model: { ...conv.model, ...assistantMessage.model },
                  prompt,
                  temperature: temperature,
                  selectedAddons: selectedAddons,
                  assistantModelId: assistantModelId,
                  playback: {
                    ...conv.playback,
                    activePlaybackIndex: activeIndex + 1,
                  },
                },
              }),
            ),
            of(
              ConversationsActions.playbackNextMessageEnd({
                conversationId: conv.id,
              }),
            ).pipe(
              delay(1000),
              takeWhile(
                () =>
                  !ConversationsSelectors.selectIsPlaybackPaused(state$.value),
              ),
            ),
          );
        }),
      );
    }),
  );

const playbackNextMessageEndEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.playbackNextMessageEnd.match),
    map(({ payload }) => ({
      selectedConversation: ConversationsSelectors.selectConversation(
        state$.value,
        payload.conversationId,
      ) as Conversation,
    })),
    switchMap(({ selectedConversation }) => {
      if (!selectedConversation) {
        return EMPTY;
      }
      if (!selectedConversation.playback) {
        return EMPTY;
      }
      const activeIndex = selectedConversation.playback.activePlaybackIndex;

      const assistantMessage: Message =
        selectedConversation.playback.messagesStack[activeIndex];

      const messagesDeletedLastMessage = selectedConversation.messages.slice(
        0,
        activeIndex,
      );

      const updatedMessagesWithAssistant =
        messagesDeletedLastMessage.concat(assistantMessage);

      return of(
        ConversationsActions.updateConversation({
          id: selectedConversation.id,
          values: {
            messages: updatedMessagesWithAssistant,
            isMessageStreaming: false,
            playback: {
              ...(selectedConversation.playback as Playback),
              activePlaybackIndex: activeIndex + 1,
            },
          },
        }),
      );
    }),
  );

const playbackPrevMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.playbackPrevMessage.match),
    map(() => ({
      selectedConversations: ConversationsSelectors.selectSelectedConversations(
        state$.value,
      ),
      isMessageStreaming: ConversationsSelectors.selectIsConversationsStreaming(
        state$.value,
      ),
    })),
    switchMap(({ selectedConversations, isMessageStreaming }) => {
      return concat(
        isMessageStreaming ? of(ConversationsActions.playbackStop()) : EMPTY,
        ...selectedConversations.map((conv) => {
          if (!conv.playback) {
            return EMPTY;
          }
          const activePlaybackIndex = conv.playback.activePlaybackIndex;
          const activeIndex = isMessageStreaming
            ? activePlaybackIndex - 1
            : activePlaybackIndex - 2;
          const updatedMessages = conv.messages.slice(0, activeIndex);

          const activeAssistantIndex =
            activePlaybackIndex > 2 ? activePlaybackIndex - 3 : 0;

          const assistantMessage: Message | undefined =
            conv.messages[activeAssistantIndex];

          const model = assistantMessage?.model
            ? { ...conv.model, ...assistantMessage.model }
            : conv.model;

          const { prompt, temperature, selectedAddons, assistantModelId } =
            assistantMessage?.settings ? assistantMessage.settings : conv;
          return of(
            ConversationsActions.updateConversation({
              id: conv.id,
              values: {
                messages: updatedMessages,
                isMessageStreaming: false,
                model,
                prompt,
                temperature: temperature,
                selectedAddons: selectedAddons,
                assistantModelId: assistantModelId,
                playback: {
                  ...conv.playback,
                  activePlaybackIndex: activeIndex,
                },
              },
            }),
          );
        }),
      );
    }),
  );

const playbackCancelEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.playbackCancel.match),
    map(() => ({
      selectedConversations: ConversationsSelectors.selectSelectedConversations(
        state$.value,
      ),
      isMessageStreaming: ConversationsSelectors.selectIsConversationsStreaming(
        state$.value,
      ),
    })),
    switchMap(({ selectedConversations, isMessageStreaming }) => {
      return concat(
        ...selectedConversations.map((conv) => {
          if (!conv.playback) {
            return EMPTY;
          }
          const activePlaybackIndex = conv.playback.activePlaybackIndex;

          const updatedMessages = isMessageStreaming
            ? conv.messages.slice(0, activePlaybackIndex)
            : conv.messages;

          return of(
            ConversationsActions.updateConversation({
              id: conv.id,
              values: {
                messages: updatedMessages,
                isMessageStreaming: false,
                isPlayback: false,
                playback: undefined,
              },
            }),
          );
        }),
      );
    }),
  );

const uploadConversationsByIdsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.uploadConversationsByIds.match),
    switchMap(({ payload }) => {
      return forkJoin({
        uploadedConversations: payload.conversationIds.length
          ? zip(
              payload.conversationIds.map((id) =>
                ConversationService.getConversation(
                  ConversationsSelectors.selectConversation(state$.value, id)!,
                ).pipe(
                  catchError((err) => {
                    console.error(
                      'The selected conversation was not found:',
                      err,
                    );
                    return of(null);
                  }),
                ),
              ),
            )
          : of([]),
        setIds: of(new Set(payload.conversationIds as string[])),
        showLoader: of(payload.showLoader),
      });
    }),
    map(({ uploadedConversations, setIds, showLoader }) =>
      ConversationsActions.uploadConversationsByIdsSuccess({
        setIds,
        conversations: uploadedConversations.filter(Boolean) as Conversation[],
        showLoader,
      }),
    ),
  );

const saveConversationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(
      (action) =>
        ConversationsActions.saveConversation.match(action) &&
        !action.payload.isMessageStreaming, // shouldn't save during streaming
    ),
    concatMap(({ payload: newConversation }) => {
      return ConversationService.updateConversation(newConversation).pipe(
        switchMap(() => of(ConversationsActions.saveConversationSuccess())),
        catchError((err) => {
          console.error(err);
          return concat(
            of(
              UIActions.showErrorToast(
                translate(
                  'An error occurred while saving the conversation. Please refresh the page.',
                ),
              ),
            ),
            of(ConversationsActions.saveConversationFail(newConversation)),
          );
        }),
      );
    }),
  );

const recreateConversationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.recreateConversation.match),
    mergeMap(({ payload }) => {
      return ConversationService.createConversation(payload.new).pipe(
        switchMap(() =>
          ConversationService.deleteConversation(
            getConversationInfoFromId(payload.old.id),
          ),
        ),
        switchMap(() => of(ConversationsActions.saveConversationSuccess())),
        catchError((err) => {
          console.error(err);
          return concat(
            of(
              ConversationsActions.recreateConversationFail({
                newId: payload.new.id,
                oldConversation: payload.old,
              }),
            ),
            of(
              UIActions.showErrorToast(
                translate(
                  'An error occurred while saving the conversation. Please refresh the page.',
                ),
              ),
            ),
          );
        }),
      );
    }),
  );

const updateConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.updateConversation.match),
    mergeMap(({ payload }) => {
      return getOrUploadConversation(payload, state$.value);
    }),
    mergeMap(({ payload, conversation }) => {
      const { id, values } = payload as {
        id: string;
        values: Partial<Conversation>;
      };

      if (!conversation) {
        return of(
          UIActions.showErrorToast(
            translate(
              'It looks like this conversation has been deleted. Please reload the page',
            ),
          ),
        );
      }
      const newConversation: Conversation = regenerateConversationId({
        ...(conversation as Conversation),
        ...values,
        lastActivityDate: Date.now(),
      });

      return concat(
        of(
          ConversationsActions.updateConversationSuccess({
            id,
            conversation: {
              ...values,
              id: newConversation.id,
            },
          }),
        ),
        iif(
          () => !!conversation && conversation.id !== newConversation.id,
          of(
            ConversationsActions.recreateConversation({
              new: newConversation,
              old: conversation,
            }),
          ),
          iif(
            () => !newConversation.isPlayback,
            of(ConversationsActions.saveConversation(newConversation)),
            EMPTY,
          ),
        ),
      );
    }),
  );

const uploadFolderIfNotLoadedEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.uploadFoldersIfNotLoaded.match),
    mergeMap(({ payload }) => {
      const folders = ConversationsSelectors.selectFolders(state$.value);
      const notUploadedPaths = folders
        .filter(
          (folder) =>
            payload.ids.includes(folder.id) &&
            folder.status !== UploadStatus.LOADED,
        )
        .map((folder) => folder.id);

      if (!notUploadedPaths.length) {
        return EMPTY;
      }

      return of(ConversationsActions.uploadFolders({ ids: notUploadedPaths }));
    }),
  );

const uploadFoldersEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.uploadFolders.match),
    mergeMap(({ payload }) => {
      return zip(
        payload.ids.map((id) =>
          ConversationService.getConversationsAndFolders(id),
        ),
      ).pipe(
        switchMap((foldersAndEntities) => {
          const actions: Observable<AnyAction>[] = [];
          const folders = foldersAndEntities.flatMap((f) => f.folders);
          const conversations = foldersAndEntities.flatMap((f) => f.entities);

          const publicConversationIds = conversations
            .filter((conv) => {
              const rootParentFolder =
                ConversationsSelectors.selectRootParentFolder(
                  state$.value,
                  conv.folderId,
                );

              return rootParentFolder && rootParentFolder.publishedWithMe;
            })
            .map((conv) => conv.id);
          const { publicVersionGroups, items: publicConversations } =
            mapPublishedItems<ConversationInfo>(
              publicConversationIds,
              FeatureType.Chat,
            );
          const notPublicConversations = conversations.filter(
            (conv) => !publicConversationIds.includes(conv.id),
          );

          if (publicConversationIds.length) {
            actions.push(
              of(
                PublicationActions.addPublicVersionGroups({
                  publicVersionGroups,
                }),
              ),
            );
          }

          return concat(
            ...actions,
            of(
              ConversationsActions.uploadChildConversationsWithFoldersSuccess({
                parentIds: payload.ids,
                folders,
                conversations: [
                  ...notPublicConversations,
                  ...publicConversations,
                ],
              }),
            ),
            ...payload.ids.map((folderId) =>
              of(
                ConversationsActions.updateFolder({
                  folderId,
                  values: { status: UploadStatus.LOADED },
                }),
              ),
            ),
          );
        }),
        catchError((err) => {
          console.error('Error during upload conversations and folders', err);
          return concat(
            of(
              ConversationsActions.uploadFoldersFail({
                paths: new Set(payload.ids),
              }),
            ),
            of(ConversationsActions.uploadConversationsFail()),
          );
        }),
      );
    }),
  );

const uploadConversationsFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.uploadConversationsFail.match),
    map(() =>
      UIActions.showErrorToast(
        translate(
          'An error occurred while loading conversations and folders. Most likely the conversation already exists. Please refresh the page.',
        ),
      ),
    ),
  );

const uploadConversationsWithFoldersRecursiveEpic: AppEpic = (
  action$,
  state$,
) =>
  action$.pipe(
    filter(ConversationsActions.uploadConversationsWithFoldersRecursive.match),
    mergeMap(({ payload }) =>
      ConversationService.getConversations(payload?.path, true).pipe(
        mergeMap((conversations) => {
          const actions: Observable<AnyAction>[] = [];
          const paths = uniq(
            conversations.flatMap((c) =>
              getParentFolderIdsFromFolderId(c.folderId),
            ),
          );

          const publicConversationIds = conversations
            .filter((conv) => {
              const rootParentFolder =
                ConversationsSelectors.selectRootParentFolder(
                  state$.value,
                  conv.folderId,
                );

              return rootParentFolder && rootParentFolder.publishedWithMe;
            })
            .map((conv) => conv.id);

          const { publicVersionGroups, items: publicConversations } =
            mapPublishedItems<ConversationInfo>(
              publicConversationIds,
              FeatureType.Chat,
            );
          const notPublicConversations = conversations.filter(
            (conv) => !publicConversationIds.includes(conv.id),
          );

          if (publicConversationIds.length) {
            actions.push(
              of(
                PublicationActions.addPublicVersionGroups({
                  publicVersionGroups,
                }),
              ),
            );
          }

          if (
            !!payload?.selectFirst &&
            !!conversations.length &&
            !!payload?.path
          ) {
            const openedFolders = UISelectors.selectOpenedFoldersIds(
              state$.value,
              FeatureType.Chat,
            );

            const topLevelConversationId = conversations.toSorted(
              (a, b) => a.folderId.length - b.folderId.length,
            )[0].id;

            actions.push(
              concat(
                of(
                  ConversationsActions.uploadChildConversationsWithFoldersSuccess(
                    {
                      parentIds: [...payload.path, ...paths],
                      folders: getFoldersFromIds(
                        paths,
                        FolderType.Chat,
                        UploadStatus.LOADED,
                      ),
                      conversations: [
                        ...publicConversations,
                        ...notPublicConversations,
                      ],
                    },
                  ),
                ),
                of(
                  ConversationsActions.selectConversations({
                    conversationIds: [topLevelConversationId],
                  }),
                ),
                of(
                  UIActions.setOpenedFoldersIds({
                    featureType: FeatureType.Chat,
                    openedFolderIds: [...openedFolders, ...paths],
                  }),
                ),
              ),
            );
          }

          return concat(
            of(
              ConversationsActions.addConversations({
                conversations: [
                  ...publicConversations,
                  ...notPublicConversations,
                ],
              }),
            ),
            of(
              ConversationsActions.addFolders({
                folders: paths.map((path) => ({
                  ...getFolderFromId(path, FolderType.Chat),
                  status: UploadStatus.LOADED,
                })),
              }),
            ),
            of(
              ConversationsActions.uploadConversationsWithFoldersRecursiveSuccess(),
            ),
            ...actions,
          );
        }),
        catchError((err) => {
          console.error('Error during upload conversations and folders', err);
          return of(ConversationsActions.uploadConversationsFail());
        }),
      ),
    ),
  );

const uploadConversationsWithContentRecursiveEpic: AppEpic = (
  action$,
  state$,
) =>
  action$.pipe(
    filter(ConversationsActions.uploadConversationsWithContentRecursive.match),
    mergeMap(({ payload }) =>
      ConversationService.getConversations(payload.path, true).pipe(
        mergeMap((conversations) => {
          const paths = uniq(
            conversations.flatMap((c) =>
              getParentFolderIdsFromFolderId(c.folderId),
            ),
          );
          const publicConversationIds = conversations
            .filter((conv) => {
              const rootParentFolder =
                ConversationsSelectors.selectRootParentFolder(
                  state$.value,
                  conv.folderId,
                );

              return rootParentFolder && rootParentFolder.publishedWithMe;
            })
            .map((conv) => conv.id);

          return concat(
            of(
              ConversationsActions.addConversations({
                conversations: conversations.map((conv) =>
                  publicConversationIds.includes(conv.id)
                    ? {
                        ...conv,
                        ...parseConversationApiKey(
                          splitEntityId(conv.id).name,
                          {
                            parseVersion: true,
                          },
                        ),
                      }
                    : conv,
                ),
                suspendHideSidebar: true,
              }),
            ),
            of(
              ConversationsActions.addFolders({
                folders: paths.map((path) => ({
                  ...getFolderFromId(path, FolderType.Chat),
                  status: UploadStatus.LOADED,
                })),
              }),
            ),
            of(
              ConversationsActions.uploadConversationsByIds({
                conversationIds: conversations.map((c) => c.id),
                showLoader: true,
              }),
            ),
          );
        }),
        catchError((err) => {
          console.error('Error during upload conversations and folders', err);
          return of(ConversationsActions.uploadConversationsFail());
        }),
      ),
    ),
  );

const toggleFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.toggleFolder.match),
    switchMap(({ payload }) => {
      const openedFoldersIds = UISelectors.selectOpenedFoldersIds(
        state$.value,
        FeatureType.Chat,
      );
      const isOpened = openedFoldersIds.includes(payload.id);
      const action = isOpened ? UIActions.closeFolder : UIActions.openFolder;

      return of(
        action({
          id: payload.id,
          featureType: FeatureType.Chat,
        }),
      );
    }),
  );

const openFolderEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.openFolder.match),
    filter(({ payload }) => payload.featureType === FeatureType.Chat),
    switchMap(({ payload }) =>
      of(
        ConversationsActions.uploadFoldersIfNotLoaded({
          ids: [payload.id],
        }),
      ),
    ),
  );

const getChartAttachmentEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.getChartAttachment.match),
    switchMap(({ payload }) =>
      FileService.getFileContent<PlotParams>(payload.pathToChart).pipe(
        switchMap((params) => {
          return of(
            ConversationsActions.getChartAttachmentSuccess({
              params,
              pathToChart: payload.pathToChart,
            }),
          );
        }),
        catchError(() =>
          of(
            UIActions.showErrorToast(
              translate('Error while uploading chart data'),
            ),
          ),
        ),
      ),
    ),
  );

const getCustomAttachmentDataEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.getCustomAttachmentData.match),
    switchMap(({ payload }) =>
      FileService.getFileContent<CustomVisualizerData>(
        payload.pathToAttachment,
      ).pipe(
        switchMap((params) => {
          return of(
            ConversationsActions.getCustomAttachmentDataSuccess({
              params,
              url: payload.pathToAttachment,
            }),
          );
        }),
        catchError(() =>
          of(
            UIActions.showErrorToast(
              translate('Error while uploading chart data'),
            ),
          ),
        ),
      ),
    ),
  );

const cleanupIsolatedConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter((action) =>
      ConversationsActions.cleanupIsolatedConversation.match(action),
    ),
    switchMap(() => {
      const isIsolatedView = SettingsSelectors.selectIsIsolatedView(
        state$.value,
      );
      const isolatedModelId = SettingsSelectors.selectIsolatedModelId(
        state$.value,
      );
      if (isIsolatedView && isolatedModelId) {
        return of(
          ConversationsActions.deleteConversations({
            conversationIds: [
              getGeneratedConversationId({
                name: `isolated_${isolatedModelId}`,
                folderId: getConversationRootId(),
                model: {
                  id: isolatedModelId,
                },
              }),
            ],
            suppressErrorMessage: true,
          }),
        );
      }
      return EMPTY;
    }),
  );

const deleteChosenConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter((action) =>
      ConversationsActions.deleteChosenConversations.match(action),
    ),
    switchMap(() => {
      const actions: Observable<AnyAction>[] = [];
      const conversations = ConversationsSelectors.selectConversations(
        state$.value,
      );
      const chosenConversationIds = ConversationsSelectors.selectSelectedItems(
        state$.value,
      );
      const { fullyChosenFolderIds } =
        ConversationsSelectors.selectChosenFolderIds(
          state$.value,
          conversations,
        );
      const conversationIds = ConversationsSelectors.selectConversations(
        state$.value,
      ).map((conv) => conv.id);
      const folders = ConversationsSelectors.selectFolders(state$.value);

      const emptyFoldersIds = ConversationsSelectors.selectEmptyFolderIds(
        state$.value,
      );
      const deletedConversationIds = uniq([
        ...chosenConversationIds,
        ...conversationIds.filter((id) =>
          fullyChosenFolderIds.some((folderId) => id.startsWith(folderId)),
        ),
      ]);

      if (conversationIds.length) {
        actions.push(
          of(
            ConversationsActions.deleteConversations({
              conversationIds: deletedConversationIds,
            }),
          ),
        );
      }

      return concat(
        of(
          ConversationsActions.setFolders({
            folders: folders.filter(
              (folder) =>
                !fullyChosenFolderIds.includes(`${folder.id}/`) &&
                (conversations.some((c) => c.id.startsWith(`${folder.id}/`)) ||
                  emptyFoldersIds.some((id) => id === folder.id)),
            ),
          }),
        ),
        of(ConversationsActions.resetChosenConversations()),
        ...actions,
      );
    }),
  );

export const ConversationsEpics = combineEpics(
  // init
  initEpic,
  initSelectedConversationsEpic,
  initFoldersAndConversationsEpic,

  // update
  updateConversationEpic,
  saveConversationEpic,
  recreateConversationEpic,
  createNewConversationsEpic,

  // select
  selectConversationsEpic,
  uploadSelectedConversationsEpic,
  getSelectedConversationsEpic,

  saveNewConversationEpic,
  createNewConversationsSuccessEpic,
  saveFoldersEpic,
  deleteFolderEpic,
  updateFolderEpic,
  clearConversationsEpic,
  deleteConversationsEpic,
  deleteChosenConversationsEpic,
  updateMessageEpic,
  rateMessageEpic,
  rateMessageSuccessEpic,
  sendMessageEpic,
  sendMessagesEpic,
  stopStreamMessageEpic,
  streamMessageEpic,
  streamMessageFailEpic,
  cleanMessagesEpic,
  replayConversationEpic,
  replayConversationsEpic,
  endReplayConversationEpic,
  deleteMessageEpic,
  playbackNextMessageStartEpic,
  playbackNextMessageEndEpic,
  playbackPrevMessageEpic,
  playbackCancelEpic,

  createNewReplayConversationEpic,
  createNewPlaybackConversationEpic,
  duplicateConversationEpic,
  uploadConversationsByIdsEpic,

  uploadFolderIfNotLoadedEpic,
  uploadFoldersEpic,
  uploadConversationsWithFoldersRecursiveEpic,
  uploadConversationsWithContentRecursiveEpic,
  uploadConversationsFailEpic,
  toggleFolderEpic,
  openFolderEpic,
  compareConversationsEpic,
  hideChatbarEpic,

  getChartAttachmentEpic,

  cleanupIsolatedConversationEpic,

  getCustomAttachmentDataEpic,
);
