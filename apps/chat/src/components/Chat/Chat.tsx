import { FloatingOverlay } from '@floating-ui/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import classNames from 'classnames';

import { clearStateForMessages } from '@/src/utils/app/clear-messages-state';
import { isApplicationModelType } from '@/src/utils/app/conversation';
import { isSmallScreen } from '@/src/utils/app/mobile';

import {
  Conversation,
  ConversationsTemporarySettings,
  LikeState,
  MergedMessages,
  Message,
  Replay,
  Role,
} from '@/src/types/chat';
import { EntityType, UploadStatus } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { AddonsSelectors } from '@/src/store/addons/addons.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';
import { PublicationSelectors } from '@/src/store/publication/publication.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import {
  DEFAULT_ASSISTANT_SUBMODEL_ID,
  DEFAULT_CONVERSATION_NAME,
} from '@/src/constants/default-ui-settings';

import { ApplicationList } from '@/src/components/Chat/ApplicationList';
import { ChatMessagesEmpty } from '@/src/components/Chat/ChatMessagesEmpty';

import Loader from '../Common/Loader';
import { NotFoundEntity } from '../Common/NotFoundEntity';
import { ChatCompareRotate } from './ChatCompareRotate';
import { ChatCompareSelect } from './ChatCompareSelect';
import ChatExternalControls from './ChatExternalControls';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput/ChatInput';
import { ChatInputFooter } from './ChatInput/ChatInputFooter';
import { ChatSettings } from './ChatSettings';
import { ErrorMessageDiv } from './ErrorMessageDiv';
import { MemoizedChatMessage } from './MemoizedChatMessage';
import { NotAllowedModel } from './NotAllowedModel';
import { PlaybackControls } from './Playback/PlaybackControls';
import { PublicationControls } from './Publish/PublicationChatControls';
import { PublicationHandler } from './Publish/PublicationHandler';
import { StartReplayButton } from './StartReplayButton';

import { Feature } from '@epam/ai-dial-shared';
import throttle from 'lodash/throttle';

const scrollThrottlingTimeout = 250;

enum DocumentId {
  queryParam = 'question-your-document',
  modelId = 'rag',
}

export const ChatView = memo(() => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const models = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const modelError = useAppSelector(ModelsSelectors.selectModelsError);
  const isModelsLoaded = useAppSelector(ModelsSelectors.selectIsModelsLoaded);
  const addons = useAppSelector(AddonsSelectors.selectAddons);
  const addonsMap = useAppSelector(AddonsSelectors.selectAddonsMap);
  const isCompareMode = useAppSelector(UISelectors.selectIsCompareMode);
  const selectedConversationsIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const isReplay = useAppSelector(
    ConversationsSelectors.selectIsReplaySelectedConversations,
  );
  const isReplayPaused = useAppSelector(
    ConversationsSelectors.selectIsReplayPaused,
  );
  const isReplayRequiresVariables = useAppSelector(
    ConversationsSelectors.selectIsReplayRequiresVariables,
  );
  const isExternal = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsExternal,
  );
  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );
  const isAnyMenuOpen = useAppSelector(UISelectors.selectIsAnyMenuOpen);
  const isIsolatedView = useAppSelector(SettingsSelectors.selectIsIsolatedView);
  const talkTo = useAppSelector(ConversationsSelectors.selectTalkTo);
  const isExploreAllConversationsSelected = useAppSelector(
    ConversationsSelectors.selectIsExploreAllConversationsSelected,
  );

  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const [showScrollDownButton, setShowScrollDownButton] =
    useState<boolean>(false);
  const [mergedMessages, setMergedMessages] = useState<MergedMessages[]>([]);
  const [isShowChatSettings, setIsShowChatSettings] = useState(false);
  const [isLastMessageError, setIsLastMessageError] = useState(false);
  const [prevSelectedIds, setPrevSelectedIds] = useState<string[]>([]);
  const [inputHeight, setInputHeight] = useState<number>(142);
  const [notAllowedType, setNotAllowedType] = useState<EntityType | null>(null);

  const selectedConversationsTemporarySettings = useRef<
    Record<string, ConversationsTemporarySettings>
  >({});
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const nextMessageBoxRef = useRef<HTMLDivElement | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  const disableAutoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastScrollTop = useRef(0);

  const showReplayControls = useMemo(() => {
    return (
      isReplay &&
      !messageIsStreaming &&
      (isReplayPaused || !!isReplayRequiresVariables)
    );
  }, [isReplay, isReplayPaused, isReplayRequiresVariables, messageIsStreaming]);

  const isNotEmptyConversations =
    isReplayRequiresVariables ||
    selectedConversations.some((conv) => conv.messages.length > 0);

  useEffect(() => {
    const modelIds = models.map((model) => model.id);
    const isNotAllowedModel =
      isModelsLoaded &&
      (models.length === 0 ||
        selectedConversations.some((conv) => {
          if (
            conv.replay &&
            conv.replay.isReplay &&
            conv.replay.replayAsIs &&
            conv.replay.replayUserMessagesStack &&
            conv.replay.replayUserMessagesStack[0].model
          ) {
            return conv.replay.replayUserMessagesStack.some(
              (message) =>
                message.role === Role.User &&
                message.model?.id &&
                !modelIds.includes(message.model.id),
            );
          }

          const model = models.find(({ id }) => id === conv.model.id);

          return (
            !modelIds.includes(conv.model.id) ||
            (model &&
              model.type === EntityType.Assistant &&
              conv.assistantModelId &&
              !modelIds.includes(conv.assistantModelId))
          );
        }));
    if (isNotAllowedModel) {
      setNotAllowedType(EntityType.Model);
    } else if (
      selectedConversations.some((conversation) =>
        conversation.selectedAddons.some((addonId) => !addonsMap[addonId]),
      )
    ) {
      setNotAllowedType(EntityType.Addon);
    } else {
      setNotAllowedType(null);
    }
  }, [selectedConversations, models, isModelsLoaded, addonsMap]);

  const onLikeHandler = useCallback(
    (index: number, conversation: Conversation) => (rate: LikeState) => {
      dispatch(
        ConversationsActions.rateMessage({
          conversationId: conversation.id,
          messageIndex: index,
          rate,
        }),
      );
    },
    [dispatch],
  );

  const setAutoScroll = () => {
    clearTimeout(disableAutoScrollTimeoutRef.current);
    setAutoScrollEnabled(true);
    setShowScrollDownButton(false);
  };

  const scrollDown = useCallback(
    (force = false) => {
      if (autoScrollEnabled || force) {
        setAutoScroll();
        chatContainerRef.current?.scrollTo({
          top: chatContainerRef.current.scrollHeight,
        });
      }
    },
    [autoScrollEnabled],
  );

  useEffect(() => {
    scrollDown();
  }, [scrollDown]);

  const throttledScrollDown = throttle(scrollDown, scrollThrottlingTimeout);

  useEffect(() => {
    throttledScrollDown();
  }, [conversations, throttledScrollDown]);

  const handleScrollDown = useCallback(() => {
    scrollDown(true);
  }, [scrollDown]);

  const handleScroll = useCallback(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        chatContainerRef.current;
      const bottomTolerance = 25;

      if (lastScrollTop.current > scrollTop) {
        setAutoScrollEnabled(false);
        setShowScrollDownButton(true);
      } else if (scrollTop + clientHeight < scrollHeight - bottomTolerance) {
        clearTimeout(disableAutoScrollTimeoutRef.current);

        disableAutoScrollTimeoutRef.current = setTimeout(() => {
          setAutoScrollEnabled(false);
          setShowScrollDownButton(true);
        }, scrollThrottlingTimeout);
      } else {
        setAutoScroll();
      }

      lastScrollTop.current = scrollTop;
    }
  }, []);

  useEffect(() => {
    const lastMergedMessages = mergedMessages.length
      ? mergedMessages[mergedMessages.length - 1]
      : [];

    const isErrorInSomeLastMessage = lastMergedMessages.some(
      (mergedStr: [Conversation, Message, number]) =>
        !!mergedStr[1].errorMessage,
    );
    setIsLastMessageError(isErrorInSomeLastMessage);
  }, [mergedMessages]);

  useEffect(() => {
    const handleResize = () => {
      if (
        chatMessagesRef.current &&
        !messageIsStreaming &&
        mergedMessages.length
      ) {
        handleScroll();
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);

    if (chatMessagesRef.current) {
      resizeObserver.observe(chatMessagesRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [handleScroll, mergedMessages.length, messageIsStreaming]);

  useEffect(() => {
    setIsShowChatSettings(false);

    if (selectedConversations.length > 0) {
      const mergedMessages: MergedMessages[] = [];
      const firstConversationMessages =
        selectedConversations[0].messages.filter((m) => m.role !== Role.System);
      for (let i = 0; i < firstConversationMessages.length; i++) {
        mergedMessages.push(
          selectedConversations.map((conv) => [
            conv,
            conv.messages.filter((m) => m.role !== Role.System)[i] || {
              role: Role.Assistant,
              content: '',
            },
            i,
          ]),
        );
      }

      setMergedMessages(mergedMessages);
    }

    if (
      selectedConversations.every(
        (conv) => !conv.messages.find((m) => m.role !== Role.Assistant),
      )
    ) {
      setShowScrollDownButton(false);
    } else {
      handleScroll();
    }
  }, [handleScroll, selectedConversations]);

  const applySelectedModel = useCallback(
    (
      conversation: Conversation,
      modelId: string | undefined,
    ): Partial<Conversation> => {
      if (modelId === REPLAY_AS_IS_MODEL && conversation.replay) {
        return {
          replay: {
            ...conversation.replay,
            replayAsIs: true,
          },
        };
      }
      const newAiEntity = modelId ? modelsMap[modelId] : undefined;
      if (!modelId || !newAiEntity) {
        return {};
      }

      const updatedReplay: Replay | undefined = !conversation.replay?.isReplay
        ? conversation.replay
        : {
            ...conversation.replay,
            replayAsIs: false,
          };
      const updatedAddons =
        conversation.replay &&
        conversation.replay.isReplay &&
        conversation.replay.replayAsIs &&
        !updatedReplay?.replayAsIs
          ? conversation.selectedAddons.filter((addonId) => addonsMap[addonId])
          : conversation.selectedAddons;

      return {
        model: { id: modelId },
        assistantModelId:
          newAiEntity.type === EntityType.Assistant
            ? DEFAULT_ASSISTANT_SUBMODEL_ID
            : undefined,
        replay: updatedReplay,
        selectedAddons: updatedAddons,
      };
    },
    [addonsMap, modelsMap],
  );

  const handleSelectModel = useCallback(
    (conversation: Conversation, modelId: string) => {
      const newAiEntity = modelsMap[modelId];
      if (!newAiEntity && modelId !== REPLAY_AS_IS_MODEL) {
        return;
      }

      talkTo && dispatch(ConversationsActions.setTalkTo(''));
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: {
            ...applySelectedModel(conversation, modelId),
          },
        }),
      );
    },
    [applySelectedModel, dispatch, modelsMap, talkTo],
  );

  const handleSelectAssistantSubModel = useCallback(
    (conversation: Conversation, modelId: string) => {
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: { assistantModelId: modelId },
        }),
      );
    },
    [dispatch],
  );

  const onCreateNewConversation = useCallback(
    (modelId: string) => {
      dispatch(
        ConversationsActions.createNewConversations({
          modelId,
          names: [t(DEFAULT_CONVERSATION_NAME, { ns: Translation.Common })],
        }),
      );
      talkTo && dispatch(ConversationsActions.setTalkTo(''));
    },
    [dispatch],
  );

  const onUpdateFavoriteApp = useCallback(
    (modelId: string, isFavorite: boolean) => {
      dispatch(
        ModelsActions.updateFavoriteApplicationsIds({
          appsIds: [modelId],
          isFavorite,
        }),
      );
    },
    [dispatch],
  );

  useEffect(() => {
    if (!selectedConversationsIds.some((id) => prevSelectedIds.includes(id))) {
      setAutoScroll();
      chatContainerRef.current?.scrollTo({
        top: chatContainerRef.current.scrollHeight,
      });
      setPrevSelectedIds(selectedConversationsIds);
    }
  }, [prevSelectedIds, selectedConversationsIds]);

  const handleChangeTemperature = useCallback(
    (conversation: Conversation, temperature: number) => {
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: { temperature },
        }),
      );
    },
    [dispatch],
  );

  const handleDeleteMessage = useCallback(
    (index: number, conv: Conversation) => {
      let finalIndex = index;
      if (conv.messages.at(0)?.role === Role.System) {
        finalIndex += 1;
      }
      dispatch(ConversationsActions.deleteMessage({ index: finalIndex }));
    },
    [dispatch],
  );

  const onSendMessage = useCallback(
    (message: Message) => {
      dispatch(
        ConversationsActions.sendMessages({
          conversations: selectedConversations,
          message,
          deleteCount: 0,
          activeReplayIndex: 0,
        }),
      );
    },
    [dispatch, selectedConversations],
  );

  const onRegenerateMessage = useCallback(() => {
    const lastUserMessageIndex = selectedConversations[0].messages
      .map((msg) => msg.role)
      .lastIndexOf(Role.User);
    dispatch(
      ConversationsActions.sendMessages({
        conversations: selectedConversations,
        message: selectedConversations[0].messages[lastUserMessageIndex],
        deleteCount:
          selectedConversations[0].messages.length - lastUserMessageIndex,
        activeReplayIndex: 0,
      }),
    );

    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [dispatch, selectedConversations]);

  const onEditMessage = useCallback(
    (editedMessage: Message, index: number) => {
      dispatch(ConversationsActions.stopStreamMessage());
      dispatch(
        ConversationsActions.sendMessages({
          conversations: selectedConversations,
          message: editedMessage,
          deleteCount: mergedMessages.length - index,
          activeReplayIndex: 0,
        }),
      );
    },
    [dispatch, mergedMessages.length, selectedConversations],
  );

  const handleApplyChatSettings = useCallback(() => {
    selectedConversations.forEach((conversation) => {
      const temporarySettings: ConversationsTemporarySettings | undefined =
        selectedConversationsTemporarySettings.current[conversation.id];
      if (temporarySettings) {
        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: {
              messages: clearStateForMessages(conversation.messages),
              ...applySelectedModel(conversation, temporarySettings.modelId),
              prompt: temporarySettings.prompt,
              temperature: temporarySettings.temperature,
              assistantModelId: temporarySettings.currentAssistentModelId,
              selectedAddons: temporarySettings.addonsIds.filter(
                (addonId) => addonsMap[addonId],
              ),
              isShared: temporarySettings.isShared,
            },
          }),
        );
      }
    });
  }, [selectedConversations, dispatch, applySelectedModel, addonsMap]);

  const handleTemporarySettingsSave = useCallback(
    (conversation: Conversation, args: ConversationsTemporarySettings) => {
      selectedConversationsTemporarySettings.current[conversation.id] = args;
    },
    [],
  );

  const setChatContainerRef = useCallback((ref: HTMLDivElement | null) => {
    chatContainerRef.current = ref;

    if (!ref) {
      return;
    }

    ref.scrollTo({ top: ref.scrollHeight });
  }, []);

  const onChatInputResize = useCallback((inputHeight: number) => {
    setInputHeight(inputHeight);
  }, []);

  const showLastMessageRegenerate =
    !isReplay &&
    !isPlayback &&
    !isExternal &&
    !messageIsStreaming &&
    !isLastMessageError;
  const showFloatingOverlay =
    isSmallScreen() && isAnyMenuOpen && !isIsolatedView;

  return (
    <div
      className="relative min-w-0 shrink grow basis-0 overflow-y-auto text-primary-bg-light"
      data-qa="chat"
      id="chat"
    >
      {showFloatingOverlay && <FloatingOverlay className="z-30 bg-blackout" />}
      {modelError ? (
        <ErrorMessageDiv error={modelError} />
      ) : (
        <>
          <div
            className={classNames(
              'flex size-full',
              isCompareMode ? 'landscape:hidden' : 'hidden',
            )}
          >
            <ChatCompareRotate />
          </div>
          <div
            className={classNames(
              'relative size-full',
              isCompareMode && 'portrait:hidden',
            )}
          >
            <div className="flex h-full">
              <div
                className={classNames(
                  'flex h-full flex-col',
                  isCompareMode && selectedConversations.length < 2
                    ? 'w-[50%]'
                    : 'w-full',
                )}
                data-qa={isCompareMode ? 'compare-mode' : 'chat-mode'}
              >
                <div className="flex h-full flex-col justify-between">
                  {isExploreAllConversationsSelected ? (
                    <ApplicationList
                      onCreateNewConversation={onCreateNewConversation}
                      onUpdateFavoriteApp={onUpdateFavoriteApp}
                    />
                  ) : (
                    <>
                      <div className="flex w-full">
                        {selectedConversations.map((conv) => (
                          <div
                            key={conv.id}
                            className={classNames(
                              isCompareMode && selectedConversations.length > 1
                                ? 'w-[50%]'
                                : 'w-full',
                            )}
                          >
                            <div className="z-10 flex flex-col">
                              <ChatHeader
                                conversation={conv}
                                onSelectModel={(modelId: string) =>
                                  handleSelectModel(conv, modelId)
                                }
                                onSelectAssistantSubModel={(modelId: string) =>
                                  handleSelectAssistantSubModel(conv, modelId)
                                }
                                onChangeTemperature={(temperature) =>
                                  handleChangeTemperature(conv, temperature)
                                }
                                onCreateNewConversation={
                                  onCreateNewConversation
                                }
                                onUpdateFavoriteApp={onUpdateFavoriteApp}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div
                        onScroll={() => {
                          if (
                            selectedConversations.some(
                              (conv) =>
                                !!conv.messages.find(
                                  (m) => m.role !== Role.Assistant,
                                ),
                            )
                          ) {
                            handleScroll();
                          }
                        }}
                        ref={setChatContainerRef}
                        className="h-full overflow-x-hidden"
                        data-qa="scrollable-area"
                      >
                        {selectedConversations.map(
                          (conv) =>
                            conv.messages.length === 0 && (
                              <div
                                key={conv.id}
                                className="flex size-full flex-col justify-center gap-10"
                              >
                                <ChatMessagesEmpty conversation={conv} />
                              </div>
                            ),
                        )}
                        <div ref={chatMessagesRef}>
                          {mergedMessages?.length > 0 && (
                            <div
                              className="flex flex-col"
                              data-qa="chat-messages"
                            >
                              {mergedMessages.map(
                                (
                                  mergedStr: [Conversation, Message, number][],
                                  i: number,
                                ) => (
                                  <div
                                    key={i}
                                    className="flex w-full"
                                    data-qa={
                                      isCompareMode
                                        ? 'compare-message-row'
                                        : 'message-row'
                                    }
                                  >
                                    {mergedStr.map(
                                      ([conv, message, index]: [
                                        Conversation,
                                        Message,
                                        number,
                                      ]) => (
                                        <div
                                          key={conv.id}
                                          className={classNames(
                                            isCompareMode &&
                                              selectedConversations.length > 1
                                              ? 'w-[50%]'
                                              : 'w-full',
                                          )}
                                        >
                                          <div className="size-full">
                                            <MemoizedChatMessage
                                              talkTo={talkTo}
                                              key={conv.id}
                                              message={message}
                                              messageIndex={index}
                                              conversation={conv}
                                              isLikesEnabled={enabledFeatures.has(
                                                Feature.Likes,
                                              )}
                                              editDisabled={
                                                !!notAllowedType || isExternal
                                              }
                                              onEdit={onEditMessage}
                                              onLike={onLikeHandler(
                                                index,
                                                conv,
                                              )}
                                              onDelete={() => {
                                                handleDeleteMessage(
                                                  index,
                                                  conv,
                                                );
                                              }}
                                              onRegenerate={
                                                index ===
                                                  mergedMessages.length - 1 &&
                                                showLastMessageRegenerate
                                                  ? onRegenerateMessage
                                                  : undefined
                                              }
                                              messagesLength={
                                                mergedMessages.length
                                              }
                                            />
                                          </div>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {!isPlayback && notAllowedType ? (
                        <NotAllowedModel
                          showScrollDownButton={showScrollDownButton}
                          onScrollDownClick={handleScrollDown}
                          type={notAllowedType}
                        />
                      ) : (
                        <>
                          {isExternal && selectedConversations.length === 1 && (
                            <div
                              className={classNames(
                                !isPlayback && 'relative top-[-46px]',
                              )}
                            >
                              <PublicationControls
                                showScrollDownButton={showScrollDownButton}
                                entity={selectedConversations[0]}
                                onScrollDownClick={handleScrollDown}
                                controlsClassNames="mx-2 mb-2 mt-5 w-full flex-row md:mx-4 md:mb-0 md:last:mb-6 lg:mx-auto lg:w-[768px] lg:max-w-3xl"
                              />
                            </div>
                          )}

                          {!isPlayback && (
                            <ChatInput
                              showReplayControls={showReplayControls}
                              textareaRef={textareaRef}
                              showScrollDownButton={showScrollDownButton}
                              onSend={onSendMessage}
                              onScrollDownClick={handleScrollDown}
                              onRegenerate={onRegenerateMessage}
                              isLastMessageError={isLastMessageError}
                              onStopConversation={() => {
                                dispatch(
                                  ConversationsActions.stopStreamMessage(),
                                );
                              }}
                              onResize={onChatInputResize}
                              isShowInput={
                                (!isReplay || isNotEmptyConversations) &&
                                !isExternal
                              }
                            >
                              {showReplayControls &&
                                !isNotEmptyConversations && (
                                  <StartReplayButton />
                                )}
                              {isExternal && (
                                <ChatExternalControls
                                  conversations={selectedConversations}
                                  showScrollDownButton={showScrollDownButton}
                                  onScrollDownClick={handleScrollDown}
                                />
                              )}
                            </ChatInput>
                          )}

                          {isPlayback && (
                            <PlaybackControls
                              nextMessageBoxRef={nextMessageBoxRef}
                              showScrollDownButton={showScrollDownButton}
                              onScrollDownClick={handleScrollDown}
                              onResize={onChatInputResize}
                            />
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
              {isShowChatSettings && (
                <div
                  className={classNames(
                    'absolute left-0 top-0 grid size-full',
                    selectedConversations.length === 1
                      ? 'grid-cols-1'
                      : 'grid-cols-2',
                  )}
                >
                  {selectedConversations.map((conv) => (
                    <div className="relative h-full" key={conv.id}>
                      <ChatSettings
                        conversation={conv}
                        modelId={conv.model.id}
                        prompts={prompts}
                        addons={addons}
                        onChangeSettings={(args) => {
                          handleTemporarySettingsSave(conv, args);
                        }}
                        onApplySettings={handleApplyChatSettings}
                        onClose={() => setIsShowChatSettings(false)}
                      />
                    </div>
                  ))}
                </div>
              )}
              {isCompareMode && selectedConversations.length < 2 && (
                <div className="flex h-full w-[50%] flex-col overflow-auto">
                  <ChatCompareSelect
                    conversations={conversations}
                    selectedConversations={selectedConversations}
                    onConversationSelect={(conversation) => {
                      dispatch(
                        ConversationsActions.selectForCompare(conversation),
                      );
                    }}
                  />
                  <div
                    className="shrink-0"
                    style={{ height: inputHeight + 56 }}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
});
ChatView.displayName = 'ChatView';

export function Chat() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { t } = useTranslation(Translation.Chat);

  const areSelectedConversationsLoaded = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsLoaded,
  );
  const selectedConversationsIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const modelIsLoaded = useAppSelector(ModelsSelectors.selectIsModelsLoaded);
  const isolatedModelId = useAppSelector(
    SettingsSelectors.selectIsolatedModelId,
  );
  const activeModel = useAppSelector((state) =>
    ModelsSelectors.selectModel(state, isolatedModelId || ''),
  );
  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );
  const models = useAppSelector(ModelsSelectors.selectModels);
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const talkTo = useAppSelector(ConversationsSelectors.selectTalkTo);
  const isConversationUpdatedFromQueryParams = useAppSelector(
    ConversationsSelectors.selectIsConversationUpdatedFromQueryParams,
  );
  const currentChatId = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const isInitFoldersAndConversations = useAppSelector(
    ConversationsSelectors.selectIsInitFoldersAndConversations,
  );
  const isExploreAllConversationsSelected = useAppSelector(
    ConversationsSelectors.selectIsExploreAllConversationsSelected,
  );

  const currentConversation = conversations.find(
    (chat) => chat?.id === currentChatId?.[0],
  );

  const modelIds = useMemo(
    () => [...models.map((model) => model.id)],
    [models],
  );

  useEffect(() => {
    const { talkto } = router?.query || {};

    if (modelIds?.length > 0 && talkto) {
      const modelId =
        talkto === DocumentId.queryParam
          ? DocumentId.modelId
          : (talkto as string);

      if (
        currentConversation?.id !== modelId &&
        areSelectedConversationsLoaded &&
        isInitFoldersAndConversations &&
        !isConversationUpdatedFromQueryParams &&
        modelIds?.includes(modelId)
      ) {
        if (!isApplicationModelType(modelId)) {
          dispatch(
            ModelsActions.updateRecentModels({ modelId, rearrange: true }),
          );
        }
        dispatch(ConversationsActions.updateConversationFromQueryParams(true));
        dispatch(
          selectedConversations[0].messages.length ||
            selectedConversations[0].isPlayback ||
            selectedConversations[0].isReplay
            ? ConversationsActions.createNewConversations({
                names: [
                  t(DEFAULT_CONVERSATION_NAME, { ns: Translation.Common }),
                ],
                modelId,
              })
            : ConversationsActions.updateConversation({
                id: selectedConversationsIds[0],
                values: {
                  model: { id: modelId as string },
                },
              }),
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areSelectedConversationsLoaded, isInitFoldersAndConversations]);

  useEffect(() => {
    if (isConversationUpdatedFromQueryParams && !talkTo) {
      const { pathname } = router;

      router.push(pathname, undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talkTo]);

  if (selectedPublication?.resources && !selectedConversationsIds.length) {
    return (
      <>
        <PublicationHandler publication={selectedPublication} />
        <ChatInputFooter />
      </>
    );
  }

  if (isolatedModelId && modelIsLoaded && !activeModel) {
    return (
      <div className="h-screen pt-2">
        <NotFoundEntity
          entity={t('chat.common.not_found_entity.model.label')}
          additionalText={
            t('chat.common.not_found_entity.model.additional.text') || ''
          }
        />
      </div>
    );
  }

  if (
    !isExploreAllConversationsSelected &&
    !areSelectedConversationsLoaded &&
    (!selectedConversations.length ||
      selectedConversations.some((conv) => conv.status !== UploadStatus.LOADED))
  ) {
    return <Loader containerClassName="text-primary-bg-light h-full" />;
  }
  if (
    selectedConversations.length !== selectedConversationsIds.length ||
    selectedConversations.some((conv) => conv.status !== UploadStatus.LOADED)
  ) {
    return (
      <NotFoundEntity
        entity={t('chat.common.not_found_entity.conversation.label')}
        additionalText={
          t('chat.common.not_found_entity.conversation.additional.text') || ''
        }
      />
    );
  }
  return <ChatView />;
}
