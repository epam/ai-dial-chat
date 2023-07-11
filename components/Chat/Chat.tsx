import {
  MouseEventHandler,
  MutableRefObject,
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import { getEndpoint } from '@/utils/app/api';
import { showAPIToastError } from '@/utils/app/errors';
import { mergeMessages, parseStreamMessages } from '@/utils/app/merge-streams';
import { throttle } from '@/utils/data/throttle';

import { OpenAIEntityModel, OpenAIEntityModelID } from '../../types/openai';
import { ChatBody, Conversation, Message } from '@/types/chat';

import HomeContext from '@/pages/api/home/home.context';

import { ChatCompareSelect } from './ChatCompareSelect';
import { ChatEmpty } from './ChatEmpty';
import { ChatInput } from './ChatInput';
import { ChatLoader } from './ChatLoader';
import ChatReplayControls from './ChatReplayControls';
import { ChatSettings } from './ChatSettings';
import { ErrorMessageDiv } from './ErrorMessageDiv';
import { MemoizedChatMessage } from './MemoizedChatMessage';
import { NoApiKeySet } from './NoApiKeySet';
import { NotAllowedModel } from './NotAllowedModel';

import { errorsMessages } from '@/constants/errors';

interface Props {
  stopConversationRef: MutableRefObject<boolean>;
  appName: string;
}

const handleRate = (
  message: Message,
  id: string,
  model: OpenAIEntityModel,
  apiKey: string,
) => {
  if (!message.like) {
    return;
  }
  fetch('/api/rate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key: apiKey,
      message,
      id,
      model,
      value: message.like > 0 ? true : false,
    }),
  }).then();
};

const findSelectedConversations = (
  selectedConversationIds: string[],
  conversations: Conversation[],
) => {
  const ids = new Set(selectedConversationIds);

  return conversations.filter((i) => i != null && ids.has(i.id));
};

export const Chat = memo(({ stopConversationRef, appName }: Props) => {
  const { t } = useTranslation('chat');

  const {
    state: {
      conversations,
      selectedConversationIds,
      models,
      addons,
      apiKey,
      serverSideApiKeyIsSet,
      modelError,
      loading,
      prompts,
      defaultModelId,
      isCompareMode,
      messageIsStreaming,
      enabledFeatures,
      isIframe,
      modelIconMapping,
      lightMode,
    },
    handleUpdateConversation,
    handleSelectConversation,
    dispatch: homeDispatch,
  } = useContext(HomeContext);

  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const [showScrollDownButton, setShowScrollDownButton] =
    useState<boolean>(false);
  const [activeReplayIndex, setActiveReplayIndex] = useState<number>(0);
  const [selectedConversations, setSelectedConversations] = useState<
    Conversation[]
  >([]);
  const [mergedMessages, setMergedMessages] = useState<any>([]);
  const [isReplayPaused, setIsReplayPaused] = useState<boolean>(true);
  const [isReplay, setIsReplay] = useState<boolean>(false);

  const localConversations = useRef<Conversation[]>(conversations);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const [inputHeight, setInputHeight] = useState<number>(142);
  const messageIsStreamingAmount = useRef<number>(0);
  const [isNotAllowedModel, setIsNotAllowedModel] = useState(false);

  useEffect(() => {
    if (
      inputRef.current?.clientHeight &&
      inputRef.current?.clientHeight !== inputHeight
    ) {
      setInputHeight(inputRef.current?.clientHeight);
    }
  });

  const handleMessageIsStreamingChange = (amount: number) => {
    messageIsStreamingAmount.current += amount;
    homeDispatch({
      field: 'messageIsStreaming',
      value: messageIsStreamingAmount.current !== 0,
    });
  };

  const isSelectedConversations =
    !!selectedConversations && selectedConversations.length > 0;

  const isEmptySelectedConversation = isSelectedConversations
    ? selectedConversations?.some(({ messages }) => messages.length === 0)
    : true;

  const isErrorMessage =
    isSelectedConversations && !isEmptySelectedConversation
      ? selectedConversations.some(
          ({ messages }) => messages[messages.length - 1].isError ?? false,
        )
      : false;

  const replayUserMessagesStack =
    isSelectedConversations &&
    selectedConversations[0].replay?.replayUserMessagesStack;

  const isLastActiveReplayIndex =
    replayUserMessagesStack &&
    replayUserMessagesStack?.length <= activeReplayIndex;

  const isLastMessageFromAssistant =
    !isEmptySelectedConversation &&
    selectedConversations[0].messages[
      selectedConversations[0].messages.length - 1
    ].role === 'assistant';

  const isReplayFinished =
    isLastActiveReplayIndex && isLastMessageFromAssistant;

  useEffect(() => {
    localConversations.current = conversations;
    if (selectedConversationIds.length > 0) {
      const selectedConversations = findSelectedConversations(
        selectedConversationIds,
        conversations,
      );
      setSelectedConversations(selectedConversations);

      let mergedMessages = [];
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
  }, [selectedConversationIds, conversations]);

  useEffect(() => {
    const modelIds = models.map((model) => model.id);
    setIsNotAllowedModel(
      models.length > 0 &&
        selectedConversations.some((conv) => !modelIds.includes(conv.model.id)),
    );
  }, [selectedConversations, models]);

  const handleSend = useCallback(
    async (
      conversation: Conversation,
      message: Message,
      deleteCount = 0,
      activeReplayIndex = 0,
    ) => {
      if (!conversation) {
        return;
      }

      let updatedConversation: Conversation;
      if (deleteCount) {
        const updatedMessages = [...conversation.messages];
        for (let i = 0; i < deleteCount; i++) {
          updatedMessages.pop();
        }
        updatedConversation = {
          ...conversation,
          messages: [...updatedMessages, message],
          replay: {
            ...conversation.replay,
            activeReplayIndex: activeReplayIndex,
          },
        };
        localConversations.current = handleUpdateConversation(
          updatedConversation,
          {
            key: 'messages',
            value: [...updatedMessages, message],
          },
          localConversations.current,
        );
      } else {
        updatedConversation = {
          ...conversation,
          messages: [...conversation.messages, message],
          replay: {
            ...conversation.replay,
            activeReplayIndex: activeReplayIndex,
          },
        };
        localConversations.current = handleUpdateConversation(
          updatedConversation,
          {
            key: 'messages',
            value: [...conversation.messages, message],
          },
          localConversations.current,
        );
      }
      homeDispatch({ field: 'loading', value: true });
      handleMessageIsStreamingChange(1);

      const lastModel = models.find(
        (model) => model.id === conversation.model.id,
      ) as OpenAIEntityModel;
      const selectedAddons = Array.from(
        new Set([
          ...conversation.selectedAddons,
          ...(lastModel.selectedAddons ?? []),
        ]),
      );
      const chatBody: ChatBody = {
        modelId: conversation.model.id,
        messages: updatedConversation.messages.map((message) => {
          const gptMessage = { ...message, like: void 0 };
          return gptMessage;
        }),
        id: conversation.id.toLowerCase(),
        key: apiKey,
        prompt: updatedConversation.prompt,
        temperature: updatedConversation.temperature,
        selectedAddons: selectedAddons,
      };
      const endpoint = getEndpoint();
      let body;
      body = JSON.stringify(chatBody);
      const controller = new AbortController();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body,
      });

      if (!response.ok) {
        homeDispatch({ field: 'loading', value: false });
        handleMessageIsStreamingChange(-1);

        await showAPIToastError(response, t(errorsMessages.generalServer));
        const errorMessage: Message = {
          content: t(
            'Error happened during answering. Please regenerate response',
          ),
          role: 'assistant',
          isError: true,
        };

        localConversations.current = handleUpdateConversation(
          updatedConversation,
          {
            key: 'messages',
            value: [...updatedConversation.messages, errorMessage],
          },
          localConversations.current,
        );
        return { error: true };
      }
      const data = response.body;
      if (!data) {
        homeDispatch({ field: 'loading', value: false });
        handleMessageIsStreamingChange(-1);

        return { error: true };
      }

      if (
        updatedConversation.messages.length === 1 &&
        !updatedConversation.replay.isReplay
      ) {
        const { content } = message;
        const customName =
          content.length > 30 ? content.substring(0, 30) + '...' : content;
        updatedConversation = {
          ...updatedConversation,
          name: customName,
        };
        localConversations.current = handleUpdateConversation(
          updatedConversation,
          {
            key: 'name',
            value: customName,
          },
          localConversations.current,
        );
      }
      homeDispatch({ field: 'loading', value: false });
      const reader = data.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let isFirst = true;
      let newMessage: Message = { content: '' } as Message;
      while (!done) {
        if (stopConversationRef.current === true) {
          controller.abort();
          done = true;
          break;
        }
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = parseStreamMessages(decoder.decode(value));
        mergeMessages(newMessage, chunkValue);
        let updatedMessages: Message[];

        if (isFirst) {
          isFirst = false;
          updatedMessages = [...updatedConversation.messages, newMessage];
        } else {
          updatedMessages = updatedConversation.messages.map(
            (message, index) => {
              if (index === updatedConversation.messages.length - 1) {
                return newMessage;
              }
              return message;
            },
          );
        }
        updatedConversation = {
          ...updatedConversation,
          messages: updatedMessages,
        };
        localConversations.current = handleUpdateConversation(
          updatedConversation,
          {
            key: 'messages',
            value: updatedMessages,
          },
          localConversations.current,
        );
      }

      homeDispatch({ field: 'loading', value: false });
      handleMessageIsStreamingChange(-1);
    },
    [apiKey, conversations, stopConversationRef, models],
  );

  const onLikeHandler = useCallback(
    (index: number, conversation: Conversation) => (editedMessage: Message) => {
      if (!conversation) {
        return;
      }
      const messages = [...conversation.messages];
      messages[index] = editedMessage;
      handleUpdateConversation(conversation, {
        key: 'messages',
        value: messages,
      });
      handleRate(
        editedMessage,
        conversation?.id ?? '',
        conversation.model,
        apiKey,
      );
    },
    [apiKey, handleUpdateConversation],
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

  const handleScrollDown = () => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  };

  const handleScroll = () => {
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
  };

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

  const handleClearConversation = (conversation: Conversation) => {
    if (
      confirm(t<string>('Are you sure you want to clear all messages?')) &&
      conversation
    ) {
      handleUpdateConversation(conversation, {
        key: 'messages',
        value: [],
      });
    }
  };

  const handleReplay = async (
    deleteCount = 0,
    replayIndex = activeReplayIndex,
    isError = isErrorMessage,
  ) => {
    if (replayUserMessagesStack && !!replayUserMessagesStack[replayIndex]) {
      const selectedConversationsLocal = findSelectedConversations(
        selectedConversationIds,
        [...localConversations.current],
      );

      const sendToAllSelectedConversations = selectedConversationsLocal.map(
        (conversation) => {
          return handleSend(
            conversation,
            replayUserMessagesStack[replayIndex],
            deleteCount,
            replayIndex,
          );
        },
      );
      try {
        const response = await Promise.all(sendToAllSelectedConversations);
        let isResponseError = false;
        response.forEach((res) => {
          if (res && res.error) {
            isResponseError = res.error;
          }
        });

        if (
          stopConversationRef.current !== true &&
          !isError &&
          !isResponseError
        ) {
          setActiveReplayIndex(
            (prevActiveReplayIndex) => prevActiveReplayIndex + 1,
          );
        } else {
          setIsReplayPaused(true);
        }
      } catch {
        setIsReplayPaused(true);
      }
    }
  };

  const onClickReplayStart: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    setIsReplayPaused(false);
    handleReplay();
  };

  const onClickReplayReStart: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();

    if (isLastMessageFromAssistant) {
      handleReplay(2, activeReplayIndex, false);
    } else {
      handleReplay(1, activeReplayIndex, false);
    }
    setIsReplayPaused(false);
  };
  const handleReplayStop = () => {
    if (isReplayFinished) {
      const selectedConversations = findSelectedConversations(
        selectedConversationIds,
        localConversations.current,
      );
      selectedConversations.forEach((conv) => {
        const updatedReplay = {
          ...conv.replay,
          isReplay: false,
        };
        handleUpdateConversation(conv, { key: 'replay', value: updatedReplay });
      });
      setIsReplayPaused(true);
    }
  };

  const handleSelectModel = (conversation: Conversation, modelId: string) => {
    const model = models.find(
      (model) => model.id === modelId,
    ) as OpenAIEntityModel;
    const updatedConversation: Conversation = {
      ...conversation,
      model: model,
      selectedAddons: model.selectedAddons ?? [],
    };
    handleUpdateConversation(updatedConversation, {
      key: 'model',
      value: model,
    });
  };

  const handleChangePrompt = (conversation: Conversation, prompt: string) =>
    handleUpdateConversation(conversation, {
      key: 'prompt',
      value: prompt,
    });

  const handleChangeTemperature = (
    conversation: Conversation,
    temperature: number,
  ) =>
    handleUpdateConversation(conversation, {
      key: 'temperature',
      value: temperature,
    });

  const handleDeleteMessage = (message: Message) => {
    selectedConversations.forEach((conversation) => {
      const { messages } = conversation;
      const findIndex = messages.findIndex(
        ({ content }) => content === message.content,
      );

      if (findIndex < 0) return;

      if (
        findIndex < messages.length - 1 &&
        messages[findIndex + 1].role === 'assistant'
      ) {
        messages.splice(findIndex, 2);
      } else {
        messages.splice(findIndex, 1);
      }
      const updatedConversation = {
        ...conversation,
        messages,
      };

      handleUpdateConversation(updatedConversation, {
        key: 'messages',
        value: messages,
      });
    });
  };

  useEffect(() => {
    if (
      isReplay &&
      !loading &&
      !messageIsStreaming &&
      !isEmptySelectedConversation &&
      isLastMessageFromAssistant &&
      !isErrorMessage &&
      !isReplayPaused
    ) {
      if (!isReplayFinished) {
        handleReplay();
      } else {
        handleReplayStop();
      }
    }
  }, [messageIsStreaming, activeReplayIndex, selectedConversations]);

  useEffect(() => {
    if (selectedConversationIds.length > 0) {
      const selectedConversations = findSelectedConversations(
        selectedConversationIds,
        conversations,
      );

      const isReplayConv = selectedConversations[0].replay.isReplay;

      setIsReplay(isReplayConv);
      if (isReplayConv) {
        setActiveReplayIndex(
          selectedConversations[0].replay.activeReplayIndex ?? 0,
        );
      }
    }
  }, [selectedConversationIds]);

  return (
    <div className="relative flex-1 overflow-hidden bg-white dark:bg-[#343541]">
      {!(apiKey || serverSideApiKeyIsSet) ? (
        <NoApiKeySet appName={appName} />
      ) : modelError ? (
        <ErrorMessageDiv error={modelError} />
      ) : (
        <>
          <div className="flex h-full overflow-hidden">
            <div
              className={`flex flex-col h-full overflow-hidden ${
                isCompareMode && selectedConversations.length < 2
                  ? 'w-[50%]'
                  : 'w-full'
              }`}
            >
              <div className="flex w-full sticky top-0 z-10">
                {selectedConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`${
                      isCompareMode && selectedConversations.length > 1
                        ? 'w-[50%]'
                        : 'w-full'
                    }`}
                  >
                    {conv.messages.length === 0 ? (
                      <ChatEmpty
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
                        onChangePrompt={(prompt) =>
                          handleChangePrompt(conv, prompt)
                        }
                        onChangeTemperature={(temperature) =>
                          handleChangeTemperature(conv, temperature)
                        }
                        appName={appName}
                      />
                    ) : (
                      enabledFeatures.has('top-settings') && (
                        <ChatSettings
                          messageIsStreaming={messageIsStreaming}
                          conversation={conv}
                          defaultModelId={
                            defaultModelId || OpenAIEntityModelID.GPT_3_5
                          }
                          models={models}
                          addons={addons}
                          isCompareMode={isCompareMode}
                          isShowChatInfo={enabledFeatures.has('top-chat-info')}
                          isShowClearConversation={enabledFeatures.has(
                            'top-clear-conversation',
                          )}
                          isShowModelSelect={enabledFeatures.has(
                            'top-chat-model-settings',
                          )}
                          isIframe={isIframe}
                          selectedConversationIds={selectedConversationIds}
                          onClearConversation={() =>
                            handleClearConversation(conv)
                          }
                          onSelectModel={(modelId: string) =>
                            handleSelectModel(conv, modelId)
                          }
                          onUnselectConversation={() => {
                            const filteredSelectedConversation =
                              selectedConversations.filter(
                                ({ id }) => id !== conv.id,
                              )[0];
                            handleSelectConversation(
                              filteredSelectedConversation,
                            );
                          }}
                        />
                      )
                    )}
                  </div>
                ))}
              </div>
              <div
                className="max-h-full overflow-x-hidden flex flex-col"
                ref={chatContainerRef}
                onScroll={handleScroll}
              >
                {mergedMessages.map(
                  (mergedStr: [Conversation, Message, number][], i: number) => (
                    <div key={i} className="w-full flex">
                      {mergedStr.map(
                        ([conv, message, index]: [
                          Conversation,
                          Message,
                          number,
                        ]) => (
                          <div
                            key={conv.id}
                            className={`${
                              isCompareMode && selectedConversations.length > 1
                                ? 'w-[50%]'
                                : 'w-full'
                            }`}
                          >
                            <div className="h-full">
                              <MemoizedChatMessage
                                key={conv.id}
                                message={message}
                                messageIndex={index}
                                conversation={conv}
                                isLikesEnabled={enabledFeatures.has('likes')}
                                editDisabled={isNotAllowedModel}
                                onEdit={(editedMessage) => {
                                  selectedConversations.forEach((conv) => {
                                    handleSend(
                                      conv,
                                      editedMessage,
                                      conv?.messages.length - index,
                                    );
                                  });
                                }}
                                onLike={onLikeHandler(index, conv)}
                                onDelete={(message) => {
                                  handleDeleteMessage(message);
                                }}
                              />
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  ),
                )}
                {loading && (
                  <div className={'flex w-full'}>
                    {selectedConversations.map(({ model, id }) => {
                      return (
                        <div
                          key={id}
                          className={`${
                            isCompareMode && selectedConversations.length > 1
                              ? 'w-[50%]'
                              : 'w-full'
                          }`}
                        >
                          <ChatLoader
                            modelIconMapping={modelIconMapping}
                            modelId={model.id}
                            theme={lightMode}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                <div
                  className="shrink-0 bg-white dark:bg-[#343541]"
                  style={{ height: inputHeight - 10 }}
                  ref={messagesEndRef}
                />
              </div>
            </div>
            {isCompareMode && selectedConversations.length < 2 && (
              <div className="w-[50%]">
                <ChatCompareSelect
                  conversations={conversations}
                  selectedConversations={selectedConversations}
                  onConversationSelect={(conversation) => {
                    handleSelectConversation(conversation, true);
                  }}
                />
              </div>
            )}
          </div>
          {isNotAllowedModel ? (
            <NotAllowedModel />
          ) : (
            <>
              {isReplay && !messageIsStreaming && !isReplayFinished ? (
                <ChatReplayControls
                  onClickReplayStart={onClickReplayStart}
                  onClickReplayReStart={onClickReplayReStart}
                  showReplayStart={isEmptySelectedConversation}
                />
              ) : (
                <ChatInput
                  ref={inputRef}
                  stopConversationRef={stopConversationRef}
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
                  onSend={(message) => {
                    localConversations.current = conversations;
                    selectedConversations.forEach((conv) => {
                      handleSend(conv, message, 0);
                    });
                  }}
                  onScrollDownClick={handleScrollDown}
                  onRegenerate={() => {
                    localConversations.current = conversations;
                    selectedConversations.forEach((conv) => {
                      const lastUserMessageIndex = conv.messages
                        .map((msg) => msg.role)
                        .lastIndexOf('user');
                      handleSend(
                        conv,
                        conv.messages[lastUserMessageIndex],
                        conv.messages.length - lastUserMessageIndex,
                      );
                    });
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
});
Chat.displayName = 'Chat';
