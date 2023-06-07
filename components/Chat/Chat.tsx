import { IconClearAll, IconSettings } from '@tabler/icons-react';
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
import {
  saveConversation,
  saveConversations,
  updateConversation,
} from '@/utils/app/conversation';
import { showAPIToastError } from '@/utils/app/errors';
import { throttle } from '@/utils/data/throttle';

import { OpenAIModel, OpenAIModelID } from '../../types/openai';
import { ChatBody, Conversation, Message } from '@/types/chat';
import { Prompt } from '@/types/prompt';

import HomeContext from '@/pages/api/home/home.context';

import Spinner from '../Spinner';
import { ChatEmpty } from './ChatEmpty';
import { ChatEmptySettings } from './ChatEmptySettings';
import { ChatInput } from './ChatInput';
import { ChatLoader } from './ChatLoader';
import { ChatSettings } from './ChatSettings';
import { ErrorMessageDiv } from './ErrorMessageDiv';
import { MemoizedChatMessage } from './MemoizedChatMessage';
import { ModelSelect } from './ModelSelect';
import { NoApiKeySet } from './NoApiKeySet';
import { SystemPrompt } from './SystemPrompt';
import { TemperatureSlider } from './Temperature';

import { errorsMessages } from '@/constants/errors';

interface Props {
  stopConversationRef: MutableRefObject<boolean>;
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

export const Chat = memo(({ stopConversationRef }: Props) => {
  const { t } = useTranslation('chat');

  const {
    state: {
      selectedConversation,
      conversations,
      models,
      apiKey,
      pluginKeys,
      serverSideApiKeyIsSet,
      usePluginKeys,
      messageIsStreaming,
      modelError,
      loading,
      prompts,
      defaultModelId,
    },
    handleUpdateConversation,
    dispatch: homeDispatch,
  } = useContext(HomeContext);

  const [currentMessage, setCurrentMessage] = useState<Message>();
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const [showScrollDownButton, setShowScrollDownButton] =
    useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(
    async (message: Message, id: string, deleteCount = 0) => {
      if (selectedConversation) {
        let updatedConversation: Conversation;
        if (deleteCount) {
          const updatedMessages = [...selectedConversation.messages];
          for (let i = 0; i < deleteCount; i++) {
            updatedMessages.pop();
          }
          updatedConversation = {
            ...selectedConversation,
            messages: [...updatedMessages, message],
          };
        } else {
          updatedConversation = {
            ...selectedConversation,
            messages: [...selectedConversation.messages, message],
          };
        }
        homeDispatch({
          field: 'selectedConversation',
          value: updatedConversation,
        });
        homeDispatch({ field: 'loading', value: true });
        homeDispatch({ field: 'messageIsStreaming', value: true });
        const chatBody: ChatBody = {
          model: updatedConversation.model,
          messages: updatedConversation.messages.map((message) => {
            const gptMessage = { ...message, like: void 0 };
            return gptMessage;
          }),
          id: id.toLowerCase(),
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
            homeDispatch({
              field: 'selectedConversation',
              value: updatedConversation,
            });
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
            homeDispatch({
              field: 'selectedConversation',
              value: updatedConversation,
            });
          }
        }
        saveConversation(updatedConversation);
        const updatedConversations: Conversation[] = conversations.map(
          (conversation) => {
            if (conversation.id === selectedConversation.id) {
              return updatedConversation;
            }
            return conversation;
          },
        );
        if (updatedConversations.length === 0) {
          updatedConversations.push(updatedConversation);
        }
        homeDispatch({ field: 'conversations', value: updatedConversations });
        saveConversations(updatedConversations);
        homeDispatch({ field: 'messageIsStreaming', value: false });
      }
    },
    [
      apiKey,
      conversations,
      pluginKeys,
      selectedConversation,
      stopConversationRef,
    ],
  );

  const onLikeHandler = useCallback(
    (index: number) => (editedMessage: Message) => {
      if (!selectedConversation) {
        return;
      }
      const messages = [...selectedConversation.messages];
      messages[index] = editedMessage;
      handleUpdateConversation(selectedConversation, {
        key: 'messages',
        value: messages,
      });
      handleRate(
        editedMessage,
        selectedConversation?.id ?? '',
        selectedConversation.model,
        apiKey,
      );
    },
    [apiKey, handleUpdateConversation, selectedConversation],
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

  const handleClearConversation = () => {
    if (
      confirm(t<string>('Are you sure you want to clear all messages?')) &&
      selectedConversation
    ) {
      handleUpdateConversation(selectedConversation, {
        key: 'messages',
        value: [],
      });
    }
  };

  const scrollDown = () => {
    if (autoScrollEnabled) {
      messagesEndRef.current?.scrollIntoView(true);
    }
  };
  const throttledScrollDown = throttle(scrollDown, 250);

  // useEffect(() => {
  //   console.log('currentMessage', currentMessage);
  //   if (currentMessage) {
  //     handleSend(currentMessage);
  //     homeDispatch({ field: 'currentMessage', value: undefined });
  //   }
  // }, [currentMessage]);

  useEffect(() => {
    throttledScrollDown();
    selectedConversation &&
      setCurrentMessage(
        selectedConversation.messages[selectedConversation.messages.length - 2],
      );
  }, [selectedConversation, throttledScrollDown]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setAutoScrollEnabled(entry.isIntersecting);
        if (entry.isIntersecting) {
          textareaRef.current?.focus();
        }
      },
      {
        root: null,
        threshold: 0.5,
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

  return (
    <div className="relative flex-1 overflow-hidden bg-white dark:bg-[#343541]">
      {!(apiKey || serverSideApiKeyIsSet) ? (
        <NoApiKeySet />
      ) : modelError ? (
        <ErrorMessageDiv error={modelError} />
      ) : (
        <>
          <div
            className="max-h-full overflow-x-hidden"
            ref={chatContainerRef}
            onScroll={handleScroll}
          >
            {selectedConversation?.messages.length === 0 ? (
              <ChatEmpty
                conversation={selectedConversation}
                models={models}
                prompts={prompts}
                defaultModelId={defaultModelId || OpenAIModelID.GPT_3_5}
                onSelectModel={(modelId: string) =>
                  handleSelectModel(selectedConversation, modelId)
                }
                onChangePrompt={(prompt) =>
                  handleChangePrompt(selectedConversation, prompt)
                }
                onChangeTemperature={(temperature) =>
                  handleChangeTemperature(selectedConversation, temperature)
                }
              />
            ) : (
              selectedConversation && (
                <>
                  <ChatSettings
                    conversation={selectedConversation}
                    defaultModelId={defaultModelId || OpenAIModelID.GPT_3_5}
                    models={models}
                    onClearConversation={handleClearConversation}
                    onSelectModel={(modelId: string) =>
                      handleSelectModel(selectedConversation, modelId)
                    }
                  />
                  {selectedConversation?.messages.map((message, index) => (
                    <MemoizedChatMessage
                      key={index}
                      message={message}
                      messageIndex={index}
                      onEdit={(editedMessage) => {
                        setCurrentMessage(editedMessage);
                        // discard edited message and the ones that come after then resend
                        handleSend(
                          editedMessage,
                          selectedConversation?.id,
                          selectedConversation?.messages.length - index,
                        );
                      }}
                      onLike={onLikeHandler(index)}
                    />
                  ))}

                  {loading && <ChatLoader />}

                  <div
                    className="h-[162px] bg-white dark:bg-[#343541]"
                    ref={messagesEndRef}
                  />
                </>
              )
            )}
          </div>

          <ChatInput
            stopConversationRef={stopConversationRef}
            textareaRef={textareaRef}
            onSend={(message) => {
              setCurrentMessage(message);
              handleSend(message, selectedConversation?.id ?? '', 0);
            }}
            onScrollDownClick={handleScrollDown}
            onRegenerate={() => {
              if (currentMessage) {
                handleSend(currentMessage, selectedConversation?.id ?? '', 2);
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
