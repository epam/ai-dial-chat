import { FloatingOverlay } from '@floating-ui/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { clearStateForMessages } from '@/src/utils/app/clear-messages-state';
import { getConversationModelParams } from '@/src/utils/app/conversation';
import { isSmallScreen } from '@/src/utils/app/mobile';

import {
  Conversation,
  ConversationsTemporarySettings,
  MergedMessages,
} from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

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
import { PublicationSelectors } from '@/src/store/publication/publication.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';

import Loader from '../Common/Loader';
import { NotFoundEntity } from '../Common/NotFoundEntity';
import { ChatCompareRotate } from './ChatCompareRotate';
import { ChatCompareSelect } from './ChatCompareSelect';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput/ChatInput';
import { ChatInputControls } from './ChatInput/ChatInputControls';
import { ChatInputFooter } from './ChatInput/ChatInputFooter';
import { ChatSettings } from './ChatSettings';
import { ChatSettingsEmpty } from './ChatSettingsEmpty';
import { ErrorMessageDiv } from './ErrorMessageDiv';
import { MemoizedChatMessage } from './MemoizedChatMessage';
import { NotAllowedModel } from './NotAllowedModel';
import { PlaybackControls } from './Playback/PlaybackControls';
import { PublicationControls } from './Publish/PublicationChatControls';
import { PublicationHandler } from './Publish/PublicationHandler';

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

  const appName = useAppSelector(SettingsSelectors.selectAppName);
  const models = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const modelError = useAppSelector(ModelsSelectors.selectModelsError);
  const isModelsLoaded = useAppSelector(ModelsSelectors.selectIsModelsLoaded);
  const addons = useAppSelector(AddonsSelectors.selectAddons);
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
  const isReplayRequiresVariables = useAppSelector(
    ConversationsSelectors.selectIsReplayRequiresVariables,
  );
  const isExternal = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsExternal,
  );
  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );
  const isAnyMenuOpen = useAppSelector(UISelectors.selectIsAnyMenuOpen);
  const isIsolatedView = useAppSelector(SettingsSelectors.selectIsIsolatedView);
  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
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

  useEffect(() => {
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
      (mergedStr: [Conversation, Message, number]) =>
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

  useEffect(() => {
    if (selectedConversations.length > 0) {
      const mergedMessages: MergedMessages[] = [];
      const firstConversationMessages =
        selectedConversations[0].messages.filter((m) => m.role !== Role.System);
      for (let i = 0; i < firstConversationMessages.length; i++) {
        mergedMessages.push(
          selectedConversations.map((conv) => [
            conv,
            conv.messages.filter((m) => m.role !== Role.System)[i] || {
              role: Role.Assistant,
              content: '',
            },
            i,
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

  const handleSelectModel = useCallback(
    (conversation: Conversation, modelId: string) => {
      const newAiEntity = modelsMap[modelId];
      if (!newAiEntity && modelId !== REPLAY_AS_IS_MODEL) {
        return;
      }

      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: {
            ...getConversationModelParams(
              conversation,
              modelId,
              modelsMap,
              addonsMap,
            ),
          },
        }),
      );
    },
    [addonsMap, dispatch, modelsMap],
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
          values: {
            selectedAddons: addonIds.filter((addonId) => addonsMap[addonId]),
          },
        }),
      );
    },
    [addonsMap, dispatch],
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
              assistantModelId: temporarySettings.currentAssistentModelId,
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

  const showLastMessageRegenerate =
    !isReplay &&
    !isPlayback &&
    !isExternal &&
    !messageIsStreaming &&
    !isLastMessageError;
  const showFloatingOverlay =
    isSmallScreen() && isAnyMenuOpen && !isIsolatedView;
  const isModelsInstalled = selectedConversations.every((conv) =>
    installedModelIds.has(conv.model.id),
  );

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
                    ? 'w-[50%]'
                    : 'w-full',
                )}
                data-qa={isCompareMode ? 'compare-mode' : 'chat-mode'}
              >
                <div className="flex h-full flex-col justify-between">
                  <div className="flex w-full">
                    {selectedConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={classNames(
                          isCompareMode && selectedConversations.length > 1
                            ? 'w-[50%]'
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
                                  !messageIsStreaming &&
                                  !isExternal
                                }
                                isShowModelSelect={
                                  enabledFeatures.has(
                                    Feature.TopChatModelSettings,
                                  ) &&
                                  !isPlayback &&
                                  !isExternal
                                }
                                isShowSettings={isShowChatSettings}
                                setShowSettings={(isShow) => {
                                  if (isShow) {
                                    dispatch(ModelsActions.getModels());
                                    dispatch(AddonsActions.getAddons());
                                  }
                                  setIsShowChatSettings(isShow);
                                }}
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
                    className="h-full overflow-x-hidden"
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
                                  ? 'w-[50%]'
                                  : 'w-full',
                              )}
                            >
                              <div
                                className="shrink-0"
                                style={{
                                  height: `calc(100% - ${inputHeight}px)`,
                                }}
                              >
                                <ChatSettingsEmpty
                                  conversation={conv}
                                  isModels={models.length !== 0}
                                  prompts={prompts}
                                  isShowSettings={enabledFeatures.has(
                                    Feature.EmptyChatSettings,
                                  )}
                                  onSelectModel={(modelId: string) =>
                                    handleSelectModel(conv, modelId)
                                  }
                                  onSelectAssistantSubModel={(
                                    modelId: string,
                                  ) =>
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
                                  onApplyAddons={handleOnApplyAddons}
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
                                      className={classNames(
                                        isCompareMode &&
                                          selectedConversations.length > 1
                                          ? 'w-[50%]'
                                          : 'w-full',
                                      )}
                                    >
                                      <div className="size-full">
                                        <MemoizedChatMessage
                                          key={conv.id}
                                          message={message}
                                          messageIndex={index}
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
                  {!isPlayback && notAllowedType ? (
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
                          isShowInput={
                            (!isReplay || isNotEmptyConversations) &&
                            !isExternal &&
                            (isModelsInstalled || isReplay)
                          }
                        >
                          <ChatInputControls
                            isNotEmptyConversations={isNotEmptyConversations}
                            showReplayControls={showReplayControls}
                            isModelsInstalled={isModelsInstalled}
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
                <div
                  className={classNames(
                    'absolute left-0 top-0 grid size-full',
                    selectedConversations.length === 1
                      ? 'grid-cols-1'
                      : 'grid-cols-2',
                  )}
                >
                  {selectedConversations.map((conv, index) => (
                    <ChatSettings
                      key={conv.id}
                      conversation={conv}
                      modelId={conv.model.id}
                      prompts={prompts}
                      addons={addons}
                      onChangeSettings={(args) => {
                        handleTemporarySettingsSave(conv, args);
                      }}
                      onApplySettings={handleApplyChatSettings}
                      onClose={() => setIsShowChatSettings(false)}
                      isOpen={isShowChatSettings}
                      isRight={index === 1}
                      isCompareMode={isCompareMode}
                    />
                  ))}
                </div>
              )}
              {isCompareMode && selectedConversations.length < 2 && (
                <div className="flex h-full w-[50%] items-center">
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
    </div>
  );
});

ChatView.displayName = 'ChatView';

export function Chat() {
  const { t } = useTranslation(Translation.Chat);

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
  const activeModel = useAppSelector((state) =>
    ModelsSelectors.selectModel(state, isolatedModelId || ''),
  );
  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );
  const isInstalledModelsInitialized = useAppSelector(
    ModelsSelectors.selectIsInstalledModelsInitialized,
  );

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
          entity={t('Model is')}
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
    !isInstalledModelsInitialized
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
