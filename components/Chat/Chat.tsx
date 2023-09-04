import {
  MouseEventHandler,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import {
  DEFAULT_ASSISTANT_SUBMODEL,
  DEFAULT_CONVERSATION_NAME,
} from '@/utils/app/const';
import { showAPIToastError } from '@/utils/app/errors';
import { mergeMessages, parseStreamMessages } from '@/utils/app/merge-streams';
import { throttle } from '@/utils/data/throttle';

import { OpenAIEntityModel, OpenAIEntityModelID } from '../../types/openai';
import { ChatBody, Conversation, Message } from '@/types/chat';

import { AddonsActions, AddonsSelectors } from '@/store/addons/addons.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { ModelsActions, ModelsSelectors } from '@/store/models/models.reducers';
import { PromptsSelectors } from '@/store/prompts/prompts.reducers';
import { SettingsSelectors } from '@/store/settings/settings.reducers';
import { UISelectors } from '@/store/ui/ui.reducers';

import { ChatCompareRotate } from './ChatCompareRotate';
import { ChatCompareSelect } from './ChatCompareSelect';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { ChatLoader } from './ChatLoader';
import ChatReplayControls from './ChatReplayControls';
import { ChatSettings } from './ChatSettings';
import { ChatSettingsEmpty } from './ChatSettingsEmpty';
import { ErrorMessageDiv } from './ErrorMessageDiv';
import { MemoizedChatMessage } from './MemoizedChatMessage';
import { NotAllowedModel } from './NotAllowedModel';

import { errorsMessages } from '@/constants/errors';

interface Props {
  appName: string;
}

const handleRate = (
  chatId: string,
  message: Message,
  model: OpenAIEntityModel,
) => {
  if (!message.like || !message.responseId) {
    return;
  }
  fetch('/api/rate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      responseId: message.responseId,
      model,
      id: chatId,
      value: message.like > 0 ? true : false,
    }),
  }).then();
};

const findSelectedConversations = (
  selectedConversationsIds: string[],
  conversations: Conversation[],
) => {
  const ids = new Set(selectedConversationsIds);

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
  const theme = useAppSelector(UISelectors.selectThemeState);
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
  const isConversationsLoading = useAppSelector(
    ConversationsSelectors.selectIsConversationsLoading,
  );
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const [showScrollDownButton, setShowScrollDownButton] =
    useState<boolean>(false);
  const [activeReplayIndex, setActiveReplayIndex] = useState<number>(0);
  const [mergedMessages, setMergedMessages] = useState<any>([]);
  const [isReplayPaused, setIsReplayPaused] = useState<boolean>(true);
  const [isReplay, setIsReplay] = useState<boolean>(false);
  const [isShowChatSettings, setIsShowChatSettings] = useState(false);
  const selectedConversationsTemporarySettings = useRef<Record<string, any>>(
    {},
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const [inputHeight, setInputHeight] = useState<number>(142);
  const abortController = useRef<AbortController>();
  const [isNotAllowedModel, setIsNotAllowedModel] = useState(false);
  const isStopGenerating = useRef(false);

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
    const modelIds = models.map((model) => model.id);
    const isNotAllowed = modelsIsLoading
      ? false
      : models.length === 0 ||
        selectedConversations.some((conv) => !modelIds.includes(conv.model.id));
    setIsNotAllowedModel(isNotAllowed);
  }, [selectedConversations, models, modelsIsLoading]);

  const setInitialNameForNewChat = (
    updatedConversation: Conversation,
    message: Message,
  ) => {
    if (
      updatedConversation.messages.length === 1 &&
      !updatedConversation.replay.isReplay &&
      updatedConversation.name === DEFAULT_CONVERSATION_NAME
    ) {
      const { content } = message;
      const customName =
        content.length > 160 ? content.substring(0, 160) + '...' : content;
      updatedConversation = {
        ...updatedConversation,
        name: customName,
      };
      dispatch(
        ConversationsActions.updateConversation({
          id: updatedConversation.id,
          values: updatedConversation,
        }),
      );
    }
    return updatedConversation;
  };

  function handleErrorMessage({
    updatedConversation,
    errorText,
    error,
  }: {
    updatedConversation: Conversation;
    errorText: string;
    error?: any;
  }) {
    dispatch(
      ConversationsActions.updateConversation({
        id: updatedConversation.id,
        values: { isLoading: false, isMessageStreaming: false },
      }),
    );

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
    dispatch(
      ConversationsActions.updateConversation({
        id: updatedConversation.id,
        values: {
          messages: [...otherMessages, assistantErrorMessage],
        },
      }),
    );

    if (error) {
      console.error(error);
    }
  }

  const updateConversation = (
    conversation: Conversation,
    updatedValues: Partial<Conversation>,
  ) => {
    const updatedConversation = {
      ...conversation,
      ...updatedValues,
    };

    dispatch(
      ConversationsActions.updateConversation({
        id: conversation.id,
        values: updatedConversation,
      }),
    );

    return updatedConversation;
  };

  const handleSend = useCallback(
    async (
      conversation: Conversation,
      message: Message,
      deleteCount = 0,
      activeReplayIndex = 0,
    ) => {
      let localUpdatedConversation: Conversation = conversation;
      isStopGenerating.current = false;
      if (!conversation) {
        return;
      }

      dispatch(
        ModelsActions.updateRecentModels({ modelId: conversation.model.id }),
      );
      if (
        conversation.selectedAddons.length > 0 &&
        modelsMap[conversation.model.id]?.type !== 'application'
      ) {
        dispatch(
          AddonsActions.updateRecentAddons({
            addonIds: conversation.selectedAddons,
          }),
        );
      }

      localUpdatedConversation = updateConversation(localUpdatedConversation, {
        lastActivityDate: Date.now(),
      });

      if (deleteCount) {
        const updatedMessages = [...conversation.messages];
        for (let i = 0; i < deleteCount; i++) {
          updatedMessages.pop();
        }
        localUpdatedConversation = updateConversation(
          localUpdatedConversation,
          {
            messages: [...updatedMessages, message],
            replay: {
              ...localUpdatedConversation.replay,
              activeReplayIndex: activeReplayIndex,
            },
          },
        );
      } else {
        localUpdatedConversation = updateConversation(
          localUpdatedConversation,
          {
            messages: [...conversation.messages, message],
            replay: {
              ...localUpdatedConversation.replay,
              activeReplayIndex: activeReplayIndex,
            },
          },
        );
      }

      localUpdatedConversation = setInitialNameForNewChat(
        localUpdatedConversation,
        message,
      );
      localUpdatedConversation = updateConversation(localUpdatedConversation, {
        isLoading: true,
        isMessageStreaming: true,
      });

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

      if (conversationModelType === 'model') {
        modelAdditionalSettings = {
          prompt: localUpdatedConversation.prompt,
          temperature: localUpdatedConversation.temperature,
          selectedAddons,
        };
      }
      if (conversationModelType === 'assistant' && assistantModelId) {
        modelAdditionalSettings = {
          temperature: localUpdatedConversation.temperature,
          selectedAddons,
          assistantModelId,
        };
      }
      const chatBody: ChatBody = {
        model: conversation.model,
        messages: localUpdatedConversation.messages.map((message) => ({
          content: message.content,
          role: message.role,
          like: void 0,
          ...(message.custom_content?.state && {
            custom_content: { state: message.custom_content?.state },
          }),
        })),
        id: conversation.id.toLowerCase(),
        ...modelAdditionalSettings,
      };
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
        response = await fetch('api/chat', {
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
            localUpdatedConversation = updateConversation(
              localUpdatedConversation,
              {
                isLoading: false,
                isMessageStreaming: false,
              },
            );
            return;
          }

          handleErrorMessage({
            updatedConversation: localUpdatedConversation,
            errorText: t(errorsMessages.timeoutError),
            error,
          });
          return;
        }

        handleErrorMessage({
          updatedConversation: localUpdatedConversation,
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
        await showAPIToastError(
          response,
          t(errorsMessages.generalServer, { ns: 'common' }),
        );
        handleErrorMessage({
          updatedConversation: localUpdatedConversation,
          errorText: t(errorsMessages.generalServer, { ns: 'common' }),
        });
        return;
      }
      const data = response.body;
      if (!data) {
        handleErrorMessage({
          updatedConversation: localUpdatedConversation,
          errorText: t(errorsMessages.generalServer, { ns: 'common' }),
        });

        return { error: true };
      }

      localUpdatedConversation = updateConversation(localUpdatedConversation, {
        isLoading: false,
        isMessageStreaming: true,
      });
      const reader = data.getReader();
      const decoder = new TextDecoder();
      const messageModel: Message['model'] = {
        id: localUpdatedConversation.model.id,
        name: localUpdatedConversation.model.name,
      };
      let done = false;
      let newMessage: Message = {
        content: '',
        model: messageModel,
        role: 'assistant',
      };
      let eventData = '';
      let value: Uint8Array | undefined;
      let doneReading = false;

      timeoutId = undefined;
      let updatedMessages: Message[] = [
        ...localUpdatedConversation.messages,
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
          localUpdatedConversation = updateConversation(
            localUpdatedConversation,
            {
              messages: updatedMessages,
              isLoading: false,
              isMessageStreaming: false,
            },
          );

          if (error.name === 'AbortError') {
            // Do not show error for user abort
            if (isStopGenerating.current) {
              dispatch(
                ConversationsActions.updateConversation({
                  id: conversation.id,
                  values: localUpdatedConversation,
                }),
              );
              return;
            }

            handleErrorMessage({
              updatedConversation: localUpdatedConversation,
              errorText: t(errorsMessages.timeoutError),
              error,
            });
            return;
          }

          handleErrorMessage({
            updatedConversation: localUpdatedConversation,
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
        newMessage = mergeMessages(newMessage, chunkValue);

        updatedMessages = updatedMessages.map((message, index) => {
          if (index === updatedMessages.length - 1) {
            return newMessage;
          }
          return message;
        });
        localUpdatedConversation = updateConversation(
          localUpdatedConversation,
          {
            messages: updatedMessages,
          },
        );
      }

      dispatch(
        ConversationsActions.updateConversation({
          id: localUpdatedConversation.id,
          values: {
            isLoading: false,
            isMessageStreaming: false,
          },
        }),
      );
    },
    [conversations, models],
  );

  const onLikeHandler = useCallback(
    (index: number, conversation: Conversation) => (editedMessage: Message) => {
      if (!conversation) {
        return;
      }
      const messages = [...conversation.messages];
      messages[index] = editedMessage;
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: { messages },
        }),
      );
      handleRate(conversation.id, editedMessage, conversation.model);
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
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: { messages: [] },
        }),
      );
    }
  };

  const handleReplay = async (
    deleteCount = 0,
    replayIndex = activeReplayIndex,
    isError = isErrorMessage,
  ) => {
    if (replayUserMessagesStack && !!replayUserMessagesStack[replayIndex]) {
      const sendToAllSelectedConversations = selectedConversations.map(
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
      selectedConversations.forEach((conv) => {
        const updatedReplay = {
          ...conv.replay,
          isReplay: false,
        };
        dispatch(
          ConversationsActions.updateConversation({
            id: conv.id,
            values: {
              replay: updatedReplay,
            },
          }),
        );
      });
      setIsReplayPaused(true);
    }
  };

  const handleSelectModel = (conversation: Conversation, modelId: string) => {
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
  };

  const handleSelectAssistantSubModel = (
    conversation: Conversation,
    modelId: string,
  ) => {
    dispatch(
      ConversationsActions.updateConversation({
        id: conversation.id,
        values: { assistantModelId: modelId },
      }),
    );
  };

  const handleOnChangeAddon = (conversation: Conversation, addonId: string) => {
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
  };

  const handleOnApplyAddons = (
    conversation: Conversation,
    addonIds: string[],
  ) => {
    dispatch(
      ConversationsActions.updateConversation({
        id: conversation.id,
        values: { selectedAddons: addonIds },
      }),
    );
  };

  const handleChangePrompt = (conversation: Conversation, prompt: string) => {
    dispatch(
      ConversationsActions.updateConversation({
        id: conversation.id,
        values: { prompt },
      }),
    );
  };

  const handleChangeTemperature = (
    conversation: Conversation,
    temperature: number,
  ) => {
    dispatch(
      ConversationsActions.updateConversation({
        id: conversation.id,
        values: { temperature },
      }),
    );
  };

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

      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: { messages },
        }),
      );
    });
  };

  const onSendMessage = (message: Message) => {
    selectedConversations.forEach((conv) => {
      handleSend(conv, message, 0);
    });
  };

  const onRegenerateMessage = () => {
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
      !isConversationsLoading &&
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
    if (selectedConversationsIds.length > 0) {
      const selectedConversations = findSelectedConversations(
        selectedConversationsIds,
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
  }, [selectedConversationsIds]);

  const handleApplyChatSettings = () => {
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
  };

  const handleTemporarySettingsSave = (
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
  };

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
                    <div className={'flex w-full'}>
                      {selectedConversations.map(({ model, id, isLoading }) => (
                        <div
                          key={id}
                          className={`${
                            isCompareMode && selectedConversations.length > 1
                              ? 'w-[50%]'
                              : 'w-full'
                          }`}
                        >
                          {isLoading && (
                            <ChatLoader modelId={model.id} theme={theme} />
                          )}
                        </div>
                      ))}
                    </div>
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
          </div>
        </>
      )}
    </div>
  );
});
Chat.displayName = 'Chat';
