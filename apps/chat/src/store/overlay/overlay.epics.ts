import {
  EMPTY,
  distinctUntilChanged,
  filter,
  first,
  fromEvent,
  ignoreElements,
  map,
  merge,
  of,
  switchMap,
  tap,
} from 'rxjs';

import { combineEpics } from 'redux-observable';

import {
  isPostMessageOverlayRequest,
  sendPMEvent,
  sendPMResponse,
} from '@/src/utils/app/overlay';

import { Message, Role } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/openai';
import { AppEpic } from '@/src/types/store';

import { DEFAULT_ASSISTANT_SUBMODEL_ID } from '@/src/constants/default-ui-settings';
import { overlayAppName } from '@/src/constants/overlay';

import { AuthSelectors } from '../auth/auth.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '../conversations/conversations.reducers';
import { ModelsActions, ModelsSelectors } from '../models/models.reducers';
import {
  SettingsActions,
  SettingsSelectors,
} from '../settings/settings.reducers';
import { UIActions, UISelectors } from '../ui/ui.reducers';
import {
  OverlayActions,
  OverlayOptions,
  OverlaySelectors,
  SendMessageOptions,
  SetSystemPromptOptions,
} from './overlay.reducers';

import {
  Feature,
  OverlayEvents,
  OverlayRequest,
  OverlayRequests,
  validateFeature,
} from '@epam/ai-dial-shared';

export const postMessageMapperEpic: AppEpic = () =>
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
            case OverlayRequests.setOverlayOptions: {
              const options = payload as OverlayOptions;

              return of(
                OverlayActions.setOverlayOptions({
                  ...options,
                  requestId,
                }),
              );
            }
            case OverlayRequests.sendMessage: {
              const { content } = payload as SendMessageOptions;

              return of(OverlayActions.sendMessage({ content, requestId }));
            }
            case OverlayRequests.setSystemPrompt: {
              const { systemPrompt } = payload as SetSystemPromptOptions;

              return of(
                OverlayActions.setSystemPrompt({ systemPrompt, requestId }),
              );
            }
            default: {
              // it's not supported overlay request
              return EMPTY;
            }
          }
        }),
      )
    : EMPTY;

const getMessagesEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(OverlayActions.getMessages.match),
    map(({ payload: { requestId } }) => {
      const currentConversation =
        ConversationsSelectors.selectFirstSelectedConversation(state$.value);

      const hostDomain = OverlaySelectors.selectHostDomain(state$.value);

      return { requestId, currentConversation, hostDomain };
    }),
    tap(({ requestId, currentConversation, hostDomain }) => {
      const messages = currentConversation?.messages || [];

      sendPMResponse(OverlayRequests.getMessages, {
        requestId,
        hostDomain,
        payload: { messages },
      });
    }),
    ignoreElements(),
  );

const sendMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(OverlayActions.sendMessage.match),
    switchMap(({ payload: { content, requestId } }) => {
      const selectedConversations =
        ConversationsSelectors.selectSelectedConversations(state$.value);
      const hostDomain = OverlaySelectors.selectHostDomain(state$.value);

      const currentConversation = selectedConversations[0];

      sendPMResponse(OverlayRequests.sendMessage, { requestId, hostDomain });

      return of(
        ConversationsActions.sendMessage({
          conversation: currentConversation,
          deleteCount: 0,
          message: {
            role: Role.User,
            content,
          },
          activeReplayIndex: 0,
        }),
      );
    }),
  );

const setOverlayOptionsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(OverlayActions.setOverlayOptions.match),
    map(({ payload: { ...options } }) => {
      const currentConversation =
        ConversationsSelectors.selectFirstSelectedConversation(state$.value);
      const availableThemes = UISelectors.selectAvailableThemes(state$.value);

      return { ...options, currentConversation, availableThemes };
    }),
    switchMap(
      ({
        theme,
        availableThemes,
        hostDomain,
        currentConversation,
        modelId,
        requestId,
        enabledFeatures,
      }) => {
        const actions = [];

        sendPMResponse(OverlayRequests.setOverlayOptions, {
          requestId,
          hostDomain,
        });

        if (theme) {
          if (availableThemes.some(({ id }) => id === theme)) {
            actions.push(of(UIActions.setTheme(theme)));
          } else {
            console.warn(
              `[Overlay](Theme) No such theme: ${theme}.\nTheme isn't set.`,
            );
          }
        }

        if (enabledFeatures) {
          let features: string[] = [];

          if (typeof enabledFeatures === 'string') {
            features = enabledFeatures
              .split(',')
              .map((feature) => feature.trim());
          }

          if (Array.isArray(enabledFeatures)) {
            features = enabledFeatures;
          }

          if (features.every(validateFeature)) {
            actions.push(
              of(SettingsActions.setEnabledFeatures(features as Feature[])),
            );
          } else {
            const incorrectFeatures = features
              .filter((feature) => !validateFeature(feature))
              .join(',');

            console.warn(
              `[Overlay](Enabled Features) No such features: ${incorrectFeatures}. \nFeatures aren't set.`,
            );
          }
        }

        const defaultModelId = SettingsSelectors.selectDefaultModelId(
          state$.value,
        );
        const finalModelId = modelId || defaultModelId;

        if (finalModelId) {
          actions.push(
            of(ModelsActions.updateRecentModels({ modelId: finalModelId })),
          );

          actions.push(
            of(
              SettingsActions.setDefaultModelId({
                defaultModelId: finalModelId,
              }),
            ),
          );

          // if there is active conversation -> should update model for this conversation
          if (currentConversation) {
            const models = ModelsSelectors.selectModels(state$.value);

            const newAiEntity = models.find(({ id }) => id === finalModelId) as
              | DialAIEntityModel
              | undefined;

            actions.push(
              of(
                ConversationsActions.updateConversation({
                  id: currentConversation.id,
                  values: {
                    model: { id: finalModelId },
                  },
                }),
              ),
            );

            if (newAiEntity) {
              actions.push(
                of(
                  ConversationsActions.updateConversation({
                    id: currentConversation.id,
                    values: {
                      assistantModelId:
                        newAiEntity.type === EntityType.Assistant
                          ? DEFAULT_ASSISTANT_SUBMODEL_ID
                          : undefined,
                    },
                  }),
                ),
              );
            }
          }
        }

        // after all actions will send notify that settings are set
        actions.push(
          of(
            OverlayActions.setOverlayOptionsSuccess({ hostDomain, requestId }),
          ),
        );

        return merge(...actions);
      },
    ),
  );

const setOverlayOptionsSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(OverlayActions.setOverlayOptionsSuccess.match),
    tap(({ payload: { hostDomain, requestId } }) => {
      sendPMResponse(OverlayRequests.setOverlayOptions, {
        requestId,
        hostDomain,
      });
    }),
    ignoreElements(),
  );

const setSystemPromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(OverlayActions.setSystemPrompt.match),
    map(({ payload: { requestId, systemPrompt } }) => {
      const currentConversation =
        ConversationsSelectors.selectFirstSelectedConversation(state$.value);

      const hostDomain = OverlaySelectors.selectHostDomain(state$.value);

      return { requestId, systemPrompt, currentConversation, hostDomain };
    }),
    switchMap(
      ({ requestId, systemPrompt, currentConversation, hostDomain }) => {
        if (!currentConversation) return EMPTY;

        sendPMResponse(OverlayRequests.setSystemPrompt, {
          requestId,
          hostDomain,
        });

        const { messages } = currentConversation;

        const systemMessage: Message = {
          role: Role.System,
          content: systemPrompt,
        };

        // add system prompt
        const newMessages = [
          systemMessage,
          ...messages.filter(({ role }) => role !== Role.System),
        ];

        return of(
          ConversationsActions.updateConversation({
            id: currentConversation.id,
            values: {
              messages: newMessages,
            },
          }),
        );
      },
    ),
  );

const notifyHostGPTMessageStatus: AppEpic = (_, state$) =>
  state$.pipe(
    // we shouldn't proceed if we are not overlay
    filter((state) => SettingsSelectors.selectIsOverlay(state)),
    map((state) =>
      ConversationsSelectors.selectIsConversationsStreaming(state),
    ),
    distinctUntilChanged(),
    map((isMessageStreaming) => {
      const hostDomain = OverlaySelectors.selectHostDomain(state$.value);

      return { isMessageStreaming, hostDomain };
    }),
    tap(({ isMessageStreaming, hostDomain }) => {
      if (isMessageStreaming) {
        // That's mean gpt end generating message (maybe that's because it's answered)
        sendPMEvent(OverlayEvents.gptStartGenerating, { hostDomain });
        return;
      }

      sendPMEvent(OverlayEvents.gptEndGenerating, { hostDomain });
    }),
    ignoreElements(),
  );

// models are loading after conversations, if models loaded that means that we can work with application. Maybe there is better condition.
const notifyHostAboutReadyEpic: AppEpic = (_action$, state$) =>
  state$.pipe(
    filter((state) => {
      const isShouldLogin = AuthSelectors.selectIsShouldLogin(state);

      if (isShouldLogin) {
        return true;
      }

      return ModelsSelectors.selectIsModelsLoaded(state);
    }),
    first(),
    tap(() => {
      // broadcast about ready, after ready emitted, overlay should send initial settings (incl. hostDomain, theme, etc.)
      sendPMEvent(OverlayEvents.ready, { hostDomain: '*' });
    }),
    ignoreElements(),
  );

export const OverlayEpics = combineEpics(
  postMessageMapperEpic,
  getMessagesEpic,
  notifyHostAboutReadyEpic,
  setOverlayOptionsEpic,
  sendMessageEpic,
  setSystemPromptEpic,
  notifyHostGPTMessageStatus,
  setOverlayOptionsSuccessEpic,
);
