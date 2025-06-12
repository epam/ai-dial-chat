import { signIn } from 'next-auth/react';

import {
  EMPTY,
  Observable,
  concat,
  distinctUntilChanged,
  filter,
  first,
  forkJoin,
  fromEvent,
  ignoreElements,
  iif,
  map,
  merge,
  mergeMap,
  of,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import {
  doesHaveDotsInTheEnd,
  isEntityNameOnSameLevelUnique,
  parseCommaSeparatedList,
} from '@/src/utils/app/common';
import { getOrUploadConversation } from '@/src/utils/app/data/storages/api/conversation-api-storage';
import { constructPath } from '@/src/utils/app/file';
import {
  getActionsAddFoldersFromFolderId,
  getParentFolderIdsFromFolderId,
} from '@/src/utils/app/folders';
import { getConversationRootId } from '@/src/utils/app/id';
import { getExportConversationInfo } from '@/src/utils/app/import-export';
import {
  isPostMessageOverlayRequest,
  sendPMEvent,
  sendPMResponse,
} from '@/src/utils/app/overlay';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import { signInInOverlay } from '@/src/utils/auth/auth-overlay';

import { FeatureType } from '@/src/types/common';
import { AppAction, AppEpic } from '@/src/types/store';

import {
  ConversationsActions,
  ImportExportActions,
  ModelsActions,
  OverlayActions,
  SettingsActions,
  ShareActions,
  UIActions,
} from '@/src/store/actions';
import {
  AuthSelectors,
  ConversationsSelectors,
  ModelsSelectors,
  OverlaySelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { LOCAL_BUCKET } from '@/src/constants/chat';
import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';

import {
  ChatOverlayOptions,
  CreateConversationRequest,
  CreateConversationResponse,
  CreatePlaybackConversationRequest,
  CreatePlaybackConversationResponse,
  DeleteConversationRequest,
  ExportConversationRequest,
  ExportConversationResponse,
  Feature,
  FolderInterface,
  GetConversationsResponse,
  GetMessagesResponse,
  ImportConversationRequest,
  ImportConversationResponse,
  OverlayEvents,
  OverlayRequest,
  OverlayRequests,
  RenameConversationRequest,
  RenameConversationResponse,
  Role,
  SelectConversationRequest,
  SelectConversationResponse,
  SelectedConversationLoadedResponse,
  SendMessageRequest,
  SetSystemPromptRequest,
  overlayAppName,
  validateFeature,
} from '@epam/ai-dial-shared';
import isEqual from 'lodash-es/isEqual';
import uniq from 'lodash-es/uniq';

export const postMessageMapperEpic: AppEpic = (_, state$) =>
  typeof window === 'object'
    ? fromEvent<MessageEvent>(window, 'message').pipe(
        filter(isPostMessageOverlayRequest),
        map((event) => {
          const data = event.data as OverlayRequest;

          return {
            requestName: data.type.replace(`${overlayAppName}/`, ''),
            ...data,
          };
        }),
        switchMap(({ requestName, requestId, payload }) => {
          switch (requestName) {
            case OverlayRequests.getMessages: {
              return of(OverlayActions.getMessages({ requestId }));
            }
            case OverlayRequests.getConversations: {
              return of(OverlayActions.getConversations({ requestId }));
            }
            case OverlayRequests.getSelectedConversations: {
              return of(OverlayActions.getSelectedConversations({ requestId }));
            }
            case OverlayRequests.createConversation: {
              const options = payload as CreateConversationRequest;

              return of(
                OverlayActions.createConversation({
                  requestId,
                  parentPath: options.parentPath,
                  local: options.local,
                }),
              );
            }
            case OverlayRequests.createLocalConversation: {
              return of(
                OverlayActions.createLocalConversation({
                  requestId,
                }),
              );
            }
            case OverlayRequests.selectConversation: {
              const options = payload as SelectConversationRequest;

              return of(
                OverlayActions.selectConversation({
                  requestId,
                  id: options.id,
                }),
              );
            }
            case OverlayRequests.deleteConversation: {
              const options = payload as DeleteConversationRequest;

              return of(
                OverlayActions.deleteConversation({
                  requestId,
                  id: options.id,
                }),
              );
            }
            case OverlayRequests.renameConversation: {
              const options = payload as RenameConversationRequest;

              return of(
                OverlayActions.renameConversation({
                  requestId,
                  id: options.id,
                  newName: options.newName,
                }),
              );
            }
            case OverlayRequests.createPlaybackConversation: {
              const options = payload as CreatePlaybackConversationRequest;

              return of(
                OverlayActions.createPlaybackConversation({
                  requestId,
                  id: options.id,
                }),
              );
            }
            case OverlayRequests.exportConversation: {
              const options = payload as ExportConversationRequest;

              return of(
                OverlayActions.exportConversation({
                  requestId,
                  id: options.id,
                }),
              );
            }
            case OverlayRequests.importConversation: {
              const options = payload as ImportConversationRequest;

              return of(
                OverlayActions.importConversation({
                  requestId,
                  importConversation: options.importConversation,
                }),
              );
            }
            case OverlayRequests.setOverlayOptions: {
              const options = payload as ChatOverlayOptions;

              return of(
                OverlayActions.setOverlayOptions({
                  ...options,
                  requestId,
                }),
              );
            }
            case OverlayRequests.sendMessage: {
              const { content } = payload as SendMessageRequest;

              return of(OverlayActions.sendMessage({ content, requestId }));
            }
            case OverlayRequests.setSystemPrompt: {
              const { systemPrompt } = payload as SetSystemPromptRequest;

              const hostDomain = OverlaySelectors.selectHostDomain(
                state$.value,
              );

              return concat(
                of(
                  OverlayActions.sendPMResponse({
                    type: OverlayRequests.setSystemPrompt,
                    requestParams: {
                      requestId,
                      hostDomain,
                    },
                  }),
                ),
                of(
                  OverlayActions.setSystemPrompt({
                    systemPrompt,
                    requestId,
                  }),
                ),
              );
            }
            default: {
              console.warn(`[Overlay] ${requestName} event not supported.`);
              return EMPTY;
            }
          }
        }),
      )
    : EMPTY;

const getMessagesEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.getMessages.type),
    map(({ payload: { requestId } }) => {
      const currentConversation =
        ConversationsSelectors.selectFirstSelectedConversation(state$.value);

      const hostDomain = OverlaySelectors.selectHostDomain(state$.value);

      return { requestId, currentConversation, hostDomain };
    }),
    map(({ requestId, currentConversation, hostDomain }) => {
      const messages = currentConversation?.messages || [];

      return OverlayActions.sendPMResponse({
        type: OverlayRequests.getMessages,
        requestParams: {
          requestId,
          hostDomain,
          payload: { messages } as GetMessagesResponse,
        },
      });
    }),
  );

const getConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.getConversations.type),
    map(({ payload: { requestId } }) => {
      const hostDomain = OverlaySelectors.selectHostDomain(state$.value);

      const conversations = ConversationsSelectors.selectConversations(
        state$.value,
      );
      const resultConversations = conversations.map((conv) => {
        const { bucket, parentPath } = splitEntityId(conv.id);

        return {
          ...conv,
          bucket,
          parentPath,
        };
      });

      return OverlayActions.sendPMResponse({
        type: OverlayRequests.getConversations,
        requestParams: {
          requestId,
          hostDomain,
          payload: {
            conversations: resultConversations,
          } as GetConversationsResponse,
        },
      });
    }),
  );

const getSelectedConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.getSelectedConversations.type),
    map(({ payload: { requestId } }) => {
      const hostDomain = OverlaySelectors.selectHostDomain(state$.value);

      const conversations = ConversationsSelectors.selectSelectedConversations(
        state$.value,
      );
      const resultConversations = conversations.map((conv) => {
        const { bucket, parentPath } = splitEntityId(conv.id);

        return {
          ...conv,
          bucket,
          parentPath,
        };
      });

      return OverlayActions.sendPMResponse({
        type: OverlayRequests.getSelectedConversations,
        requestParams: {
          requestId,
          hostDomain,
          payload: {
            conversations: resultConversations,
          } as GetConversationsResponse,
        },
      });
    }),
  );

const createConversationEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(OverlayActions.createConversation.type),
    switchMap(({ payload: { requestId, parentPath, local } }) => {
      const conversationFolderId = constructPath(
        getConversationRootId(local ? LOCAL_BUCKET : undefined),
        parentPath,
      );

      const actions: Observable<AppAction>[] = [];

      if (parentPath) {
        actions.push(
          ...getActionsAddFoldersFromFolderId({
            folderId: conversationFolderId,
            featureType: FeatureType.Chat,
            shouldOpen: true,
          }),
        );
      }

      return concat(
        ...actions,
        of(
          ConversationsActions.createNewConversations({
            names: [DEFAULT_CONVERSATION_NAME],
            folderId: conversationFolderId,
          }),
        ),
        of(
          OverlayActions.createConversationEffect({
            requestId,
            parentPath,
            local,
          }),
        ),
      );
    }),
  );

const createLocalConversationEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(OverlayActions.createLocalConversation.type),
    switchMap(({ payload: { requestId } }) => {
      const actions: Observable<AppAction>[] = [];

      return concat(
        ...actions,
        of(
          ConversationsActions.createNewConversations({
            names: [DEFAULT_CONVERSATION_NAME],
            folderId: getConversationRootId(LOCAL_BUCKET),
          }),
        ),
        of(
          OverlayActions.createLocalConversationEffect({
            requestId,
          }),
        ),
      );
    }),
  );

const createConversationEffectEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.createConversationEffect.type),
    switchMap(({ payload: { requestId } }) => {
      return action$.pipe(
        ofType(ConversationsActions.createNotLocalConversationsSuccess.type),
        takeUntil(timer(10000)),
        filter(Boolean),
        first(({ payload }) => payload.length > 0),
        mergeMap(({ payload }) => {
          const conversations = payload;
          const hostDomain = OverlaySelectors.selectHostDomain(state$.value);

          const conversation = conversations[0];
          const { bucket, parentPath } = splitEntityId(conversation.id);
          const resultConversation = {
            ...conversation,
            bucket,
            parentPath,
          };

          return concat(
            of(UIActions.setScrollToEntityId(conversation.id)),
            of(
              OverlayActions.sendPMResponse({
                type: OverlayRequests.createConversation,
                requestParams: {
                  requestId,
                  hostDomain,
                  payload: {
                    conversation: resultConversation,
                  } as CreateConversationResponse,
                },
              }),
            ),
          );
        }),
      );
    }),
  );

const createLocalConversationEffectEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.createLocalConversationEffect.type),
    switchMap(({ payload: { requestId } }) => {
      return action$.pipe(
        ofType(ConversationsActions.addConversations.type),
        takeUntil(timer(10000)),
        filter(Boolean),
        first(({ payload }) => payload.conversations.length > 0),
        mergeMap(({ payload }) => {
          const conversations = payload.conversations;
          const hostDomain = OverlaySelectors.selectHostDomain(state$.value);

          const conversation = conversations[0];
          const { bucket, parentPath } = splitEntityId(conversation.id);
          const resultConversation = {
            ...conversation,
            bucket,
            parentPath,
          };

          return concat(
            of(UIActions.setScrollToEntityId(conversation.id)),
            of(
              OverlayActions.sendPMResponse({
                type: OverlayRequests.createLocalConversation,
                requestParams: {
                  requestId,
                  hostDomain,
                  payload: {
                    conversation: resultConversation,
                  } as CreateConversationResponse,
                },
              }),
            ),
          );
        }),
      );
    }),
  );

const deleteConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.deleteConversation.type),
    switchMap(({ payload: { requestId, id } }) => {
      const hostDomain = OverlaySelectors.selectHostDomain(state$.value);
      const conversation = ConversationsSelectors.selectConversation(
        state$.value,
        id,
      );

      if (!conversation) {
        console.warn(`[Overlay] Conversation not exists with id '${id}'`);

        return EMPTY;
      }

      return concat(
        of(
          ConversationsActions.deleteConversations({
            conversationIds: [conversation.id],
          }),
        ),
        of(
          OverlayActions.sendPMResponse({
            type: OverlayRequests.deleteConversation,
            requestParams: {
              requestId,
              hostDomain,
            },
          }),
        ),
      );
    }),
  );

const createPlaybackConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.createPlaybackConversation.type),
    switchMap(({ payload }) => {
      const conversation = ConversationsSelectors.selectConversation(
        state$.value,
        payload.id,
      );

      if (!conversation) {
        console.warn(
          `[Overlay] Conversation not exists with id '${payload.id}'`,
        );

        return EMPTY;
      }

      return concat(
        of(ConversationsActions.createNewPlaybackConversation(conversation)),
        of(OverlayActions.createPlaybackConversationEffect(payload)),
      );
    }),
  );

const createPlaybackConversationEffectEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.createPlaybackConversationEffect.type),
    switchMap(({ payload: { requestId } }) => {
      return action$.pipe(
        ofType(ConversationsActions.saveNewConversationSuccess.type),
        takeUntil(timer(10000)),
        filter(Boolean),
        mergeMap(({ payload: { newConversation } }) => {
          const hostDomain = OverlaySelectors.selectHostDomain(state$.value);

          const { bucket, parentPath } = splitEntityId(newConversation.id);
          const resultConversation = {
            ...newConversation,
            bucket,
            parentPath,
          };

          return concat(
            of(UIActions.setScrollToEntityId(newConversation.id)),
            of(
              OverlayActions.sendPMResponse({
                type: OverlayRequests.createPlaybackConversation,
                requestParams: {
                  requestId,
                  hostDomain,
                  payload: {
                    conversation: resultConversation,
                  } as CreatePlaybackConversationResponse,
                },
              }),
            ),
          );
        }),
      );
    }),
  );

const renameConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.renameConversation.type),
    switchMap(({ payload }) => {
      const conversations = ConversationsSelectors.selectConversations(
        state$.value,
      );
      const conversation = ConversationsSelectors.selectConversation(
        state$.value,
        payload.id,
      );

      if (!conversation) {
        console.warn(
          `[Overlay] Conversation not exists with id '${payload.id}'`,
        );

        return EMPTY;
      }

      if (
        !isEntityNameOnSameLevelUnique(
          payload.newName,
          conversation,
          conversations,
        ) ||
        doesHaveDotsInTheEnd(payload.newName)
      ) {
        console.warn(
          '[Overlay] Conversation rename failed because new name is invalid',
        );

        return EMPTY;
      }

      return concat(
        of(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: { name: payload.newName, isNameChanged: true },
          }),
        ),
        of(OverlayActions.renameConversationEffect(payload)),
      );
    }),
  );

const renameConversationEffectEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.renameConversationEffect.type),
    switchMap(({ payload: { requestId } }) => {
      return action$.pipe(
        ofType(ConversationsActions.updateConversationSuccess.type),
        takeUntil(timer(10000)),
        filter(Boolean),
        mergeMap(({ payload: { id } }) => {
          const conversation = ConversationsSelectors.selectConversation(
            state$.value,
            id,
          );

          if (!conversation) return EMPTY;

          const hostDomain = OverlaySelectors.selectHostDomain(state$.value);

          const { bucket, parentPath } = splitEntityId(conversation.id);
          const resultConversation = {
            ...conversation,
            bucket,
            parentPath,
          };

          return concat(
            of(UIActions.setScrollToEntityId(conversation.id)),
            of(
              OverlayActions.sendPMResponse({
                type: OverlayRequests.renameConversation,
                requestParams: {
                  requestId,
                  hostDomain,
                  payload: {
                    conversation: resultConversation,
                  } as RenameConversationResponse,
                },
              }),
            ),
          );
        }),
      );
    }),
  );

const exportConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.exportConversation.type),
    switchMap(({ payload }) =>
      forkJoin({
        conversation: getOrUploadConversation(
          { id: payload.id },
          state$.value,
        ).pipe(map((data) => data.conversation)),
        requestId: of(payload.requestId),
        conversationId: of(payload.id),
      }),
    ),
    switchMap(({ conversationId, requestId, conversation }) => {
      const hostDomain = OverlaySelectors.selectHostDomain(state$.value);

      if (!conversation) {
        console.warn(
          `[Overlay] Conversation not exists with id '${conversationId}'`,
        );

        return EMPTY;
      }

      const parentFolders = ConversationsSelectors.selectParentFolders(
        state$.value,
        conversation.folderId,
      );
      const exportedConversation = getExportConversationInfo(
        conversation,
        parentFolders,
      );

      return of(
        OverlayActions.sendPMResponse({
          type: OverlayRequests.exportConversation,
          requestParams: {
            requestId,
            hostDomain,
            payload: {
              exportConversation: exportedConversation,
            } as ExportConversationResponse,
          },
        }),
      );
    }),
  );

const importConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.importConversation.type),
    switchMap(({ payload: { importConversation, requestId } }) => {
      if (state$.value.overlay.newConversationsFolder) {
        const parentIds = getParentFolderIdsFromFolderId(
          state$.value.overlay.newConversationsFolder,
        );

        if (!importConversation.history?.length) return EMPTY;

        const convIdLastItem = importConversation.history[0].id
          .split('/')
          .pop();
        importConversation.history[0].folderId =
          state$.value.overlay.newConversationsFolder;
        importConversation.history[0].id = constructPath(
          state$.value.overlay.newConversationsFolder,
          convIdLastItem,
        );
        importConversation.folders = parentIds.map((item): FolderInterface => {
          const splittedEntityId = item.split('/');
          const name = splittedEntityId.pop();
          const folderId = splittedEntityId.join('/');

          return {
            id: item,
            name: name!,
            folderId,
            type: FeatureType.Chat,
          };
        });
      }

      return concat(
        of(
          ImportExportActions.importConversations({ data: importConversation }),
        ),
        of(
          OverlayActions.importConversationEffect({
            importConversation,
            requestId,
          }),
        ),
      );
    }),
  );

const importConversationEffectEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.importConversationEffect.type),
    switchMap(({ payload: { requestId } }) => {
      return action$.pipe(
        ofType(ConversationsActions.importConversationsSuccess.type),
        takeUntil(timer(10000)),
        filter(Boolean),
        mergeMap(({ payload: { conversations } }) => {
          const hostDomain = OverlaySelectors.selectHostDomain(state$.value);

          const conversation = conversations[0];
          const { bucket, parentPath } = splitEntityId(conversation.id);
          const resultConversation = {
            ...conversation,
            bucket,
            parentPath,
          };

          return concat(
            of(UIActions.setScrollToEntityId(conversation.id)),
            of(
              OverlayActions.sendPMResponse({
                type: OverlayRequests.importConversation,
                requestParams: {
                  requestId,
                  hostDomain,
                  payload: {
                    conversation: resultConversation,
                  } as ImportConversationResponse,
                },
              }),
            ),
          );
        }),
      );
    }),
  );

const selectConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.selectConversation.type),
    switchMap(({ payload: { requestId, id } }) => {
      const hostDomain = OverlaySelectors.selectHostDomain(state$.value);
      const conversation = ConversationsSelectors.selectConversation(
        state$.value,
        id,
      );

      if (!conversation) {
        return EMPTY;
      }

      const foldersPaths = uniq(
        getParentFolderIdsFromFolderId(conversation.folderId),
      );

      return concat(
        foldersPaths
          ? of(
              UIActions.setOpenedFoldersIds({
                openedFolderIds: foldersPaths,
                featureType: FeatureType.Chat,
              }),
            )
          : EMPTY,
        of(
          ConversationsActions.selectConversations({
            conversationIds: [conversation.id],
          }),
        ),
        of(UIActions.setScrollToEntityId(conversation.id)),
        of(
          OverlayActions.sendPMResponse({
            type: OverlayRequests.selectConversation,
            requestParams: {
              requestId,
              hostDomain,
              payload: {
                conversation: conversation,
              } as SelectConversationResponse,
            },
          }),
        ),
      );
    }),
  );

const sendMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.sendMessage.type),
    switchMap(({ payload: { content, requestId } }) => {
      const selectedConversations =
        ConversationsSelectors.selectSelectedConversations(state$.value);
      const hostDomain = OverlaySelectors.selectHostDomain(state$.value);

      const currentConversation = selectedConversations[0];

      return concat(
        of(
          OverlayActions.sendPMResponse({
            type: OverlayRequests.sendMessage,
            requestParams: { requestId, hostDomain },
          }),
        ),
        of(
          ConversationsActions.sendMessage({
            conversation: currentConversation,
            deleteCount: 0,
            message: {
              role: Role.User,
              content,
            },
            activeReplayIndex: 0,
          }),
        ),
      );
    }),
  );

const setOverlayOptionsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.setOverlayOptions.type),
    map(({ payload: { ...options } }) => {
      const availableThemes = UISelectors.selectAvailableThemes(state$.value);

      return { ...options, availableThemes };
    }),
    switchMap(
      ({
        theme,
        availableThemes,
        hostDomain,
        modelId,
        requestId,
        enabledFeatures,
        signInOptions,
        overlayConversationId,
        signInInSameWindow,
      }) => {
        const actions = [];

        actions.push(
          of(
            OverlayActions.sendPMResponse({
              type: OverlayRequests.setOverlayOptions,
              requestParams: {
                requestId,
                hostDomain,
              },
            }),
          ),
        );

        if (theme) {
          if (availableThemes.some(({ id }) => id === theme)) {
            actions.push(of(UIActions.setTheme(theme)));
          } else {
            console.warn(
              `[Overlay](Theme) No such theme: ${theme}.\nTheme isn't set.`,
            );
          }
        }

        if (signInInSameWindow) {
          actions.push(
            of(SettingsActions.setIsSignInInSameWindow(signInInSameWindow)),
          );
        }

        if (enabledFeatures) {
          let features: string[] = [];

          if (typeof enabledFeatures === 'string') {
            features = parseCommaSeparatedList(enabledFeatures);
          }

          if (Array.isArray(enabledFeatures)) {
            features = enabledFeatures;
          }

          if (features.every(validateFeature)) {
            const isLoginRequired = AuthSelectors.selectIsShouldLogin(
              state$.value,
            );

            actions.push(
              of(SettingsActions.setEnabledFeatures(features as Feature[])),
            );

            if (
              !isLoginRequired &&
              features.includes(Feature.ConversationsSharing)
            ) {
              actions.push(
                of(ShareActions.triggerGettingSharedConversationListings()),
              );
            }
          } else {
            const incorrectFeatures = features
              .filter((feature) => !validateFeature(feature))
              .join(',');

            console.warn(
              `[Overlay](Enabled Features) No such features: ${incorrectFeatures}. \nFeatures aren't set.`,
            );
          }
        }

        const shouldLogIn = AuthSelectors.selectIsShouldLogin(state$.value);

        if (!shouldLogIn) {
          if (modelId) {
            const modelsMap = ModelsSelectors.selectModelsMap(state$.value);
            const overlayDefaultModel = modelsMap[modelId];

            if (overlayDefaultModel) {
              actions.push(
                of(
                  ModelsActions.updateRecentModels({
                    modelId: overlayDefaultModel.reference,
                  }),
                ),
              );
              actions.push(
                of(
                  SettingsActions.setOverlayDefaultModelReference({
                    overlayDefaultModelReference: overlayDefaultModel.reference,
                  }),
                ),
              );
            } else {
              console.warn(
                `[Overlay](ModelId) No such model: ${modelId}.\nModelId isn't available.`,
              );
            }
          }
          if (overlayConversationId) {
            actions.push(
              of(
                SettingsActions.setOverlayConversationId(overlayConversationId),
              ),
            );
          }
        }

        // after all actions will send notify that settings are set
        actions.push(
          of(
            OverlayActions.setOverlayOptionsSuccess({ hostDomain, requestId }),
          ),
          of(OverlayActions.signInOptionsSet({ signInOptions })),
          iif(
            () => !shouldLogIn,
            of(ConversationsActions.initSelectedConversations()),
            EMPTY,
          ),
        );

        return merge(...actions);
      },
    ),
  );

const signInOptionsSet: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.signInOptionsSet.type),
    tap(({ payload: { signInOptions } }) => {
      const isShouldLogin = AuthSelectors.selectIsShouldLogin(state$.value);

      if (
        isShouldLogin &&
        signInOptions?.autoSignIn &&
        signInOptions?.signInProvider
      ) {
        if (signInOptions?.signInInNewWindow) {
          //will open '/auth/signin?provider=' in a new page
          signInInOverlay(
            `/auth/signin?provider=${signInOptions.signInProvider}`,
          );
        } else {
          //will try to signin in the iframe
          signIn(signInOptions?.signInProvider);
        }
      }
    }),
    ignoreElements(),
  );

const setOverlayOptionsSuccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.setOverlayOptionsSuccess.type),
    filter(() => !!OverlaySelectors.selectOptionsReceived(state$.value)),
    distinctUntilChanged(),
    switchMap(({ payload: { hostDomain, requestId } }) => {
      const actions = [];

      actions.push(
        of(
          OverlayActions.sendPMResponse({
            type: OverlayRequests.setOverlayOptions,
            requestParams: {
              requestId,
              hostDomain,
            },
          }),
        ),
      );

      actions.push(of(OverlayActions.checkReadyToInteract()));

      return concat(...actions);
    }),
  );

const checkReadyToInteract: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.checkReadyToInteract.type),
    switchMap(() =>
      state$.pipe(
        filter((state) => {
          const areConvLoaded =
            ConversationsSelectors.selectAreSelectedConversationsLoaded(state);
          const isShouldLogin = AuthSelectors.selectIsShouldLogin(state);

          return areConvLoaded && !isShouldLogin;
        }),
        switchMap(() =>
          !OverlaySelectors.selectReadyToInteractSent(state$.value)
            ? of(OverlayActions.sendReadyToInteract())
            : EMPTY,
        ),
      ),
    ),
  );

const sendReadyToInteract: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(OverlayActions.sendReadyToInteract.type),
    switchMap(() => {
      const hostDomain = OverlaySelectors.selectHostDomain(state$.value);

      return of(
        OverlayActions.sendPMEvent({
          type: OverlayEvents.readyToInteract,
          eventParams: { hostDomain },
        }),
      );
    }),
  );

const sendSelectedConversationLoaded: AppEpic = (action$, state$) =>
  state$.pipe(
    filter(
      (state) =>
        !!ConversationsSelectors.selectAreSelectedConversationsLoaded(state) &&
        !AuthSelectors.selectIsShouldLogin(state),
    ),
    distinctUntilChanged((prev, state) => {
      const prevConvIds =
        ConversationsSelectors.selectSelectedConversationsIds(prev);
      const currentConvId =
        ConversationsSelectors.selectSelectedConversationsIds(state);

      return isEqual(prevConvIds, currentConvId);
    }),
    switchMap((state) => {
      const hostDomain = OverlaySelectors.selectHostDomain(state);
      const currentConvIds =
        ConversationsSelectors.selectSelectedConversationsIds(state);

      return of(
        OverlayActions.sendPMEvent({
          type: OverlayEvents.selectedConversationLoaded,
          eventParams: {
            hostDomain,
            payload: {
              selectedConversationIds: currentConvIds,
            } as SelectedConversationLoadedResponse,
          },
        }),
      );
    }),
  );

const sendConversationUpdated: AppEpic = (action$, state$) =>
  state$.pipe(
    // we shouldn't proceed if we are not overlay
    filter(() => SettingsSelectors.selectIsOverlay(state$.value)),
    map((state) => ConversationsSelectors.selectConversations(state)),
    distinctUntilChanged((prev, curr) => isEqual(prev, curr)),
    map(() => {
      const hostDomain = OverlaySelectors.selectHostDomain(state$.value);

      return OverlayActions.sendPMEvent({
        type: OverlayEvents.conversationsUpdated,
        eventParams: { hostDomain },
      });
    }),
  );

const notifyHostGPTMessageStatus: AppEpic = (_, state$) =>
  state$.pipe(
    // we shouldn't proceed if we are not overlay
    filter(() => SettingsSelectors.selectIsOverlay(state$.value)),
    map((state) =>
      ConversationsSelectors.selectIsConversationsStreaming(state),
    ),
    distinctUntilChanged(),
    map((isMessageStreaming) => {
      const hostDomain = OverlaySelectors.selectHostDomain(state$.value);

      return { isMessageStreaming, hostDomain };
    }),
    map(({ isMessageStreaming, hostDomain }) => {
      if (isMessageStreaming) {
        // That's mean gpt end generating message (maybe that's because it's answered)
        return OverlayActions.sendPMEvent({
          type: OverlayEvents.gptStartGenerating,
          eventParams: { hostDomain },
        });
      }

      return OverlayActions.sendPMEvent({
        type: OverlayEvents.gptEndGenerating,
        eventParams: { hostDomain },
      });
    }),
  );

// models are loading after conversations, if models loaded that means that we can work with application. Maybe there is better condition.
const notifyHostAboutReadyEpic: AppEpic = (_action$, state$) =>
  state$.pipe(
    filter(() => SettingsSelectors.selectIsOverlay(state$.value)),
    map((state) => {
      return {
        isShouldLogin: AuthSelectors.selectIsShouldLogin(state),
        isModelLoaded: ModelsSelectors.selectAreModelsLoaded(state),
      };
    }),
    filter(({ isModelLoaded, isShouldLogin }) => {
      return isShouldLogin || isModelLoaded;
    }),
    first(),
    map(() => {
      // broadcast about ready, after ready emitted, overlay can send options
      return OverlayActions.sendPMEvent({
        type: OverlayEvents.ready,
        eventParams: { hostDomain: '*' },
      });
    }),
  );

const initOverlayEpic: AppEpic = (_action$, state$) =>
  state$.pipe(
    filter(() => SettingsSelectors.selectIsOverlay(state$.value)),
    first(),
    map(() => {
      return OverlayActions.sendPMEvent({
        type: OverlayEvents.initReady,
        eventParams: { hostDomain: '*' },
      });
    }),
  );

const sendPMEventEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(OverlayActions.sendPMEvent.type),
    tap(({ payload }) => {
      sendPMEvent(payload.type, payload.eventParams);
    }),
    ignoreElements(),
  );

const sendPMResponseEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(OverlayActions.sendPMResponse.type),
    tap(({ payload }) => {
      sendPMResponse(payload.type, payload.requestParams);
    }),
    ignoreElements(),
  );

export const OverlayEpics = combineEpics(
  postMessageMapperEpic,
  getMessagesEpic,
  getConversationsEpic,
  getSelectedConversationsEpic,
  createConversationEpic,
  createConversationEffectEpic,
  createLocalConversationEpic,
  createLocalConversationEffectEpic,
  selectConversationEpic,
  deleteConversationEpic,
  createPlaybackConversationEpic,
  createPlaybackConversationEffectEpic,
  exportConversationEpic,
  importConversationEpic,
  importConversationEffectEpic,
  renameConversationEpic,
  renameConversationEffectEpic,

  initOverlayEpic,
  sendPMEventEpic,
  sendPMResponseEpic,
  notifyHostAboutReadyEpic,
  setOverlayOptionsEpic,
  sendMessageEpic,
  notifyHostGPTMessageStatus,
  setOverlayOptionsSuccessEpic,
  signInOptionsSet,
  checkReadyToInteract,
  sendSelectedConversationLoaded,
  sendReadyToInteract,
  sendConversationUpdated,
);
