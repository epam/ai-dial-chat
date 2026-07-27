import { IconPlayerPlay } from '@tabler/icons-react';
import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useResizeObserver } from '@/src/hooks/useResizeObserver';
import { useTranslation } from '@/src/hooks/useTranslation';
import { useWindowResizeEvent } from '@/src/hooks/useWindowResizeEvent';

import { isQuickApp2 } from '@/src/utils/app/application';
import { clearStateForMessages } from '@/src/utils/app/clear-messages-state';
import {
  excludeSystemMessages,
  getConversationModelParams,
} from '@/src/utils/app/conversation';
import {
  isConversationWithFormSchema,
  isFormSchemaValid,
} from '@/src/utils/app/form-schema';
import { is4XLScreen } from '@/src/utils/app/mobile';
import { doesModelHaveConfiguration } from '@/src/utils/app/models';

import {
  Conversation,
  ConversationsTemporarySettings,
  MergedMessages,
} from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { ChatActions, ConversationsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationTypesSchemasSelectors,
  AuthSelectors,
  ChatSelectors,
  ConversationsSelectors,
  ModelsSelectors,
  PublicationSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { Routes } from '@/src/constants/routes';

import { ChatDropArea } from '@/src/components/Chat/ChatDropArea';
import { ChatStarters } from '@/src/components/Chat/ChatStarters';
import { CustomChatViewer } from '@/src/components/Chat/CustomChatViewer';
import { Loader } from '@/src/components/Common/Loader';
import { NotFoundEntity } from '@/src/components/Common/NotFoundEntity';

import { ChatCompareRotate } from './ChatCompareRotate';
import { ChatCompareSelect } from './ChatCompareSelect';
import { ChatHeader } from './ChatHeader/Header';
import { ChatInput } from './ChatInput/ChatInput';
import { ChatInputControls } from './ChatInput/ChatInputControls';
import { ChatInputFooter } from './ChatInput/ChatInputFooter';
import { ChatSettings } from './ChatSettings/ChatSettingsModal';
import { EmptyChatDescription } from './EmptyChatDescription';
import { ErrorMessageDiv } from './ErrorMessageDiv';
import { IntroText } from './IntroText';
import { MemoizedChatMessage } from './MemoizedChatMessage';
import { NotAllowedModel } from './NotAllowedModel';
import { PlaybackControls } from './Playback/PlaybackControls';
import { ChatPublicationControls } from './Publish/PublicationControls/ChatPublicationControls';
import { ReviewPublicationHandler } from './Publish/PublicationHandler/ReviewPublicationHandler';
import { TalkToModal } from './TalkTo/TalkToModal';

import {
  ConversationInfo,
  Feature,
  LikeState,
  Message,
  Role,
  UploadStatus,
} from '@epam/ai-dial-shared';
import { DialPrimaryButton } from '@epam/ai-dial-ui-kit';
import throttle from 'lodash/throttle';

const scrollThrottlingTimeout = 250;

const isWideScreen = () => !is4XLScreen();

const checkIsWideLayout = (messagesLength: number, isCompareMode: boolean) =>
  isWideScreen() && !messagesLength && !isCompareMode;

interface CustomViewerType {
  title: string;
  viewerUrl: string;
  applicationId: string;
}

interface ChatViewProps {
  isPreview?: boolean;
  customViewer?: CustomViewerType;
}

const ChatView = memo(({ isPreview, customViewer }: ChatViewProps) => {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const modelError = useAppSelector(ModelsSelectors.selectModelsError);
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
  const isAsrFlowActive = useAppSelector(ChatSelectors.selectIsAsrFlowActive);
  const asrFlowRef = useRef(false);
  asrFlowRef.current = isAsrFlowActive;
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const isEditUserMessageHided = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.HideEditUserMessage),
  );
  const isMarketplaceEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.Marketplace),
  );
  const isOptimisticDefaultModelLoad = useAppSelector(
    SettingsSelectors.selectIsOptimisticDefaultModelLoad,
  );
  const isRegenerateAssistantMessageHided = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(
      state,
      Feature.HideRegenerateAssistantMessage,
    ),
  );
  const isDeleteMessageHided = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.HideDeleteUserMessage),
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
  const isReadOnly = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsReadOnly,
  );
  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );
  const talkToConversationId = useAppSelector(
    ConversationsSelectors.selectTalkToConversationId,
  );
  const isIsolatedView = useAppSelector(SettingsSelectors.selectIsIsolatedView);
  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const selectedPublicationUrl = useAppSelector(
    PublicationSelectors.selectSelectedPublicationUrl,
  );
  const notAvailableEntityType = useAppSelector(
    ChatSelectors.selectNotAvailableEntityType,
  );

  const configurationSchemas = useAppSelector(
    ChatSelectors.selectUploadedConfigurationSchemas,
  );
  const isApproveRequiredEntity = useAppSelector((state) =>
    PublicationSelectors.selectIsApproveRequiredEntity(
      state,
      selectedConversationsIds[0] ?? '',
    ),
  );
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);
  const notAllowedItemsForDisplay = useAppSelector(
    ConversationsSelectors.selectNotAllowedItemsForDisplay,
  );
  const isNotAllowed = useAppSelector(
    ConversationsSelectors.selectIsNotAllowed,
  );

  const autoScrollEnabledRef = useRef(true);

  const [showScrollDownButton, setShowScrollDownButton] = useState(false);

  const mergedMessages = useMemo(() => {
    if (selectedConversations.length === 0) {
      return [];
    }
    const mergedMessages: MergedMessages[] = [];
    const userMessages = selectedConversations.map((conv) =>
      excludeSystemMessages(conv.messages),
    );
    const messagesLength = userMessages[0]?.length ?? 0;

    for (let i = 0; i < messagesLength; i++) {
      mergedMessages.push(
        selectedConversations.map((conv, convIndex) => [
          conv,
          userMessages[convIndex][i] || {
            role: Role.Assistant,
            content: '',
          },
          i,
          userMessages[convIndex],
        ]),
      );
    }

    return mergedMessages;
  }, [selectedConversations]);

  const [isShowChatSettings, setIsShowChatSettings] = useState(false);
  const [isLastMessageError, setIsLastMessageError] = useState(false);
  const [prevSelectedIds, setPrevSelectedIds] = useState<string[]>([]);
  const [inputHeight, setInputHeight] = useState(142);
  const [isApproveRequiredInput, setIsApproveRequiredInput] = useState(false);
  const [isWideLayout, setIsWideLayout] = useState(
    checkIsWideLayout(mergedMessages.length, isCompareMode),
  );

  const handleTalkToConversationId = useCallback(
    (conversationId: string | null) => {
      dispatch(ConversationsActions.setTalkToConversationId(conversationId));
    },
    [dispatch],
  );

  const selectedConversationsTemporarySettings = useRef<
    Record<string, ConversationsTemporarySettings>
  >({});
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const nextMessageBoxRef = useRef<HTMLDivElement | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  const disableAutoScrollTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
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

  const isApplicationPreviewChat = useMemo(() => {
    return router.pathname === Routes.AppsEditor;
  }, [router.pathname]);

  const isAdminPreview = isAdmin && isApplicationPreviewChat;

  const areModelsInstalled = selectedConversations.every((conv) =>
    installedModelIds.has(conv.model.id),
  );

  useLayoutEffect(() => {
    if (isNotAllowed) {
      dispatch(ChatActions.setNotAvailableEntityType(EntityType.Model));
    } else {
      dispatch(ChatActions.setNotAvailableEntityType(undefined));
    }
  }, [dispatch, isNotAllowed]);

  const handleLike = useCallback(
    (
      index: number,
      conversation: Conversation,
      rate: LikeState,
      comment?: string,
    ) => {
      dispatch(
        ConversationsActions.rateMessage({
          conversationId: conversation.id,
          messageIndex: index,
          rate,
          comment,
        }),
      );
    },
    [dispatch],
  );

  const setAutoScroll = useCallback(() => {
    if (disableAutoScrollTimeoutRef.current !== null) {
      clearTimeout(disableAutoScrollTimeoutRef.current);
    }

    autoScrollEnabledRef.current = true;
    setShowScrollDownButton(false);
  }, []);

  const scrollDown = useCallback(
    (force = false) => {
      if (autoScrollEnabledRef.current || force) {
        setAutoScroll();
        chatContainerRef.current?.scrollTo({
          top: chatContainerRef.current.scrollHeight,
        });
      }
    },
    [setAutoScroll],
  );

  const throttledScrollDown = useMemo(
    () => throttle(scrollDown, scrollThrottlingTimeout),
    [scrollDown],
  );

  useEffect(() => {
    throttledScrollDown();
  }, [conversations, mergedMessages, throttledScrollDown]);

  const handleScrollDown = useCallback(() => {
    scrollDown(true);
  }, [scrollDown]);

  const handleScroll = useCallback(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        chatContainerRef.current;
      const bottomTolerance = 25;

      if (lastScrollTop.current > scrollTop) {
        autoScrollEnabledRef.current = false;
        setShowScrollDownButton(true);
      } else if (scrollTop + clientHeight < scrollHeight - bottomTolerance) {
        if (disableAutoScrollTimeoutRef.current !== null) {
          clearTimeout(disableAutoScrollTimeoutRef.current);
        }

        disableAutoScrollTimeoutRef.current = setTimeout(() => {
          autoScrollEnabledRef.current = false;
          setShowScrollDownButton(true);
        }, scrollThrottlingTimeout);
      } else {
        setAutoScroll();
      }

      lastScrollTop.current = scrollTop;
    }
  }, [setAutoScroll]);

  const handleChatMessagesResize = useCallback(() => {
    if (
      chatMessagesRef.current &&
      !messageIsStreaming &&
      mergedMessages.length
    ) {
      handleScroll();
    }
  }, [handleScroll, mergedMessages.length, messageIsStreaming]);

  const handleChatResize = useCallback(() => {
    setIsWideLayout(checkIsWideLayout(mergedMessages.length, isCompareMode));
  }, [isCompareMode, mergedMessages.length]);

  useResizeObserver(chatMessagesRef.current, handleChatMessagesResize);
  useWindowResizeEvent(handleChatResize);

  useEffect(() => {
    const lastMergedMessages = mergedMessages.length
      ? mergedMessages[mergedMessages.length - 1]
      : [];

    const isErrorInSomeLastMessage = lastMergedMessages.some(
      (mergedStr: [Conversation, Message, number, Message[]]) =>
        !!mergedStr[1].errorMessage,
    );
    setIsLastMessageError(isErrorInSomeLastMessage);
  }, [mergedMessages]);

  useLayoutEffect(() => {
    if (
      selectedConversations.every(
        (conv) => !conv.messages.find((m) => m.role !== Role.Assistant),
      )
    ) {
      setShowScrollDownButton(false);
    } else {
      if (!autoScrollEnabledRef.current) {
        handleScroll();
      }
    }
  }, [handleScroll, selectedConversations]);

  const handleClearConversation = useCallback(
    (conversation: Conversation) => {
      if (conversation) {
        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: {
              messages: [],
            },
          }),
        );
      }
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
      setIsShowChatSettings(false);
    }
  }, [prevSelectedIds, selectedConversationsIds, setAutoScroll]);

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

  const handleSendMessage = useCallback(
    (message: Message) => {
      dispatch(
        ConversationsActions.sendMessages({
          conversations: selectedConversations,
          message,
          deleteCount: 0,
          activeReplayIndex: 0,
          skipRecentModelsUpdate: isAdminPreview && !areModelsInstalled,
        }),
      );
    },
    [areModelsInstalled, dispatch, isAdminPreview, selectedConversations],
  );

  const handleRegenerateMessage = useCallback(() => {
    dispatch(
      ConversationsActions.regenerateLastMessage({
        skipRecentModelsUpdate: isAdminPreview && !areModelsInstalled,
      }),
    );

    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [dispatch, isAdminPreview, areModelsInstalled]);

  const handleEditMessage = useCallback(
    (editedMessage: Message, index: number, convId: string) => {
      dispatch(
        ConversationsActions.editMessage({
          editedMessage,
          index,
          convId,
          skipRecentModelsUpdate: isAdminPreview && !areModelsInstalled,
        }),
      );
    },
    [dispatch, isAdminPreview, areModelsInstalled],
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
              ...getConversationModelParams(
                conversation,
                temporarySettings.modelId,
                modelsMap,
              ),
              prompt: temporarySettings.prompt,
              temperature: temporarySettings.temperature,
              isShared: temporarySettings.isShared,
              responseFormat: temporarySettings.responseFormat,
            },
          }),
        );
      }
    });
  }, [selectedConversations, dispatch, modelsMap]);

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

  const handleChatInputResize = useCallback((inputHeight: number) => {
    setInputHeight(inputHeight);
  }, []);

  const handleTalkToClose = useCallback(() => {
    handleTalkToConversationId(null);
    textareaRef.current?.focus();
  }, [handleTalkToConversationId]);

  const handleToggleApproveRequiredInput = useCallback(() => {
    setIsApproveRequiredInput(!isApproveRequiredInput);
  }, [isApproveRequiredInput]);

  const handleStopMessageStreaming = useCallback(() => {
    dispatch(ConversationsActions.stopStreamMessage());
  }, [dispatch]);

  const handleSelectForCompare = useCallback(
    (conversation: ConversationInfo) => {
      dispatch(ConversationsActions.selectForCompare(conversation));
    },
    [dispatch],
  );

  const handleCloseSettings = useCallback(() => {
    setIsShowChatSettings(false);
  }, []);

  const handleUnselectConversation = useCallback(
    (id: string) => {
      dispatch(
        ConversationsActions.unselectConversations({
          conversationIds: [id],
        }),
      );
    },
    [dispatch],
  );

  const isValidApproveRequiredConversation =
    isApproveRequiredEntity && !isReplay && !isPlayback;
  const showLastMessageRegenerate =
    !isReplay &&
    !isPlayback &&
    (!isReadOnly || isApproveRequiredEntity) &&
    !messageIsStreaming &&
    !isLastMessageError &&
    !notAvailableEntityType;

  const areSelectedConversationsEmpty = selectedConversations.every(
    (conv) => !conv.messages.length,
  );

  const selectedConversationSchemas = useMemo(
    () =>
      selectedConversations
        .map((conversation) => {
          const resolvedModelId =
            modelsMap[conversation.model.id]?.id ?? conversation.model.id;
          return configurationSchemas.find(
            (schema) => schema.modelId === resolvedModelId,
          );
        })
        .filter((schema) => schema !== undefined),
    [configurationSchemas, modelsMap, selectedConversations],
  );
  const isSomeConversationWithSchema = selectedConversations.some(
    (conv) =>
      (selectedConversationSchemas.length &&
        selectedConversationSchemas
          .map(({ schema }) => schema)
          .some(isFormSchemaValid)) ||
      isConversationWithFormSchema(conv),
  );
  const isSchemaCompareWarningVisible =
    isSomeConversationWithSchema && selectedConversations.length > 1;

  const isChatReadyForInput =
    !isMarketplaceEnabled ||
    areModelsInstalled ||
    isOptimisticDefaultModelLoad ||
    isIsolatedView ||
    isAdminPreview ||
    isApproveRequiredEntity;
  const isInputVisible =
    ((!isReplay || isNotEmptyConversations) &&
      !isReadOnly &&
      !isApproveRequiredEntity &&
      (areModelsInstalled ||
        isOptimisticDefaultModelLoad ||
        isAdminPreview ||
        isReplay ||
        isIsolatedView ||
        !isMarketplaceEnabled) &&
      !isSchemaCompareWarningVisible) ||
    (isValidApproveRequiredConversation && isApproveRequiredInput);

  const shouldShowIntroText =
    selectedConversations.length === 1 &&
    !selectedConversations[0].messages.find(
      (userMessage) => userMessage.role === Role.User,
    );

  useEffect(() => {
    const activeElement = document.activeElement;
    const isSomethingElseFocused =
      activeElement &&
      activeElement !== document.body &&
      activeElement !== textareaRef.current;

    if (
      !enabledFeatures.has(Feature.SkipFocusChatInputOnLoad) &&
      !asrFlowRef.current &&
      !isSomethingElseFocused
    ) {
      textareaRef.current?.focus();
    }
  }, [enabledFeatures, selectedConversationsIds]);

  useEffect(() => {
    setIsApproveRequiredInput(false);
  }, [selectedConversationsIds]);

  useEffect(() => {
    handleScroll();
  }, [isApproveRequiredInput, handleScroll]);

  const isScrollDownButton = showScrollDownButton && !isApproveRequiredInput;

  return (
    <ChatDropArea isSettingsModalOpen={isShowChatSettings}>
      <div className="relative size-full" data-qa="chat" id="chat">
        {modelError ? (
          <ErrorMessageDiv error={modelError} />
        ) : customViewer ? (
          <CustomViewerChatView
            customViewer={customViewer}
            setShowSettings={setIsShowChatSettings}
          />
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
                      ? 'w-1/2'
                      : 'w-full',
                  )}
                  data-qa={
                    isCompareMode ? 'compare-mode' : 'entity-settings-chat-mode'
                  }
                >
                  <div
                    className={classNames(
                      'flex h-full flex-col',
                      areSelectedConversationsEmpty &&
                        !isSchemaCompareWarningVisible
                        ? 'justify-center'
                        : 'justify-between',
                    )}
                  >
                    <div className="flex w-full">
                      {selectedConversations.map((conv) => (
                        <div
                          key={conv.id}
                          className={classNames(
                            isCompareMode && selectedConversations.length > 1
                              ? 'w-1/2'
                              : 'w-full',
                          )}
                        >
                          {conv.messages.length !== 0 &&
                            enabledFeatures.has(Feature.TopSettings) &&
                            !isApplicationPreviewChat && (
                              <div className="z-10 flex flex-col">
                                <ChatHeader
                                  conversation={conv}
                                  isCompareMode={isCompareMode}
                                  isShowChatInfo={enabledFeatures.has(
                                    Feature.TopChatInfo,
                                  )}
                                  isShowClearConversation={
                                    enabledFeatures.has(
                                      Feature.TopClearConversation,
                                    ) &&
                                    !isPlayback &&
                                    !isReplay &&
                                    !isReadOnly &&
                                    !isApproveRequiredEntity &&
                                    !isExternal
                                  }
                                  isShowSettings={isShowChatSettings}
                                  setShowSettings={setIsShowChatSettings}
                                  selectedConversationIds={
                                    selectedConversationsIds
                                  }
                                  onClearConversation={handleClearConversation}
                                  onUnselectConversation={
                                    handleUnselectConversation
                                  }
                                  onModelClick={handleTalkToConversationId}
                                />
                              </div>
                            )}
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
                      className={classNames('overflow-x-hidden', {
                        'content-center': areSelectedConversationsEmpty,
                        'h-full': !isWideLayout,
                      })}
                      data-qa="scrollable-area"
                    >
                      <div className="flex max-h-full w-full">
                        {selectedConversations.map(
                          (conv) =>
                            conv.messages.length === 0 && (
                              <div
                                key={conv.id}
                                className={classNames(
                                  'flex h-full flex-col justify-between',
                                  selectedConversations.length > 1
                                    ? 'w-1/2'
                                    : 'w-full',
                                )}
                              >
                                <div
                                  className="shrink-0"
                                  style={{
                                    height: `calc(100% - ${inputHeight}px)`,
                                  }}
                                >
                                  <EmptyChatDescription
                                    conversation={conv}
                                    isApplicationPreviewChat={
                                      isApplicationPreviewChat
                                    }
                                    onShowChangeModel={
                                      handleTalkToConversationId
                                    }
                                    onShowSettings={setIsShowChatSettings}
                                  />
                                </div>
                              </div>
                            ),
                        )}
                      </div>
                      <div ref={chatMessagesRef}>
                        {mergedMessages?.length > 0 && (
                          <div
                            className="flex flex-col"
                            data-qa="chat-messages"
                          >
                            {mergedMessages.map(
                              (
                                mergedStr: [
                                  Conversation,
                                  Message,
                                  number,
                                  Message[],
                                ][],
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
                                  itemID={i.toString()}
                                  itemProp={
                                    i === mergedMessages.length - 1
                                      ? 'last-row'
                                      : undefined
                                  }
                                >
                                  {mergedStr.map(
                                    ([conv, message, index, filteredMessages]: [
                                      Conversation,
                                      Message,
                                      number,
                                      Message[],
                                    ]) => (
                                      <div
                                        key={conv.id}
                                        className={classNames(
                                          isCompareMode &&
                                            selectedConversations.length > 1
                                            ? 'w-1/2'
                                            : 'w-full',
                                        )}
                                      >
                                        <div className="size-full">
                                          <MemoizedChatMessage
                                            message={message}
                                            messageIndex={index}
                                            filteredMessages={filteredMessages}
                                            conversation={conv}
                                            isLikesEnabled={
                                              enabledFeatures.has(
                                                Feature.Likes,
                                              ) &&
                                              ((!isReadOnly && !isPlayback) ||
                                                isValidApproveRequiredConversation)
                                            }
                                            editDisabled={
                                              !isChatReadyForInput ||
                                              ((!!notAvailableEntityType ||
                                                isReadOnly ||
                                                isReplay ||
                                                isPlayback) &&
                                                (!isValidApproveRequiredConversation ||
                                                  !!notAvailableEntityType)) ||
                                              (message.role === Role.User &&
                                                isEditUserMessageHided)
                                            }
                                            onEdit={handleEditMessage}
                                            onLike={handleLike}
                                            onDelete={
                                              !isDeleteMessageHided
                                                ? handleDeleteMessage
                                                : undefined
                                            }
                                            onRegenerate={
                                              isChatReadyForInput &&
                                              index ===
                                                mergedMessages.length - 1 &&
                                              showLastMessageRegenerate &&
                                              (!isRegenerateAssistantMessageHided ||
                                                message.role !== Role.Assistant)
                                                ? handleRegenerateMessage
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

                    {isExternal && selectedConversations.length === 1 && (
                      <ChatPublicationControls
                        showScrollDownButton={showScrollDownButton}
                        entity={selectedConversations[0]}
                        onScrollDownClick={handleScrollDown}
                        onToggleInput={handleToggleApproveRequiredInput}
                        isInputActive={isApproveRequiredInput}
                      />
                    )}

                    {!isPlayback &&
                    (!selectedPublicationUrl || isApproveRequiredInput) &&
                    notAvailableEntityType &&
                    notAllowedItemsForDisplay.length ? (
                      <NotAllowedModel
                        showScrollDownButton={isScrollDownButton}
                        onScrollDownClick={handleScrollDown}
                        notAllowedItemsForDisplay={notAllowedItemsForDisplay}
                        onShowChangeModel={handleTalkToConversationId}
                      />
                    ) : (
                      <>
                        {shouldShowIntroText && (
                          <IntroText
                            isWideLayout={isWideLayout}
                            modelId={selectedConversations[0].model.id}
                          />
                        )}

                        {!isWideLayout && <ChatStarters />}

                        {!isPlayback && (
                          <ChatInput
                            isPreview={isPreview}
                            isWideLayout={isWideLayout}
                            showReplayControls={showReplayControls}
                            textareaRef={textareaRef}
                            showScrollDownButton={isScrollDownButton}
                            onSend={handleSendMessage}
                            onScrollDownClick={handleScrollDown}
                            onRegenerate={handleRegenerateMessage}
                            isLastMessageError={isLastMessageError}
                            onStopConversation={handleStopMessageStreaming}
                            onResize={handleChatInputResize}
                            isShowInput={isInputVisible}
                          >
                            <ChatInputControls
                              isWideLayout={isWideLayout}
                              isNotEmptyConversations={isNotEmptyConversations}
                              showReplayControls={showReplayControls}
                              isChatReadyForInput={isChatReadyForInput}
                              isSomeConversationWithSchema={
                                isSomeConversationWithSchema
                              }
                              showScrollDownButton={isScrollDownButton}
                              onScrollDown={handleScrollDown}
                            />
                          </ChatInput>
                        )}

                        {isPlayback && (
                          <PlaybackControls
                            nextMessageBoxRef={nextMessageBoxRef}
                            showScrollDownButton={isScrollDownButton}
                            onScrollDownClick={handleScrollDown}
                            onResize={handleChatInputResize}
                          />
                        )}

                        {isWideLayout && <ChatStarters />}
                      </>
                    )}
                  </div>
                </div>
                {isShowChatSettings && (
                  <ChatSettings
                    conversations={selectedConversations}
                    onChangeSettings={handleTemporarySettingsSave}
                    onApplySettings={handleApplyChatSettings}
                    onClose={handleCloseSettings}
                    isOpen={isShowChatSettings}
                    isCompareMode={isCompareMode}
                  />
                )}
                {isCompareMode && selectedConversations.length < 2 && (
                  <div className="flex h-full w-1/2 items-center">
                    <ChatCompareSelect
                      conversations={conversations}
                      selectedConversations={selectedConversations}
                      onConversationSelect={handleSelectForCompare}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        {talkToConversationId &&
          selectedConversations.map((conversation, i) => {
            if (conversation.id !== talkToConversationId) {
              return null;
            }

            return (
              <TalkToModal
                key={conversation.id}
                onClose={handleTalkToClose}
                conversation={conversation}
                isCompareMode={selectedConversations.length > 1}
                isRight={i === 1}
              />
            );
          })}
      </div>
    </ChatDropArea>
  );
});

interface CustomChatViewerProps {
  setShowSettings: (value: boolean) => void;
  customViewer: CustomViewerType;
}

const CustomViewerChatView: React.FC<CustomChatViewerProps> = ({
  setShowSettings,
  customViewer,
}) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(Translation.Chat);

  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const isStartedCustomViewerConversation = useAppSelector(
    ConversationsSelectors.selectIsStartedCustomViewerConversation,
  );

  const handleTalkToConversationId = useCallback(
    (conversationId: string | null) => {
      dispatch(ConversationsActions.setTalkToConversationId(conversationId));
    },
    [dispatch],
  );

  const router = useRouter();

  const isApplicationPreviewChat = useMemo(() => {
    return router.pathname === Routes.AppsEditor;
  }, [router.pathname]);

  return (
    <>
      {selectedConversations[0].messages.length !== 0 ||
        (!isStartedCustomViewerConversation && !isApplicationPreviewChat && (
          <div className="flex h-full flex-col">
            <div
              className={classNames('flex size-full flex-col justify-center')}
            >
              <div className="shrink-0">
                <EmptyChatDescription
                  isApplicationPreviewChat={isApplicationPreviewChat}
                  conversation={selectedConversations[0]}
                  onShowChangeModel={handleTalkToConversationId}
                  onShowSettings={setShowSettings}
                />
              </div>
            </div>

            <div className="flex w-full flex-col items-center pt-3 md:pt-5">
              <DialPrimaryButton
                className="mb-2 flex items-center md:mx-4 md:mb-0 md:last:mb-6 lg:mx-auto lg:max-w-3xl"
                label={t(ChatI18nKeys.StartWorkingWithViewer, {
                  ns: Translation.Chat,
                  viewerTitle: customViewer.title,
                })}
                iconBefore={<IconPlayerPlay size={18} />}
                onClick={() =>
                  dispatch(
                    ConversationsActions.setIsStartedCustomViewerConversation(
                      true,
                    ),
                  )
                }
              />
            </div>
          </div>
        ))}
    </>
  );
};

ChatView.displayName = 'ChatView';

interface ChatProps {
  isPreview?: boolean;
}

export function Chat({ isPreview }: ChatProps) {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const router = useRouter();

  const areSelectedConversationsLoaded = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsLoaded,
  );
  const selectedConversationsIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const modelIsLoaded = useAppSelector(ModelsSelectors.selectAreModelsLoaded);
  const isolatedModelId = useAppSelector(
    SettingsSelectors.selectIsolatedModelId,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const activeModel = modelsMap[isolatedModelId || ''];
  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );
  const isInstalledModelsInitialized = useAppSelector(
    ModelsSelectors.selectIsInstalledModelsInitialized,
  );
  const isOptimisticDefaultModelLoad = useAppSelector(
    SettingsSelectors.selectIsOptimisticDefaultModelLoad,
  );
  const loadingConfigurationSchemas = useAppSelector(
    ChatSelectors.selectLoadingConfigurationSchemas,
  );
  const isPublicationUpdating = useAppSelector(
    PublicationSelectors.selectIsPublicationUpdating,
  );
  const isStartedCustomViewerConversation = useAppSelector(
    ConversationsSelectors.selectIsStartedCustomViewerConversation,
  );
  const applicationTypeSchemas = useAppSelector(
    ApplicationTypesSchemasSelectors.selectAllSchemas,
  );

  const isNoMessages = selectedConversations.every(
    ({ messages }) => !messages?.length,
  );

  const isApplicationPreviewChat = useMemo(() => {
    return router.pathname === Routes.AppsEditor;
  }, [router.pathname]);

  const customViewer = useMemo(() => {
    const model = modelsMap[selectedConversations[0]?.model?.id];

    if (!model) return;

    if (model.viewerUrl) {
      return {
        viewerUrl: model.viewerUrl,
        title: model.name,
        applicationId: model.id,
      };
    }

    if (
      model.applicationTypeSchemaId &&
      applicationTypeSchemas.some(
        (schema) => schema.id === model.applicationTypeSchemaId,
      )
    ) {
      const schema = applicationTypeSchemas.find(
        (schema) => schema.id === model.applicationTypeSchemaId,
      );
      if (schema?.viewerUrl) {
        return {
          viewerUrl: schema.viewerUrl,
          title: schema.displayName,
          applicationId: model.id,
        };
      }
    }
  }, [modelsMap, applicationTypeSchemas, selectedConversations]);

  useEffect(() => {
    dispatch(ChatActions.resetFormValue());
  }, [dispatch, selectedConversationsIds]);

  useEffect(() => {
    const configurationAppReference = selectedConversations
      .filter((conv) => {
        const model = modelsMap[conv.model.id];
        return (
          doesModelHaveConfiguration(model) || (!!model && isQuickApp2(model))
        );
      })
      .map((conv) => conv.model.id);
    const configurationAppIds = configurationAppReference
      .map((reference) => modelsMap[reference]?.id)
      .filter((id) => id !== undefined);
    if (configurationAppIds.length && isNoMessages) {
      configurationAppIds.forEach((modelId) => {
        dispatch(ChatActions.getConfigurationSchema({ modelId }));
      });
    }
  }, [dispatch, isNoMessages, modelsMap, selectedConversations]);

  if (selectedPublication?.resources && !selectedConversationsIds.length) {
    return (
      <>
        <div className="w-full grow">
          <ReviewPublicationHandler publication={selectedPublication} />
        </div>
        <ChatInputFooter />
      </>
    );
  }

  if (isolatedModelId && modelIsLoaded && !activeModel) {
    return (
      <div className="h-screen pt-2">
        <NotFoundEntity
          entity={t(ChatI18nKeys.AgentIs)}
          additionalText={t(ChatI18nKeys.PleaseContactAdministrator)}
        />
      </div>
    );
  }

  if (
    !areSelectedConversationsLoaded ||
    // Optimistic fast path: don't block the chat on the installed-models
    // listing when the default model is already known from settings.
    (!isInstalledModelsInitialized && !isOptimisticDefaultModelLoad) ||
    loadingConfigurationSchemas.length ||
    isPublicationUpdating
  ) {
    return <Loader />;
  }
  if (
    selectedConversations.length !== selectedConversationsIds.length ||
    selectedConversations.some((conv) => conv.status !== UploadStatus.LOADED)
  ) {
    return (
      <NotFoundEntity
        entity={t(ChatI18nKeys.ConversationEntity)}
        additionalText={t(ChatI18nKeys.PleaseSelectAnotherConversation)}
      />
    );
  }

  if (
    customViewer &&
    (isStartedCustomViewerConversation ||
      isApplicationPreviewChat ||
      selectedConversations[0].messages.length !== 0)
  ) {
    return (
      <CustomChatViewer
        conversation={selectedConversations[0]}
        id={customViewer.applicationId}
        title={customViewer.title}
        customViewerUrl={customViewer.viewerUrl}
      />
    );
  }

  return (
    <>
      <ChatView isPreview={isPreview} customViewer={customViewer} />
      {!isPreview && <ChatInputFooter />}
    </>
  );
}
