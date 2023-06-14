import {
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
import { throttle } from '@/utils/data/throttle';

import { OpenAIModel, OpenAIModelID } from '../../types/openai';
import { ChatBody, Conversation, Message } from '@/types/chat';

import HomeContext from '@/pages/api/home/home.context';

import { ChatCompareSelect } from './ChatCompareSelect';
import { ChatEmpty } from './ChatEmpty';
import { ChatInput } from './ChatInput';
import { ChatLoader } from './ChatLoader';
import { ChatSettings } from './ChatSettings';
import { ErrorMessageDiv } from './ErrorMessageDiv';
import { MemoizedChatMessage } from './MemoizedChatMessage';
import { NoApiKeySet } from './NoApiKeySet';

import { errorsMessages } from '@/constants/errors';

interface Props {
  stopConversationRef: MutableRefObject<boolean>;
  appName: string;
}

const handleRate = (
  message: Message,
  id: string,
  model: OpenAIModel,
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

export const Chat = memo(({ stopConversationRef, appName }: Props) => {
  const { t } = useTranslation('chat');

  const {
    state: {
      conversations,
      selectedConversationIds,
      models,
      apiKey,
      serverSideApiKeyIsSet,
      modelError,
      loading,
      prompts,
      defaultModelId,
      isCompareMode,
    },
    handleUpdateConversation,
    handleSelectConversation,
    dispatch: homeDispatch,
  } = useContext(HomeContext);

  const [currentUserMessage, setCurrentUserMessage] = useState<Message>();
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const [showScrollDownButton, setShowScrollDownButton] =
    useState<boolean>(false);
  const [selectedConversations, setSelectedConversations] = useState<
    Conversation[]
  >([]);
  const [mergedMessages, setMergedMessages] = useState<any>([]);

  const localConversations = useRef<Conversation[]>(conversations);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (selectedConversationIds.length > 0) {
      const selectedConversations = selectedConversationIds
        .map((id) => conversations.find((conv) => conv.id === id))
        .filter((value) => !!value) as Conversation[];
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
      setMergedMessages(mergedMessages);
    }
  }, [selectedConversationIds, conversations]);

  const handleSend = useCallback(
    async (conversation: Conversation, message: Message, deleteCount = 0) => {
      if (conversation) {
        let updatedConversation: Conversation;
        if (deleteCount) {
          const updatedMessages = [...conversation.messages];
          for (let i = 0; i < deleteCount; i++) {
            updatedMessages.pop();
          }
          updatedConversation = {
            ...conversation,
            messages: [...updatedMessages, message],
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
        homeDispatch({ field: 'messageIsStreaming', value: true });
        const chatBody: ChatBody = {
          model: updatedConversation.model,
          messages: updatedConversation.messages.map((message) => {
            const gptMessage = { ...message, like: void 0 };
            return gptMessage;
          }),
          id: conversation.id.toLowerCase(),
          key: apiKey,
          prompt: updatedConversation.prompt,
          temperature: updatedConversation.temperature,
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
          homeDispatch({ field: 'messageIsStreaming', value: false });

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
          return;
        }
        const data = response.body;
        if (!data) {
          homeDispatch({ field: 'loading', value: false });
          homeDispatch({ field: 'messageIsStreaming', value: false });

          return;
        }
        if (updatedConversation.messages.length === 1) {
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
        let text = '';
        while (!done) {
          if (stopConversationRef.current === true) {
            controller.abort();
            done = true;
            break;
          }
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          const chunkValue = decoder.decode(value);
          text += chunkValue;
          if (isFirst) {
            isFirst = false;
            const updatedMessages: Message[] = [
              ...updatedConversation.messages,
              { role: 'assistant', content: chunkValue },
            ];
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
          } else {
            const updatedMessages: Message[] = updatedConversation.messages.map(
              (message, index) => {
                if (index === updatedConversation.messages.length - 1) {
                  return {
                    ...message,
                    content: text,
                  };
                }
                return message;
              },
            );
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
        }

        homeDispatch({ field: 'messageIsStreaming', value: false });
      }
    },
    [apiKey, conversations, stopConversationRef],
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

  const scrollToBottom = useCallback(() => {
    if (autoScrollEnabled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      textareaRef.current?.focus();
    }
  }, [autoScrollEnabled]);

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

  const handleScrollDown = () => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  };

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

  const handleSelectModel = (conversation: Conversation, modelId: string) => {
    handleUpdateConversation(conversation, {
      key: 'model',
      value: models.find((model) => model.id === modelId) as OpenAIModel,
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
                        prompts={prompts}
                        defaultModelId={defaultModelId || OpenAIModelID.GPT_3_5}
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
                      <ChatSettings
                        conversation={conv}
                        defaultModelId={defaultModelId || OpenAIModelID.GPT_3_5}
                        models={models}
                        isCompareMode={isCompareMode}
                        selectedCinversationIds={selectedConversationIds}
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
                                onEdit={(editedMessage) => {
                                  setCurrentUserMessage(editedMessage);
                                  // discard edited message and the ones that come after then resend

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
                {loading && <ChatLoader />}
                <div
                  className="h-[162px] shrink-0 bg-white dark:bg-[#343541]"
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
          <ChatInput
            stopConversationRef={stopConversationRef}
            textareaRef={textareaRef}
            isMessagesPresented={selectedConversations.some(
              (val) => val.messages.length > 0,
            )}
            maxLength={Math.min(
              ...selectedConversations.map((conv) => conv.model.maxLength),
            )}
            onSend={(message) => {
              setCurrentUserMessage(message);
              localConversations.current = conversations;
              selectedConversations.forEach((conv) => {
                handleSend(conv, message, 0);
              });
            }}
            onScrollDownClick={handleScrollDown}
            onRegenerate={() => {
              if (currentUserMessage) {
                localConversations.current = conversations;
                selectedConversations.forEach((conv) => {
                  handleSend(conv, currentUserMessage, 2);
                });
              }
            }}
            showScrollDownButton={showScrollDownButton}
          />
        </>
      )}
    </div>
  );
});
Chat.displayName = 'Chat';
