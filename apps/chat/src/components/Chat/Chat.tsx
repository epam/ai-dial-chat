import { IconPlayerPlay } from '@tabler/icons-react';
import {
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

import { clearStateForMessages } from '@/src/utils/app/clear-messages-state';
import {
  excludeSystemMessages,
  getConversationModelParams,
} from '@/src/utils/app/conversation';
import {
  isConversationWithFormSchema,
  isFormSchemaValid,
} from '@/src/utils/app/form-schema';
import { isEntityIdExternal } from '@/src/utils/app/id';
import { is4XLScreen } from '@/src/utils/app/mobile';
import { doesModelHaveConfiguration } from '@/src/utils/app/models';
import { isEntityReadOnly } from '@/src/utils/app/permissions';

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
  AddonsSelectors,
  ApplicationTypesSchemasSelectors,
  AuthSelectors,
  ChatSelectors,
  ConversationsSelectors,
  ModelsSelectors,
  PublicationSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { Routes } from '@/src/constants/routes';

import { CustomChatViewer } from '@/src/components/AppsEditor/Settings/Previews/CustomChatViewer';
import { ChatDropArea } from '@/src/components/Chat/ChatDropArea';
import { ChatStarters } from '@/src/components/Chat/ChatStarters';
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
import { MemoizedChatMessage } from './MemoizedChatMessage';
import { NotAllowedModel } from './NotAllowedModel';
import { PlaybackControls } from './Playback/PlaybackControls';
import { ChatPublicationControls } from './Publish/PublicationControls/ChatPublicationControls';
import { PublicationHandler } from './Publish/PublicationHandler/PublicationHandler';
import { TalkToModal } from './TalkTo/TalkToModal';

import {
  ConversationInfo,
  Feature,
  LikeState,
  Message,
  Role,
  UploadStatus,
} from '@epam/ai-dial-shared';
import throttle from 'lodash/throttle';

const scrollThrottlingTimeout = 250;

const isWideScreen = () => !is4XLScreen();

const checkIsWideLayout = (messagesLength: number, isCompareMode: boolean) =>
  isWideScreen() && !messagesLength && !isCompareMode;

const ChatView = memo(() => {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const modelError = useAppSelector(ModelsSelectors.selectModelsError);
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
  const isConfigurationSchemaLoading = useAppSelector(
    ChatSelectors.selectIsConfigurationSchemaLoading,
  );
  const configurationSchema = useAppSelector(
    ChatSelectors.selectConfigurationSchema,
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
  const hasNotAllowedAddons = useAppSelector(
    ConversationsSelectors.selectHasNotAllowedAddons,
  );

  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [showScrollDownButton, setShowScrollDownButton] = useState(false);
  const [mergedMessages, setMergedMessages] = useState<MergedMessages[]>([]);
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

  const isApplicationPreviewChat = useMemo(() => {
    return router.pathname === Routes.AppsEditorSettings;
  }, [router.pathname]);

  const isAdminPreview = isAdmin && isApplicationPreviewChat;

  const areModelsInstalled = selectedConversations.every((conv) =>
    installedModelIds.has(conv.model.id),
  );

  useLayoutEffect(() => {
    if (isNotAllowed) {
      dispatch(ChatActions.setNotAvailableEntityType(EntityType.Model));
    } else if (hasNotAllowedAddons) {
      dispatch(ChatActions.setNotAvailableEntityType(EntityType.Addon));
    } else {
      dispatch(ChatActions.setNotAvailableEntityType(undefined));
    }
  }, [dispatch, isNotAllowed, hasNotAllowedAddons]);

  const handleLike = useCallback(
    (index: number, conversation: Conversation, rate: LikeState) => {
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

  useResizeObserver(document.body, handleChatResize);

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
    if (selectedConversations.length > 0) {
      const mergedMessages: MergedMessages[] = [];
      const userMessages = selectedConversations.map((conv) =>
        excludeSystemMessages(conv.messages),
      );
      const messagesLength = userMessages[0].length;

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
  }, [prevSelectedIds, selectedConversationsIds]);

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
                addonsMap,
              ),
              prompt: temporarySettings.prompt,
              temperature: temporarySettings.temperature,
              assistantModelId: temporarySettings.currentAssistantModelId,
              selectedAddons: temporarySettings.addonsIds.filter(
                (addonId) => addonsMap[addonId],
              ),
              isShared: temporarySettings.isShared,
            },
          }),
        );
      }
    });
  }, [selectedConversations, dispatch, modelsMap, addonsMap]);

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

  const isConversationWithSchema = selectedConversations.some(
    (conv) =>
      (!isConfigurationSchemaLoading &&
        configurationSchema &&
        isFormSchemaValid(configurationSchema)) ||
      isConversationWithFormSchema(conv),
  );

  const isChatReadyForInput =
    areModelsInstalled ||
    isIsolatedView ||
    isAdminPreview ||
    isApproveRequiredEntity;

  const isInputVisible =
    ((!isReplay || isNotEmptyConversations) &&
      !isReadOnly &&
      !isApproveRequiredEntity &&
      (areModelsInstalled || isAdminPreview || isReplay || isIsolatedView) &&
      !(isConversationWithSchema && selectedConversations.length > 1)) ||
    (isValidApproveRequiredConversation && isApproveRequiredInput);

  const applicationTypeSchemas = useAppSelector(
    ApplicationTypesSchemasSelectors.selectAllSchemas,
  );

  const customViewer = useMemo(() => {
    const model = modelsMap[selectedConversations[0]?.model?.id];

    if (!model) return;

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
    if (
      !enabledFeatures.has(Feature.SkipFocusChatInputOnLoad) &&
      textareaRef.current
    ) {
      textareaRef.current.focus();
    }
  }, [enabledFeatures]);

  useEffect(() => {
    setIsApproveRequiredInput(false);
  }, [selectedConversationsIds]);

  useEffect(() => {
    handleScroll();
  }, [isApproveRequiredInput, handleScroll]);

  const isScrollDownButton = showScrollDownButton && !isApproveRequiredInput;

  return (
    <ChatDropArea isSettingsModalOpen={isShowChatSettings}>
      <div
        className="relative size-full min-w-0 overflow-y-auto"
        data-qa="chat"
        id="chat"
      >
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
                    isCompareMode ? 'compare-mode' : 'app-settings-chat-mode'
                  }
                >
                  <div
                    className={classNames(
                      'flex h-full flex-col',
                      areSelectedConversationsEmpty
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
                                    !isApproveRequiredEntity
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
                                              (!isEntityReadOnly(conv) ||
                                                !isEntityIdExternal(conv) ||
                                                isValidApproveRequiredConversation)
                                            }
                                            editDisabled={
                                              (!!notAvailableEntityType ||
                                                isReadOnly ||
                                                isReplay ||
                                                isPlayback) &&
                                              (!isValidApproveRequiredConversation ||
                                                !!notAvailableEntityType)
                                            }
                                            onEdit={handleEditMessage}
                                            onLike={handleLike}
                                            onDelete={handleDeleteMessage}
                                            onRegenerate={
                                              index ===
                                                mergedMessages.length - 1 &&
                                              showLastMessageRegenerate
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
                        {!isWideLayout && <ChatStarters />}

                        {!isPlayback && (
                          <ChatInput
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
                              isConversationWithSchema={
                                isConversationWithSchema
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
  customViewer: {
    title: string;
    viewerUrl: string;
    applicationId: string;
  };
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

  const handleTalkToConversationId = useCallback(
    (conversationId: string | null) => {
      dispatch(ConversationsActions.setTalkToConversationId(conversationId));
    },
    [dispatch],
  );

  const router = useRouter();

  const isApplicationPreviewChat = useMemo(() => {
    return router.pathname === Routes.AppsEditorSettings;
  }, [router.pathname]);

  const isStartedCustomViewerConversation = useAppSelector(
    ConversationsSelectors.selectIsStartedCustomViewerConversation,
  );
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
              <button
                className="button button-primary mb-2 flex items-center gap-2 md:mx-4 md:mb-0 md:last:mb-6 lg:mx-auto lg:max-w-3xl"
                data-qa="start-working"
                onClick={() =>
                  dispatch(
                    ConversationsActions.setIsStartedCustomViewerConversation(
                      true,
                    ),
                  )
                }
              >
                <IconPlayerPlay size={18} />
                <span>
                  {t('Start working with the')}
                  {` ${customViewer.title}`}
                </span>
              </button>
            </div>
          </div>
        ))}
      {(isStartedCustomViewerConversation ||
        isApplicationPreviewChat ||
        selectedConversations[0].messages.length !== 0) && (
        <CustomChatViewer
          conversation={selectedConversations[0]}
          id={customViewer.applicationId}
          title={customViewer.title}
          customViewerUrl={customViewer.viewerUrl}
        />
      )}
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
  const isConfigurationSchemaLoading = useAppSelector(
    ChatSelectors.selectIsConfigurationSchemaLoading,
  );
  const isPublicationUpdating = useAppSelector(
    PublicationSelectors.selectIsPublicationUpdating,
  );

  const isNoMessages = selectedConversations.every(
    ({ messages }) => !messages?.length,
  );

  useEffect(() => {
    dispatch(ChatActions.resetFormValue());
  }, [dispatch, selectedConversationsIds]);

  useEffect(() => {
    const configurationAppReference = selectedConversations.find((conv) =>
      doesModelHaveConfiguration(modelsMap[conv.model.id]),
    )?.model?.id;
    const configurationAppId = configurationAppReference
      ? modelsMap[configurationAppReference]?.id
      : undefined;

    if (configurationAppId && isNoMessages) {
      dispatch(
        ChatActions.getConfigurationSchema({ modelId: configurationAppId }),
      );
    } else {
      dispatch(ChatActions.resetConfigurationSchema());
    }
  }, [dispatch, isNoMessages, modelsMap, selectedConversations]);

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
          entity={t('Agent is')}
          additionalText={t('Please contact your administrator.')}
        />
      </div>
    );
  }

  if (
    !areSelectedConversationsLoaded ||
    !isInstalledModelsInitialized ||
    isConfigurationSchemaLoading ||
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
        entity={t('Conversation')}
        additionalText={t('Please select another conversation.')}
      />
    );
  }

  return (
    <>
      <ChatView />
      {!isPreview && <ChatInputFooter />}
    </>
  );
}
