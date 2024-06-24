import { signIn } from 'next-auth/react';

import {
  EMPTY,
  concat,
  distinctUntilChanged,
  filter,
  first,
  fromEvent,
  ignoreElements,
  iif,
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

import { Role } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { AppEpic } from '@/src/types/store';

import { DEFAULT_ASSISTANT_SUBMODEL_ID } from '@/src/constants/default-ui-settings';

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
  OverlaySelectors,
  SendMessageOptions,
  SetSystemPromptOptions,
} from './overlay.reducers';

import {
  ChatOverlayOptions,
  Feature,
  OverlayEvents,
  OverlayRequest,
  OverlayRequests,
  overlayAppName,
  validateFeature,
} from '@epam/ai-dial-shared';
import isEqual from 'lodash-es/isEqual';

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
              const { content } = payload as SendMessageOptions;

              return of(OverlayActions.sendMessage({ content, requestId }));
            }
            case OverlayRequests.setSystemPrompt: {
              const { systemPrompt } = payload as SetSystemPromptOptions;

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
    filter(OverlayActions.getMessages.match),
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
          payload: { messages },
        },
      });
    }),
  );

const sendMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(OverlayActions.sendMessage.match),
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
        signInOptions,
        overlayConversationId,
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
        if (overlayConversationId) {
          actions.push(
            of(SettingsActions.setOverlayConversationId(overlayConversationId)),
          );
        }

        // after all actions will send notify that settings are set
        actions.push(
          of(
            OverlayActions.setOverlayOptionsSuccess({ hostDomain, requestId }),
          ),
          of(OverlayActions.signInOptionsSet({ signInOptions })),
          iif(
            () => !AuthSelectors.selectIsShouldLogin(state$.value),
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
    filter(OverlayActions.signInOptionsSet.match),
    tap(({ payload: { signInOptions } }) => {
      const isShouldLogin = AuthSelectors.selectIsShouldLogin(state$.value);

      if (isShouldLogin && signInOptions?.autoSignIn) {
        signIn(signInOptions?.signInProvider);
      }
    }),
    ignoreElements(),
  );

const setOverlayOptionsSuccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(OverlayActions.setOverlayOptionsSuccess.match),
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
    filter(OverlayActions.checkReadyToInteract.match),
    switchMap(() =>
      state$.pipe(
        filter(
          (state) =>
            ConversationsSelectors.selectAreSelectedConversationsLoaded(
              state,
            ) && !AuthSelectors.selectIsShouldLogin(state),
        ),
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
    filter(OverlayActions.sendReadyToInteract.match),
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

      return of(
        OverlayActions.sendPMEvent({
          type: OverlayEvents.selectedConversationLoaded,
          eventParams: { hostDomain },
        }),
      );
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
        isModelLoaded: ModelsSelectors.selectIsModelsLoaded(state),
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
    filter(OverlayActions.sendPMEvent.match),
    tap(({ payload }) => {
      sendPMEvent(payload.type, payload.eventParams);
    }),
    ignoreElements(),
  );

const sendPMResponseEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(OverlayActions.sendPMResponse.match),
    tap(({ payload }) => {
      sendPMResponse(payload.type, payload.requestParams);
    }),
    ignoreElements(),
  );

export const OverlayEpics = combineEpics(
  initOverlayEpic,
  sendPMEventEpic,
  sendPMResponseEpic,
  postMessageMapperEpic,
  getMessagesEpic,
  notifyHostAboutReadyEpic,
  setOverlayOptionsEpic,
  sendMessageEpic,
  notifyHostGPTMessageStatus,
  setOverlayOptionsSuccessEpic,
  signInOptionsSet,
  checkReadyToInteract,
  sendSelectedConversationLoaded,
  sendReadyToInteract,
);
