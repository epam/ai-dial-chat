import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { throttle } from '@/src/utils/data/throttle';

import { Conversation, Message, Replay } from '@/src/types/chat';
import { OpenAIEntityModel, OpenAIEntityModelID } from '../../types/openai';

import {
  AddonsActions,
  AddonsSelectors,
} from '@/src/store/addons/addons.reducers';
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
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { DEFAULT_ASSISTANT_SUBMODEL } from '@/src/constants/default-settings';

import { ChatCompareRotate } from './ChatCompareRotate';
import { ChatCompareSelect } from './ChatCompareSelect';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import ChatReplayControls from './ChatReplayControls';
import { ChatSettings } from './ChatSettings';
import { ChatSettingsEmpty } from './ChatSettingsEmpty';
import { ErrorMessageDiv } from './ErrorMessageDiv';
import { MemoizedChatMessage } from './MemoizedChatMessage';
import { NotAllowedModel } from './NotAllowedModel';
import { PlaybackControls } from './PlaybackControls';
import { PlaybackEmptyInfo } from './PlaybackEmptyInfo';

const clearStateForMessages = (messages: Message[]): Message[] => {
  return messages.map((message) => ({
    ...message,
    custom_content: {
      ...message.custom_content,
      state: undefined,
    },
  }));
};

export const Chat = memo(() => {
  const { t } = useTranslation('chat');

  const dispatch = useAppDispatch();
  const appName = useAppSelector(SettingsSelectors.selectAppName);
  const models = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const modelError = useAppSelector(ModelsSelectors.selectModelsError);
  const modelsIsLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);
  const defaultModelId = useAppSelector(SettingsSelectors.selectDefaultModelId);
  const addons = useAppSelector(AddonsSelectors.selectAddons);
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

  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );

  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const [showScrollDownButton, setShowScrollDownButton] =
    useState<boolean>(false);
  const [mergedMessages, setMergedMessages] = useState<any>([]);
  const [isShowChatSettings, setIsShowChatSettings] = useState(false);
  const selectedConversationsTemporarySettings = useRef<Record<string, any>>(
    {},
  );

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const nextMessageBoxRef = useRef<HTMLDivElement | null>(null);
  const [inputHeight, setInputHeight] = useState<number>(142);
  const [isNotAllowedModel, setIsNotAllowedModel] = useState(false);

  const showReplayControls = useMemo(() => {
    return isReplay && !messageIsStreaming && isReplayPaused;
  }, [isReplay, isReplayPaused, messageIsStreaming]);

  useEffect(() => {
    setIsShowChatSettings(false);

    if (selectedConversations.length > 0) {
      const mergedMessages = [];
      for (let i = 0; i < selectedConversations[0].messages.length; i++) {
        if (selectedConversations[0].messages[i].role === 'system') continue;

        mergedMessages.push(
          selectedConversations.map((conv) => [
            conv,
            conv.messages[i] || { role: 'assistant', content: '' },
            i,
          ]),
        );
      }
      setMergedMessages([...mergedMessages]);
    }

    if (selectedConversations.some((conv) => conv.messages.length === 0)) {
      setShowScrollDownButton(false);
    }
  }, [selectedConversations]);

  useEffect(() => {
    const modelIds = models.map((model) => model.id);
    const isNotAllowed = modelsIsLoading
      ? false
      : models.length === 0 ||
        selectedConversations.some((conv) => {
          if (
            conv.replay.isReplay &&
            conv.replay.replayAsIs &&
            conv.replay.replayUserMessagesStack &&
            conv.replay.replayUserMessagesStack[0].model
          ) {
            return conv.replay.replayUserMessagesStack.some(
              (message) =>
                message.role === 'user' &&
                message.model?.id &&
                !modelIds.includes(message.model.id),
            );
          }
          return !modelIds.includes(conv.model.id);
        });
    setIsNotAllowedModel(isNotAllowed);
  }, [selectedConversations, models, modelsIsLoading]);

  const onLikeHandler = useCallback(
    (index: number, conversation: Conversation) => (rate: number) => {
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

  useEffect(() => {
    if (!autoScrollEnabled || !chatContainerRef.current) {
      return;
    }

    chatContainerRef.current.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
    textareaRef.current?.focus();
  }, [autoScrollEnabled]);

  const scrollDown = () => {
    if (!autoScrollEnabled || !chatContainerRef.current) {
      return;
    }

    chatContainerRef.current.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  };
  const throttledScrollDown = throttle(scrollDown, 250);

  useEffect(() => {
    throttledScrollDown();
  }, [conversations, throttledScrollDown]);

  const handleScrollDown = useCallback(() => {
    if (!chatContainerRef.current) {
      return;
    }

    chatContainerRef.current.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  const handleScroll = useCallback(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        chatContainerRef.current;
      const bottomTolerance = 30;

      if (scrollTop + clientHeight < scrollHeight - bottomTolerance) {
        setAutoScrollEnabled(false);
        setShowScrollDownButton(true);
      } else {
        setAutoScrollEnabled(true);
        setShowScrollDownButton(false);
      }
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setAutoScrollEnabled(entry.isIntersecting);
        if (entry.isIntersecting) {
          textareaRef.current?.focus();
        }
      },
      {
        threshold: 0.1,
      },
    );
    const messagesEndElement = messagesEndRef.current;
    if (messagesEndElement) {
      observer.observe(messagesEndElement);
    }
    return () => {
      if (messagesEndElement) {
        observer.unobserve(messagesEndElement);
      }
    };
  }, [messagesEndRef]);

  const handleClearConversation = useCallback(
    (conversation: Conversation) => {
      if (
        confirm(t<string>('Are you sure you want to clear all messages?')) &&
        conversation
      ) {
        const { messages } = conversation;

        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: {
              messages: messages.filter((message) => message.role === 'system'),
            },
          }),
        );
      }
    },
    [dispatch, t],
  );

  const handleReplayStart = useCallback(() => {
    dispatch(
      ConversationsActions.replayConversations({
        conversationsIds: selectedConversationsIds,
      }),
    );
  }, [selectedConversationsIds, dispatch]);

  const handleReplayReStart = useCallback(() => {
    dispatch(
      ConversationsActions.replayConversations({
        conversationsIds: selectedConversationsIds,
        isRestart: true,
      }),
    );
  }, [dispatch, selectedConversationsIds]);

  const handleSelectModel = useCallback(
    (conversation: Conversation, modelId: string) => {
      const newAiEntity = models.find(
        ({ id }) => id === modelId,
      ) as OpenAIEntityModel;

      const updatedReplay: Replay = !conversation.replay.isReplay
        ? conversation.replay
        : {
            ...conversation.replay,
            replayAsIs: false,
          };
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: {
            model: newAiEntity,
            assistantModelId:
              newAiEntity.type === 'assistant'
                ? DEFAULT_ASSISTANT_SUBMODEL.id
                : undefined,
            replay: updatedReplay,
          },
        }),
      );
    },
    [dispatch, models],
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

  const handleOnChangeAddon = useCallback(
    (conversation: Conversation, addonId: string) => {
      const isAddonInConversation = conversation.selectedAddons.some(
        (id) => id === addonId,
      );
      if (isAddonInConversation) {
        const filteredAddons = conversation.selectedAddons.filter(
          (id) => id !== addonId,
        );
        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: { selectedAddons: filteredAddons },
          }),
        );
      } else {
        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: {
              selectedAddons: conversation.selectedAddons.concat(addonId),
            },
          }),
        );
      }
    },
    [dispatch],
  );

  const handleOnApplyAddons = useCallback(
    (conversation: Conversation, addonIds: string[]) => {
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: { selectedAddons: addonIds },
        }),
      );
    },
    [dispatch],
  );

  const handleChangePrompt = useCallback(
    (conversation: Conversation, prompt: string) => {
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: { prompt },
        }),
      );
    },
    [dispatch],
  );

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
    (index: number) => {
      dispatch(ConversationsActions.deleteMessage({ index }));
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
      .lastIndexOf('user');
    dispatch(
      ConversationsActions.sendMessages({
        conversations: selectedConversations,
        message: selectedConversations[0].messages[lastUserMessageIndex],
        deleteCount:
          selectedConversations[0].messages.length - lastUserMessageIndex,
        activeReplayIndex: 0,
      }),
    );
  }, [dispatch, selectedConversations]);

  const onEditMessage = useCallback(
    (editedMessage: Message, index: number) => {
      dispatch(
        ConversationsActions.sendMessages({
          conversations: selectedConversations,
          message: editedMessage,
          deleteCount: selectedConversations[0]?.messages.length - index,
          activeReplayIndex: 0,
        }),
      );
    },
    [dispatch, selectedConversations],
  );

  const handleApplyChatSettings = useCallback(() => {
    selectedConversations.forEach((conversation) => {
      const temporarySettings:
        | {
            modelId: string | undefined;
            prompt: string;
            temperature: number;
            currentAssistentModelId: string | undefined;
            addonsIds: string[];
          }
        | undefined =
        selectedConversationsTemporarySettings.current[conversation.id];
      if (temporarySettings) {
        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: { messages: clearStateForMessages(conversation.messages) },
          }),
        );
        if (temporarySettings.modelId) {
          handleSelectModel(conversation, temporarySettings.modelId);
        }
        handleChangePrompt(conversation, temporarySettings.prompt);
        handleChangeTemperature(conversation, temporarySettings.temperature);
        if (temporarySettings.currentAssistentModelId) {
          handleSelectAssistantSubModel(
            conversation,
            temporarySettings.currentAssistentModelId,
          );
        }
        if (temporarySettings.addonsIds) {
          handleOnApplyAddons(conversation, temporarySettings.addonsIds);
        }
      }
    });
  }, [
    selectedConversations,
    dispatch,
    handleChangePrompt,
    handleChangeTemperature,
    handleSelectModel,
    handleSelectAssistantSubModel,
    handleOnApplyAddons,
  ]);

  const handleTemporarySettingsSave = useCallback(
    (
      conversation: Conversation,
      args: {
        modelId: string | undefined;
        prompt: string;
        temperature: number;
        currentAssistentModelId: string | undefined;
        addonsIds: string[];
      },
    ) => {
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

  useEffect(() => {
    if (showReplayControls) {
      setInputHeight(80);
    }
  }, [showReplayControls]);

  return (
    <div className="relative min-w-0 flex-1" data-qa="chat" id="chat">
      {modelError ? (
        <ErrorMessageDiv error={modelError} />
      ) : (
        <>
          <div
            className={`flex h-full w-full ${
              isCompareMode ? 'landscape:hidden' : 'hidden'
            }`}
          >
            <ChatCompareRotate />
          </div>
          <div
            className={`h-full w-full ${
              isCompareMode ? 'portrait:hidden' : ''
            }`}
          >
            <div className="flex h-full">
              <div
                className={`flex h-full flex-col ${
                  isCompareMode && selectedConversations.length < 2
                    ? 'w-[50%]'
                    : 'w-full'
                }`}
                data-qa={isCompareMode ? 'compare-mode' : 'chat-mode'}
              >
                <div className="flex max-h-full w-full">
                  {selectedConversations.map(
                    (conv) =>
                      conv.messages.length === 0 &&
                      (!conv.playback?.isPlayback ? (
                        <div
                          key={conv.id}
                          className={`flex h-full flex-col justify-between ${
                            selectedConversations.length > 1
                              ? 'w-[50%]'
                              : 'w-full'
                          }`}
                        >
                          <div
                            className="shrink-0"
                            style={{
                              height: `calc(100% - ${inputHeight}px)`,
                            }}
                          >
                            <ChatSettingsEmpty
                              conversation={conv}
                              models={models}
                              addons={addons}
                              prompts={prompts}
                              defaultModelId={
                                defaultModelId || OpenAIEntityModelID.GPT_3_5
                              }
                              isShowSettings={enabledFeatures.includes(
                                'empty-chat-settings',
                              )}
                              onSelectModel={(modelId: string) =>
                                handleSelectModel(conv, modelId)
                              }
                              onSelectAssistantSubModel={(modelId: string) =>
                                handleSelectAssistantSubModel(conv, modelId)
                              }
                              onChangeAddon={(addonId: string) =>
                                handleOnChangeAddon(conv, addonId)
                              }
                              onChangePrompt={(prompt) =>
                                handleChangePrompt(conv, prompt)
                              }
                              onChangeTemperature={(temperature) =>
                                handleChangeTemperature(conv, temperature)
                              }
                              appName={appName}
                            />
                          </div>

                          <div
                            className="shrink-0"
                            style={{ height: inputHeight }}
                          />
                        </div>
                      ) : (
                        <div
                          key={conv.id}
                          className={`flex h-full flex-col justify-between overflow-auto ${
                            selectedConversations.length > 1
                              ? 'w-[50%]'
                              : 'w-full'
                          }`}
                        >
                          <div
                            className="shrink-0"
                            style={{
                              height: `calc(100%-${inputHeight})`,
                            }}
                          >
                            <PlaybackEmptyInfo
                              conversationName={conv.name}
                              appName={appName}
                            />
                          </div>
                        </div>
                      )),
                  )}
                </div>
                <div className="flex w-full">
                  {selectedConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`${
                        isCompareMode && selectedConversations.length > 1
                          ? 'w-[50%]'
                          : 'w-full'
                      }`}
                    >
                      {conv.messages.length !== 0 &&
                        enabledFeatures.includes('top-settings') && (
                          <div className={`z-10 flex flex-col `}>
                            <ChatHeader
                              conversation={conv}
                              isCompareMode={isCompareMode}
                              isShowChatInfo={enabledFeatures.includes(
                                'top-chat-info',
                              )}
                              isShowClearConversation={
                                enabledFeatures.includes(
                                  'top-clear-conversation',
                                ) && !isPlayback
                              }
                              isShowModelSelect={
                                enabledFeatures.includes(
                                  'top-chat-model-settings',
                                ) && !isPlayback
                              }
                              isShowSettings={isShowChatSettings}
                              setShowSettings={(isShow) => {
                                if (isShow) {
                                  dispatch(ModelsActions.getModels());
                                  dispatch(AddonsActions.getAddons());
                                }
                                setIsShowChatSettings(isShow);
                              }}
                              selectedConversationIds={selectedConversationsIds}
                              onClearConversation={() =>
                                handleClearConversation(conv)
                              }
                              onUnselectConversation={(id) => {
                                dispatch(
                                  ConversationsActions.unselectConversations({
                                    conversationIds: [id],
                                  }),
                                );
                              }}
                            />
                          </div>
                        )}
                    </div>
                  ))}
                </div>
                {mergedMessages?.length > 0 && (
                  <div
                    className="flex max-h-full flex-col overflow-x-hidden"
                    ref={setChatContainerRef}
                    onScroll={handleScroll}
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
                                className={`${
                                  isCompareMode &&
                                  selectedConversations.length > 1
                                    ? 'w-[50%]'
                                    : 'w-full'
                                }`}
                              >
                                <div className="h-full w-full">
                                  <MemoizedChatMessage
                                    key={conv.id}
                                    message={message}
                                    messageIndex={index}
                                    conversation={conv}
                                    isLikesEnabled={enabledFeatures.includes(
                                      'likes',
                                    )}
                                    editDisabled={isNotAllowedModel}
                                    onEdit={onEditMessage}
                                    onLike={onLikeHandler(index, conv)}
                                    onDelete={() => {
                                      handleDeleteMessage(index);
                                    }}
                                  />
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      ),
                    )}
                    <div
                      className="shrink-0 "
                      style={{ height: `${inputHeight + 52}px` }}
                      ref={messagesEndRef}
                    />
                  </div>
                )}
              </div>
              {isShowChatSettings && (
                <div
                  className={`absolute left-0 top-0 grid h-full w-full ${
                    selectedConversations.length === 1
                      ? 'grid-cols-1'
                      : 'grid-cols-2'
                  }`}
                >
                  {selectedConversations.map((conv) => (
                    <div className="relative h-full" key={conv.id}>
                      <ChatSettings
                        conversation={conv}
                        defaultModelId={
                          defaultModelId || OpenAIEntityModelID.GPT_3_5
                        }
                        model={modelsMap[conv.model.id]}
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
                        ConversationsActions.selectConversations({
                          conversationIds: [
                            selectedConversations[0].id,
                            conversation.id,
                          ],
                        }),
                      );
                    }}
                  />
                  <div
                    className="shrink-0 "
                    style={{ height: `${inputHeight + 52}px` }}
                  />
                </div>
              )}
            </div>
            {!isPlayback && isNotAllowedModel ? (
              <NotAllowedModel />
            ) : (
              <>
                {showReplayControls ? (
                  <ChatReplayControls
                    onClickReplayStart={handleReplayStart}
                    onClickReplayReStart={handleReplayReStart}
                    showReplayStart={selectedConversations.some(
                      (conv) => conv.messages.length === 0,
                    )}
                  />
                ) : (
                  <>
                    {!isPlayback && (
                      <ChatInput
                        textareaRef={textareaRef}
                        isMessagesPresented={selectedConversations.some(
                          (val) => val.messages.length > 0,
                        )}
                        maxLength={Math.min(
                          ...selectedConversations.map(
                            (conv) => conv.model.maxLength,
                          ),
                        )}
                        showScrollDownButton={showScrollDownButton}
                        onSend={onSendMessage}
                        onScrollDownClick={handleScrollDown}
                        onRegenerate={onRegenerateMessage}
                        onStopConversation={() => {
                          dispatch(ConversationsActions.stopStreamMessage());
                        }}
                        onResize={onChatInputResize}
                      />
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
        </>
      )}
    </div>
  );
});
Chat.displayName = 'Chat';
