import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { throttle } from '@/src/utils/data/throttle';

import { OpenAIEntityModel, OpenAIEntityModelID } from '../../types/openai';
import { Conversation, Message } from '@/src/types/chat';

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

import { DEFAULT_ASSISTANT_SUBMODEL } from '@/src/constants/default-settings';

interface Props {
  appName: string;
}

const clearStateForMessages = (messages: Message[]): Message[] => {
  return messages.map((message) => ({
    ...message,
    custom_content: {
      ...message.custom_content,
      state: undefined,
    },
  }));
};

export const Chat = memo(({ appName }: Props) => {
  const { t } = useTranslation('chat');

  const dispatch = useAppDispatch();
  const models = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const modelError = useAppSelector(ModelsSelectors.selectModelsError);
  const modelsIsLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);
  const defaultModelId = useAppSelector(ModelsSelectors.selectDefaultModelId);
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

  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const [showScrollDownButton, setShowScrollDownButton] =
    useState<boolean>(false);
  const [mergedMessages, setMergedMessages] = useState<any>([]);
  const [isShowChatSettings, setIsShowChatSettings] = useState(false);
  const selectedConversationsTemporarySettings = useRef<Record<string, any>>(
    {},
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const [inputHeight, setInputHeight] = useState<number>(142);
  const [isNotAllowedModel, setIsNotAllowedModel] = useState(false);

  useEffect(() => {
    const resizeHandler = () => {
      if (
        inputRef.current?.clientHeight &&
        inputRef.current?.clientHeight !== inputHeight
      ) {
        setInputHeight(inputRef.current?.clientHeight);
      }
    };
    window.addEventListener('resize', resizeHandler);
    resizeHandler();
    return () => {
      window.removeEventListener('resize', resizeHandler);
    };
  }, [inputHeight]);

  useEffect(() => {
    if (selectedConversations.length > 0) {
      const mergedMessages = [];
      for (let i = 0; i < selectedConversations[0].messages.length; i++) {
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
  }, [selectedConversations]);

  useEffect(() => {
    setIsShowChatSettings(false);
  }, [selectedConversations]);

  useEffect(() => {
    const modelIds = models.map((model) => model.id);
    const isNotAllowed = modelsIsLoading
      ? false
      : models.length === 0 ||
        selectedConversations.some((conv) => !modelIds.includes(conv.model.id));
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
    if (autoScrollEnabled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      textareaRef.current?.focus();
    }
  }, [autoScrollEnabled]);

  const scrollDown = () => {
    if (autoScrollEnabled) {
      messagesEndRef.current?.scrollIntoView(true);
    }
  };
  const throttledScrollDown = throttle(scrollDown, 250);

  useEffect(() => {
    throttledScrollDown();
  }, [conversations, throttledScrollDown]);

  const handleScrollDown = useCallback(() => {
    chatContainerRef.current?.scrollTo({
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
        root: chatContainerRef.current,
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
        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: { messages: [] },
          }),
        );
      }
    },
    [dispatch, t],
  );

  const handleReplayStart = useCallback(() => {
    selectedConversationsIds.map((id) => {
      dispatch(ConversationsActions.replayConversation({ conversationId: id }));
    });
  }, [selectedConversationsIds, dispatch]);

  const handleReplayReStart = useCallback(() => {
    selectedConversationsIds.map((id) => {
      dispatch(
        ConversationsActions.replayConversation({
          conversationId: id,
          isRestart: true,
        }),
      );
    });
  }, [dispatch, selectedConversationsIds]);

  const handleSelectModel = useCallback(
    (conversation: Conversation, modelId: string) => {
      const newAiEntity = models.find(
        ({ id }) => id === modelId,
      ) as OpenAIEntityModel;

      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: {
            model: newAiEntity,
            assistantModelId:
              newAiEntity.type === 'assistant'
                ? DEFAULT_ASSISTANT_SUBMODEL.id
                : undefined,
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
      selectedConversations.forEach((conv) => {
        dispatch(
          ConversationsActions.sendMessage({
            conversation: conv,
            message,
            deleteCount: 0,
            activeReplayIndex: 0,
          }),
        );
      });
    },
    [dispatch, selectedConversations],
  );

  const onRegenerateMessage = useCallback(() => {
    selectedConversations.forEach((conv) => {
      const lastUserMessageIndex = conv.messages
        .map((msg) => msg.role)
        .lastIndexOf('user');
      dispatch(
        ConversationsActions.sendMessage({
          conversation: conv,
          message: conv.messages[lastUserMessageIndex],
          deleteCount: conv.messages.length - lastUserMessageIndex,
          activeReplayIndex: 0,
        }),
      );
    });
  }, [dispatch, selectedConversations]);

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

  return (
    <div className="relative flex-1" data-qa="chat">
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
              >
                <div className="flex max-h-full w-full">
                  {selectedConversations.map(
                    (conv) =>
                      conv.messages.length === 0 && (
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
                            <ChatSettingsEmpty
                              conversation={conv}
                              models={models}
                              addons={addons}
                              prompts={prompts}
                              defaultModelId={
                                defaultModelId || OpenAIEntityModelID.GPT_3_5
                              }
                              isShowSettings={enabledFeatures.has(
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
                      ),
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
                        enabledFeatures.has('top-settings') && (
                          <div className={`z-10 flex flex-col `}>
                            <ChatHeader
                              conversation={conv}
                              isCompareMode={isCompareMode}
                              isShowChatInfo={enabledFeatures.has(
                                'top-chat-info',
                              )}
                              isShowClearConversation={enabledFeatures.has(
                                'top-clear-conversation',
                              )}
                              isShowModelSelect={enabledFeatures.has(
                                'top-chat-model-settings',
                              )}
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
                    ref={chatContainerRef}
                    onScroll={handleScroll}
                    data-qa="chat-messages"
                  >
                    {mergedMessages.map(
                      (
                        mergedStr: [Conversation, Message, number][],
                        i: number,
                      ) => (
                        <div key={i} className="flex w-full">
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
                                    isLikesEnabled={enabledFeatures.has(
                                      'likes',
                                    )}
                                    editDisabled={isNotAllowedModel}
                                    onEdit={(editedMessage) => {
                                      selectedConversations.forEach((conv) => {
                                        dispatch(
                                          ConversationsActions.sendMessage({
                                            conversation: conv,
                                            message: editedMessage,
                                            deleteCount:
                                              conv?.messages.length - index,
                                            activeReplayIndex: 0,
                                          }),
                                        );
                                      });
                                    }}
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
                      style={{ height: inputHeight - 10 }}
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
                    style={{ height: inputHeight - 10 }}
                  />
                </div>
              )}
            </div>
            {isNotAllowedModel ? (
              <NotAllowedModel />
            ) : (
              <>
                {isReplay && !messageIsStreaming && isReplayPaused ? (
                  <ChatReplayControls
                    onClickReplayStart={handleReplayStart}
                    onClickReplayReStart={handleReplayReStart}
                    showReplayStart={selectedConversations.some(
                      (conv) => conv.messages.length === 0,
                    )}
                  />
                ) : (
                  <ChatInput
                    ref={inputRef}
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
                  />
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
