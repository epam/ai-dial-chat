import {
  MouseEventHandler,
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
  DEFAULT_ASSISTANT_SUBMODEL,
  DEFAULT_CONVERSATION_NAME,
} from '@/utils/app/const';
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
  appName: string;
}

const handleRate = (
  chatId: string,
  message: Message,
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
      model,
      id: chatId,
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

const filterUnfinishedStages = (messages: Message[]): Message[] => {
  let assistentMessageIndex = -1;
  messages.forEach((message, index) => {
    if (message.role === 'assistant') {
      assistentMessageIndex = index;
    }
  });
  if (
    assistentMessageIndex === -1 ||
    assistentMessageIndex !== messages.length - 1 ||
    !messages[assistentMessageIndex].custom_content?.stages?.length
  ) {
    return messages;
  }

  const assistentMessage = messages[assistentMessageIndex];
  const updatedMessage: Message = {
    ...assistentMessage,
    ...(assistentMessage.custom_content?.stages?.length && {
      custom_content: {
        ...assistentMessage.custom_content,
        stages: assistentMessage.custom_content.stages.filter(
          (stage) => stage.status != null,
        ),
      },
    }),
  };

  return messages.map((message, index) => {
    if (index === assistentMessageIndex) {
      return updatedMessage;
    }

    return message;
  });
};

export const Chat = memo(({ appName }: Props) => {
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
      lightMode,
      modelsMap,
    },
    handleUpdateConversation,
    handleSelectConversation,
    handleSelectConversations,
    handleUpdateRecentModels,
    handleUpdateRecentAddons,
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
  const [isShowChatSettings, setIsShowChatSettings] = useState(false);

  const localConversations = useRef<Conversation[]>(conversations);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const [inputHeight, setInputHeight] = useState<number>(142);
  const messageIsStreamingAmount = useRef<number>(0);
  const abortController = useRef<AbortController>();
  const [isNotAllowedModel, setIsNotAllowedModel] = useState(false);
  const isStopGenerating = useRef(false);
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
          ({ messages }) =>
            !!messages[messages.length - 1].errorMessage ?? false,
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
  }, [selectedConversationIds, conversations]);

  useEffect(() => {
    const modelIds = models.map((model) => model.id);
    setIsNotAllowedModel(
      models.length > 0 &&
        selectedConversations.some((conv) => !modelIds.includes(conv.model.id)),
    );
  }, [selectedConversations, models]);

  function handleErrorMessage({
    updatedConversation,
    errorText,
    error,
  }: {
    updatedConversation: Conversation;
    errorText: string;
    error?: any;
  }) {
    homeDispatch({ field: 'loading', value: false });
    handleMessageIsStreamingChange(-1);

    const lastMessage =
      updatedConversation.messages[updatedConversation.messages.length - 1];
    const otherMessages = updatedConversation.messages.slice(
      0,
      lastMessage.role === 'assistant'
        ? updatedConversation.messages.length - 1
        : updatedConversation.messages.length,
    );

    const assistantErrorMessage: Message =
      lastMessage.role === 'assistant'
        ? { ...lastMessage, errorMessage: errorText }
        : {
            content: '',
            role: 'assistant',
            errorMessage: errorText,
          };
    localConversations.current = handleUpdateConversation(
      updatedConversation,
      {
        key: 'messages',
        value: [...otherMessages, assistantErrorMessage],
      },
      localConversations.current,
    );

    if (error) {
      console.error(error);
    }
  }

  const handleSend = useCallback(
    async (
      conversation: Conversation,
      message: Message,
      deleteCount = 0,
      activeReplayIndex = 0,
    ) => {
      isStopGenerating.current = false;
      if (!conversation) {
        return;
      }

      handleUpdateRecentModels(conversation.model.id);
      if (
        conversation.selectedAddons.length > 0 &&
        modelsMap[conversation.model.id]?.type !== 'application'
      ) {
        conversation.selectedAddons.forEach((selectedAddon) => {
          handleUpdateRecentAddons(selectedAddon);
        });
      }

      let updatedConversation: Conversation = {
        ...conversation,
        lastActivityDate: Date.now(),
      };

      if (deleteCount) {
        const updatedMessages = [...conversation.messages];
        for (let i = 0; i < deleteCount; i++) {
          updatedMessages.pop();
        }
        updatedConversation = {
          ...updatedConversation,
          messages: [...updatedMessages, message],
          replay: {
            ...updatedConversation.replay,
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
          ...updatedConversation,
          messages: [...conversation.messages, message],
          replay: {
            ...updatedConversation.replay,
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

      const assistantModelId = conversation.assistantModelId;
      const conversationModelType = conversation.model.type;
      let modelAdditionalSettings = {};

      if (conversationModelType === 'model')
        modelAdditionalSettings = {
          prompt: updatedConversation.prompt,
          temperature: updatedConversation.temperature,
          selectedAddons,
        };

      if (conversationModelType === 'assistant' && assistantModelId)
        modelAdditionalSettings = {
          temperature: updatedConversation.temperature,
          selectedAddons,
          assistantModelId,
        };

      const chatBody: ChatBody = {
        model: conversation.model,
        messages: updatedConversation.messages.map((message) => ({
          content: message.content,
          role: message.role,
          like: void 0,
          ...(message.custom_content?.state && {
            custom_content: { state: message.custom_content?.state },
          }),
        })),
        id: conversation.id.toLowerCase(),
        key: apiKey,
        ...modelAdditionalSettings,
      };
      const endpoint = getEndpoint();
      const body = JSON.stringify(chatBody);
      if (!abortController.current || abortController.current.signal.aborted) {
        abortController.current = new AbortController();
      }
      let response;
      let timeoutId;
      try {
        timeoutId = setTimeout(() => {
          abortController.current?.abort();
        }, 20000);
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: abortController.current.signal,
          body,
        });
      } catch (error: any) {
        if (error.name === 'AbortError') {
          // Do not show error for user abort
          if (isStopGenerating.current) {
            homeDispatch({ field: 'loading', value: false });
            handleMessageIsStreamingChange(-1);
            return;
          }

          handleErrorMessage({
            updatedConversation,
            errorText: t(errorsMessages.timeoutError),
            error,
          });
          return;
        }

        handleErrorMessage({
          updatedConversation,
          errorText: t(errorsMessages.generalClient),
          error,
        });
        return;
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }

      if (!response.ok) {
        await showAPIToastError(response, t(errorsMessages.generalServer));
        handleErrorMessage({
          updatedConversation,
          errorText: t(errorsMessages.generalServer),
        });
        return;
      }
      const data = response.body;
      if (!data) {
        handleErrorMessage({
          updatedConversation,
          errorText: t(errorsMessages.generalServer),
        });

        return { error: true };
      }

      if (
        updatedConversation.messages.length === 1 &&
        !updatedConversation.replay.isReplay &&
        updatedConversation.name === DEFAULT_CONVERSATION_NAME
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
      const messageModel: Message['model'] = {
        id: updatedConversation.model.id,
        name: updatedConversation.model.name,
      };
      let done = false;
      const newMessage: Message = {
        content: '',
        model: messageModel,
        role: 'assistant',
      };
      let eventData = '';
      let value: Uint8Array | undefined;
      let doneReading = false;

      timeoutId = undefined;
      let updatedMessages: Message[] = [
        ...updatedConversation.messages,
        newMessage,
      ];
      while (!done) {
        try {
          timeoutId = setTimeout(() => {
            abortController.current?.abort();
          }, 20000);
          const result = await reader.read();
          value = result.value;
          doneReading = result.done;
        } catch (error: any) {
          updatedMessages = filterUnfinishedStages(updatedMessages);
          updatedConversation = {
            ...updatedConversation,
            messages: updatedMessages,
          };

          if (error.name === 'AbortError') {
            // Do not show error for user abort
            if (isStopGenerating.current) {
              homeDispatch({ field: 'loading', value: false });
              handleMessageIsStreamingChange(-1);
              localConversations.current = handleUpdateConversation(
                updatedConversation,
                {
                  key: 'messages',
                  value: updatedMessages,
                },
                localConversations.current,
              );
              return;
            }

            handleErrorMessage({
              updatedConversation,
              errorText: t(errorsMessages.timeoutError),
              error,
            });
            return;
          }

          handleErrorMessage({
            updatedConversation,
            errorText: t(errorsMessages.generalClient),
            error,
          });
          return;
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
        done = doneReading;
        const decodedValue = decoder.decode(value);
        eventData += decodedValue;
        if (decodedValue[decodedValue.length - 1] !== '\0') {
          continue;
        }
        const chunkValue = parseStreamMessages(eventData);
        eventData = '';
        mergeMessages(newMessage, chunkValue);

        updatedMessages = updatedMessages.map((message, index) => {
          if (index === updatedMessages.length - 1) {
            return newMessage;
          }
          return message;
        });
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
    [apiKey, conversations, models],
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
      handleRate(conversation.id, editedMessage, conversation.model, apiKey);
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
          abortController.current?.signal?.aborted !== true &&
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
    setIsShowChatSettings(false);
    setIsReplayPaused(false);
    handleReplay();
  };

  const onClickReplayReStart: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    setIsShowChatSettings(false);

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
    const newAiEntity = models.find(
      ({ id }) => id === modelId,
    ) as OpenAIEntityModel;
    const selectedAddons = Array.from(
      new Set([
        ...conversation.selectedAddons,
        ...(newAiEntity.selectedAddons ?? []),
      ]),
    );
    const updatedConversation: Conversation = {
      ...conversation,
      model: newAiEntity,
      selectedAddons,
    };
    if (newAiEntity.type === 'assistant') {
      handleUpdateConversation(conversation, {
        key: 'model',
        value: newAiEntity,
      });

      handleUpdateConversation(updatedConversation, {
        key: 'assistantModelId',
        value: DEFAULT_ASSISTANT_SUBMODEL.id,
      });
    } else {
      handleUpdateConversation(conversation, {
        key: 'model',
        value: newAiEntity,
      });
      handleUpdateConversation(updatedConversation, {
        key: 'assistantModelId',
        value: undefined,
      });
    }
  };

  const handleSelectAssistantSubModel = (
    conversation: Conversation,
    modelId: string,
  ) => {
    handleUpdateConversation(conversation, {
      key: 'assistantModelId',
      value: modelId,
    });
  };

  const handleOnChangeAddon = (conversation: Conversation, addonId: string) => {
    const isAddonInConversation = conversation.selectedAddons.some(
      (id) => id === addonId,
    );
    if (isAddonInConversation) {
      const filteredAddons = conversation.selectedAddons.filter(
        (id) => id !== addonId,
      );
      handleUpdateConversation(conversation, {
        key: 'selectedAddons',
        value: filteredAddons,
      });
    } else {
      handleUpdateConversation(conversation, {
        key: 'selectedAddons',
        value: conversation.selectedAddons.concat(addonId),
      });
    }
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

  const onSendMessage = (message: Message) => {
    setIsShowChatSettings(false);
    localConversations.current = conversations;
    selectedConversations.forEach((conv) => {
      handleSend(conv, message, 0);
    });
  };

  const onRegenerateMessage = () => {
    setIsShowChatSettings(false);
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
    <div
      className="relative flex-1 overflow-hidden"
      data-qa="chat"
    >
      {!(apiKey || serverSideApiKeyIsSet) ? (
        <NoApiKeySet appName={appName} />
      ) : modelError ? (
        <ErrorMessageDiv error={modelError} />
      ) : (
        <>
          <div className="flex h-full overflow-hidden">
            <div
              className={`flex h-full flex-col overflow-hidden ${
                isCompareMode && selectedConversations.length < 2
                  ? 'w-[50%]'
                  : 'w-full'
              }`}
            >
              <div className="flex max-h-full w-full">
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
                      <div className={`flex h-full flex-col`}>
                        <div className="overflow-auto">
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
                          style={{ height: inputHeight - 20 }}
                        />
                      </div>
                    ) : (
                      enabledFeatures.has('top-settings') && (
                        <div className={`flex h-full flex-col`}>
                          <div
                            className={`overflow-auto`}
                            style={{
                              maxHeight: isShowChatSettings
                                ? window.innerHeight - inputHeight - 40
                                : '',
                            }}
                          >
                            <ChatSettings
                              messageIsStreaming={messageIsStreaming}
                              conversation={conv}
                              defaultModelId={
                                defaultModelId || OpenAIEntityModelID.GPT_3_5
                              }
                              prompts={prompts}
                              addons={addons}
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
                              setShowSettings={setIsShowChatSettings}
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
                              onChangePrompt={(prompt) =>
                                handleChangePrompt(conv, prompt)
                              }
                              onChangeTemperature={(temperature) =>
                                handleChangeTemperature(conv, temperature)
                              }
                              onSelectAssistantSubModel={(modelId: string) =>
                                handleSelectAssistantSubModel(conv, modelId)
                              }
                              onChangeAddon={(addonId: string) =>
                                handleOnChangeAddon(conv, addonId)
                              }
                            />
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
              {mergedMessages?.length > 0 && (
                <div
                  className="flex max-h-full flex-col overflow-x-hidden"
                  ref={chatContainerRef}
                  onScroll={handleScroll}
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
                            <ChatLoader modelId={model.id} theme={lightMode} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div
                    className="shrink-0 "
                    style={{ height: inputHeight - 10 }}
                    ref={messagesEndRef}
                  />
                </div>
              )}
            </div>
            {isCompareMode && selectedConversations.length < 2 && (
              <div className="w-[50%]">
                <ChatCompareSelect
                  conversations={conversations}
                  selectedConversations={selectedConversations}
                  onConversationSelect={(conversation) => {
                    handleSelectConversations([
                      selectedConversations[0],
                      conversation,
                    ]);
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
                    if (!isReplayPaused) {
                      setIsReplayPaused(true);
                    }
                    isStopGenerating.current = true;
                    abortController.current?.abort();
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
