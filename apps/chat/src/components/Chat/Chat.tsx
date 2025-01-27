import { FloatingOverlay } from '@floating-ui/react';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { clearStateForMessages } from '@/src/utils/app/clear-messages-state';
import {
  excludeSystemMessages,
  getConversationModelParams,
} from '@/src/utils/app/conversation';
import { isConversationWithFormSchema } from '@/src/utils/app/form-schema';
import { isSmallScreen } from '@/src/utils/app/mobile';
import { doesModelHaveConfiguration } from '@/src/utils/app/models';

import {
  Conversation,
  ConversationsTemporarySettings,
  MergedMessages,
} from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { AddonsSelectors } from '@/src/store/addons/addons.reducers';
import { ChatActions } from '@/src/store/chat/chat.reducer';
import { ChatSelectors } from '@/src/store/chat/chat.selectors';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { PublicationSelectors } from '@/src/store/publication/publication.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ChatStarters } from '@/src/components/Chat/ChatStarters';

import Loader from '../Common/Loader';
import { NotFoundEntity } from '../Common/NotFoundEntity';
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
import { PublicationControls } from './Publish/PublicationChatControls';
import { PublicationHandler } from './Publish/PublicationHandler';
import { TalkToModal } from './TalkTo/TalkToModal';

import {
  Feature,
  LikeState,
  Message,
  Role,
  UploadStatus,
} from '@epam/ai-dial-shared';
import throttle from 'lodash/throttle';

const scrollThrottlingTimeout = 250;

export const ChatView = memo(() => {
  const dispatch = useAppDispatch();

  const models = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const modelError = useAppSelector(ModelsSelectors.selectModelsError);
  const isModelsLoaded = useAppSelector(ModelsSelectors.selectIsModelsLoaded);
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
  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );
  const talkToConversationId = useAppSelector(
    ConversationsSelectors.selectTalkToConversationId,
  );
  const isAnyMenuOpen = useAppSelector(UISelectors.selectIsAnyMenuOpen);
  const isIsolatedView = useAppSelector(SettingsSelectors.selectIsIsolatedView);
  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const selectedPublicationUrl = useAppSelector(
    PublicationSelectors.selectSelectedPublicationUrl,
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

  useLayoutEffect(() => {
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
                !modelsMap[message.model.id],
            );
          }

          const model = modelsMap[conv.model.id];

          return (
            !model ||
            (model.type === EntityType.Assistant &&
              conv.assistantModelId &&
              !modelsMap[conv.assistantModelId])
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
  }, [selectedConversations, models, isModelsLoaded, addonsMap, modelsMap]);

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
      (mergedStr: [Conversation, Message, number, Message[]]) =>
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

  const onChatInputResize = useCallback((inputHeight: number) => {
    setInputHeight(inputHeight);
  }, []);

  const handleTalkToClose = useCallback(() => {
    handleTalkToConversationId(null);
  }, [handleTalkToConversationId]);

  const showLastMessageRegenerate =
    !isReplay &&
    !isPlayback &&
    !isExternal &&
    !messageIsStreaming &&
    !isLastMessageError &&
    !notAllowedType;
  const showFloatingOverlay =
    isSmallScreen() && isAnyMenuOpen && !isIsolatedView;
  const isModelsInstalled = selectedConversations.every((conv) =>
    installedModelIds.has(conv.model.id),
  );

  const areSelectedConversationsEmpty = selectedConversations.every(
    (conv) => !conv.messages.length,
  );

  const isConversationWithSchema = selectedConversations.some(
    (conv) =>
      doesModelHaveConfiguration(modelsMap[conv.model.id]) ||
      isConversationWithFormSchema(conv),
  );

  const isInputVisible =
    (!isReplay || isNotEmptyConversations) &&
    !isExternal &&
    (isModelsInstalled || isReplay || isIsolatedView) &&
    !(isConversationWithSchema && selectedConversations.length > 1);

  return (
    <div
      className="relative min-w-0 shrink grow basis-0 overflow-y-auto"
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
                    ? 'w-1/2'
                    : 'w-full',
                )}
                data-qa={isCompareMode ? 'compare-mode' : 'chat-mode'}
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
                          enabledFeatures.has(Feature.TopSettings) && (
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
                                  !isExternal
                                }
                                isShowSettings={isShowChatSettings}
                                setShowSettings={setIsShowChatSettings}
                                selectedConversationIds={
                                  selectedConversationsIds
                                }
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
                    className={classNames('h-full overflow-x-hidden', {
                      'content-center': areSelectedConversationsEmpty,
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
                                  onShowChangeModel={handleTalkToConversationId}
                                  onShowSettings={setIsShowChatSettings}
                                />
                              </div>
                            </div>
                          ),
                      )}
                    </div>
                    <div ref={chatMessagesRef}>
                      {mergedMessages?.length > 0 && (
                        <div className="flex flex-col" data-qa="chat-messages">
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
                                          key={conv.id}
                                          message={message}
                                          messageIndex={index}
                                          filteredMessages={filteredMessages}
                                          conversation={conv}
                                          isLikesEnabled={enabledFeatures.has(
                                            Feature.Likes,
                                          )}
                                          editDisabled={
                                            !!notAllowedType ||
                                            isExternal ||
                                            isReplay ||
                                            isPlayback
                                          }
                                          onEdit={onEditMessage}
                                          onLike={onLikeHandler(index, conv)}
                                          onDelete={() => {
                                            handleDeleteMessage(index, conv);
                                          }}
                                          onRegenerate={
                                            index ===
                                              mergedMessages.length - 1 &&
                                            showLastMessageRegenerate
                                              ? onRegenerateMessage
                                              : undefined
                                          }
                                          messagesLength={mergedMessages.length}
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
                  {!isPlayback && notAllowedType && !selectedPublicationUrl ? (
                    <NotAllowedModel
                      showScrollDownButton={showScrollDownButton}
                      onScrollDownClick={handleScrollDown}
                      type={notAllowedType}
                    />
                  ) : (
                    <>
                      {isExternal && selectedConversations.length === 1 && (
                        <PublicationControls
                          showScrollDownButton={showScrollDownButton}
                          entity={selectedConversations[0]}
                          onScrollDownClick={handleScrollDown}
                          controlsClassNames="mx-2 mb-2 mt-5 w-full flex-row md:mx-4 md:mb-0 md:last:mb-6 lg:mx-auto lg:w-[768px] lg:max-w-3xl"
                        />
                      )}

                      {!isPlayback && <ChatStarters />}

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
                            dispatch(ConversationsActions.stopStreamMessage());
                          }}
                          onResize={onChatInputResize}
                          isShowInput={isInputVisible}
                        >
                          <ChatInputControls
                            isNotEmptyConversations={isNotEmptyConversations}
                            showReplayControls={showReplayControls}
                            isModelsInstalled={
                              isModelsInstalled || isIsolatedView
                            }
                            isConversationWithSchema={isConversationWithSchema}
                            showScrollDownButton={showScrollDownButton}
                            onScrollDown={handleScrollDown}
                          />
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
                </div>
              </div>
              {isShowChatSettings && (
                <ChatSettings
                  conversations={selectedConversations}
                  onChangeSettings={handleTemporarySettingsSave}
                  onApplySettings={handleApplyChatSettings}
                  onClose={() => setIsShowChatSettings(false)}
                  isOpen={isShowChatSettings}
                  isCompareMode={isCompareMode}
                />
              )}
              {isCompareMode && selectedConversations.length < 2 && (
                <div className="flex h-full w-1/2 items-center">
                  <ChatCompareSelect
                    conversations={conversations}
                    selectedConversations={selectedConversations}
                    onConversationSelect={(conversation) => {
                      dispatch(
                        ConversationsActions.selectForCompare(conversation),
                      );
                    }}
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
  );
});

ChatView.displayName = 'ChatView';

export function Chat() {
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
  const modelIsLoaded = useAppSelector(ModelsSelectors.selectIsModelsLoaded);
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

  const configurationModelId = selectedConversations.find((conv) =>
    doesModelHaveConfiguration(modelsMap[conv.model.id]),
  )?.model?.id;

  useEffect(() => {
    dispatch(ChatActions.resetFormValue());
    dispatch(ChatActions.setInputContent(''));
  }, [dispatch, selectedConversationsIds]);

  useEffect(() => {
    dispatch(ChatActions.resetConfigurationSchema());
    if (configurationModelId) {
      dispatch(
        ChatActions.getConfigurationSchema({ modelId: configurationModelId }),
      );
    }
  }, [dispatch, configurationModelId, selectedConversationsIds]);

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
          additionalText={t('Please contact your administrator.') || ''}
        />
      </div>
    );
  }

  if (
    (!areSelectedConversationsLoaded &&
      selectedConversations.some(
        (conv) => conv.status !== UploadStatus.LOADED,
      )) ||
    !isInstalledModelsInitialized ||
    isConfigurationSchemaLoading
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
        additionalText={t('Please select another conversation.') || ''}
      />
    );
  }
  return <ChatView />;
}
