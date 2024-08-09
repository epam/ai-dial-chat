import { FloatingOverlay } from '@floating-ui/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import classNames from 'classnames';

import { useConversationActions } from './hooks/useConversationActions';
import { useMergedMessages } from './hooks/useMergedMessages';
import { useChatViewAutoScroll } from '@/src/components/Chat/hooks/useChatViewAutoScroll';
import { useChatViewSelectors } from '@/src/components/Chat/hooks/useChatViewSelectors';

import { isSmallScreen } from '@/src/utils/app/mobile';

import {
  Conversation,
  ConversationsTemporarySettings,
  LikeState,
  Message,
  Role,
} from '@/src/types/chat';
import { EntityType } from '@/src/types/common';

import { AddonsActions } from '@/src/store/addons/addons.reducers';
import { useAppDispatch } from '@/src/store/hooks';
import { ModelsActions } from '@/src/store/models/models.reducers';

import { ChatCompareRotate } from './ChatCompareRotate';
import { ChatCompareSelect } from './ChatCompareSelect';
import ChatExternalControls from './ChatExternalControls';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput/ChatInput';
import { ChatSettings } from './ChatSettings';
import { ChatSettingsEmpty } from './ChatSettingsEmpty';
import { ErrorMessageDiv } from './ErrorMessageDiv';
import { MemoizedChatMessage } from './MemoizedChatMessage';
import { NotAllowedModel } from './NotAllowedModel';
import { PlaybackControls } from './Playback/PlaybackControls';
import { PublicationControls } from './Publish/PublicationChatControls';
import { StartReplayButton } from './StartReplayButton';

import { Feature } from '@epam/ai-dial-shared';

export const ChatView = memo(() => {
  const dispatch = useAppDispatch();

  const {
    appName,
    models,
    modelsMap,
    modelError,
    isModelsLoaded,
    addons,
    addonsMap,
    isCompareMode,
    selectedConversationsIds,
    selectedConversations,
    messageIsStreaming,
    conversations,
    prompts,
    enabledFeatures,
    isReplay,
    isReplayPaused,
    isReplayRequiresVariables,
    isExternal,
    isPlayback,
    isAnyMenuOpen,
    isIsolatedView,
  } = useChatViewSelectors();

  const [showChatSettings, setShowChatSettings] = useState(false);
  const [inputHeight, setInputHeight] = useState<number>(142);
  const [notAllowedType, setNotAllowedType] = useState<EntityType | null>(null);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const nextMessageBoxRef = useRef<HTMLDivElement | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);

  const {
    handleScroll,
    handleScrollDown,
    handleScrollToContainerHeight,
    showScrollDownButton,
    setShowScrollDownButton,
    setAutoScroll,
  } = useChatViewAutoScroll(
    chatContainerRef,
    chatMessagesRef,
    selectedConversations.length,
    messageIsStreaming,
  );

  const {
    mergedMessages,
    isLastMessageError,
    selectedConversationsTemporarySettings,
  } = useMergedMessages({
    selectedConversations,
    onMessagesChange: useCallback(
      ({ isNew, areConversationsEmpty, shouldAutoScroll }) => {
        if (isNew) {
          if (areConversationsEmpty) {
            setShowScrollDownButton(false);
          } else {
            handleScroll();
          }
        }

        if (shouldAutoScroll) {
          setAutoScroll(true);
        }
      },
      [handleScroll, setShowScrollDownButton, setAutoScroll],
    ),
  });

  const {
    updateConversation,
    applyChatSettings,
    rateMessage,
    deleteMessage,
    sendMessages,
    stopStreamMessage,
    unselectConversations,
    selectForCompare,
  } = useConversationActions(modelsMap, addonsMap);

  const onApplySettings = useCallback(() => {
    applyChatSettings(
      selectedConversations,
      selectedConversationsTemporarySettings.current,
    );
  }, [applyChatSettings, selectedConversations]);

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
      rateMessage(conversation.id, index, rate);
    },
    [rateMessage],
  );

  const handleSetShowSettings = useCallback(
    (isShow: boolean) => {
      if (isShow) {
        dispatch(ModelsActions.getModels());
        dispatch(AddonsActions.getAddons());
      }
      setShowChatSettings(isShow);
    },
    [dispatch],
  );

  const handleClearConversation = useCallback(
    (conversation: Conversation) => {
      if (conversation) {
        updateConversation(conversation.id, { messages: [] });
      }
    },
    [updateConversation],
  );

  const handleSelectModel = useCallback(
    (conversation: Conversation, modelId: string) => {
      const modelValues: Partial<Conversation> = modelsMap[modelId]
        ? { model: { id: modelId } }
        : {}; // handle undefined modelId lookup

      updateConversation(conversation.id, modelValues);
    },
    [updateConversation, modelsMap],
  );

  const handleContainerScroll = useCallback(() => {
    if (
      selectedConversations.some(
        (conv) => !!conv.messages.find((m) => m.role !== Role.Assistant),
      )
    ) {
      handleScroll();
    }
  }, [handleScroll, selectedConversations]);

  const handleSelectAssistantSubModel = useCallback(
    (conversation: Conversation, modelId: string) => {
      updateConversation(conversation.id, { assistantModelId: modelId });
    },
    [updateConversation],
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
        updateConversation(conversation.id, { selectedAddons: filteredAddons });
      } else {
        updateConversation(conversation.id, {
          selectedAddons: conversation.selectedAddons.concat(addonId),
        });
      }
    },
    [updateConversation],
  );

  const handleOnApplyAddons = useCallback(
    (conversation: Conversation, addonIds: string[]) => {
      updateConversation(conversation.id, {
        selectedAddons: addonIds.filter((addonId) => addonsMap[addonId]),
      });
    },
    [updateConversation, addonsMap],
  );

  const handleChangePrompt = useCallback(
    (conversation: Conversation, prompt: string) => {
      updateConversation(conversation.id, { prompt });
    },
    [updateConversation],
  );

  const handleChangeTemperature = useCallback(
    (conversation: Conversation, temperature: number) => {
      updateConversation(conversation.id, { temperature });
    },
    [updateConversation],
  );

  const handleDeleteMessage = useCallback(
    (index: number, conv: Conversation) => {
      let finalIndex = index;
      if (conv.messages.at(0)?.role === Role.System) {
        finalIndex += 1;
      }
      deleteMessage(finalIndex);
    },
    [deleteMessage],
  );

  const onSendMessage = useCallback(
    (message: Message) => {
      sendMessages(selectedConversations, message, 0, 0);
    },
    [sendMessages, selectedConversations],
  );

  const onRegenerateMessage = useCallback(() => {
    const lastUserMessageIndex = selectedConversations[0].messages
      .map((msg) => msg.role)
      .lastIndexOf(Role.User);
    sendMessages(
      selectedConversations,
      selectedConversations[0].messages[lastUserMessageIndex],
      selectedConversations[0].messages.length - lastUserMessageIndex,
      0,
    );
    handleScrollToContainerHeight('smooth');
  }, [sendMessages, handleScrollToContainerHeight, selectedConversations]);

  const onEditMessage = useCallback(
    (editedMessage: Message, index: number) => {
      stopStreamMessage();
      sendMessages(
        selectedConversations,
        editedMessage,
        mergedMessages.length - index,
        0,
      );
    },
    [
      stopStreamMessage,
      sendMessages,
      mergedMessages.length,
      selectedConversations,
    ],
  );

  const handleTemporarySettingsSave = useCallback(
    (conversation: Conversation, args: ConversationsTemporarySettings) => {
      selectedConversationsTemporarySettings.current[conversation.id] = args;
    },
    [selectedConversationsTemporarySettings],
  );

  const onChatInputResize = useCallback((inputHeight: number) => {
    setInputHeight(inputHeight);
  }, []);

  const showChatHeader = useCallback(
    (conv: Conversation) =>
      conv.messages.length !== 0 && enabledFeatures.has(Feature.TopSettings),
    [enabledFeatures],
  );
  const showFloatingOverlay =
    isSmallScreen() && isAnyMenuOpen && !isIsolatedView;
  const showLastMessageRegenerate =
    !isReplay &&
    !isPlayback &&
    !isExternal &&
    !messageIsStreaming &&
    !isLastMessageError;
  const showPublicationControls =
    isExternal && selectedConversations.length === 1;
  const showNotAllowedModel = !isPlayback && notAllowedType;
  const showChatCompare = isCompareMode && selectedConversations.length < 2;
  const showChatInput = (!isReplay || isNotEmptyConversations) && !isExternal;
  const showPlaybackControls = isPlayback;
  const showReplayControls = useMemo(
    () =>
      isReplay &&
      !messageIsStreaming &&
      (isReplayPaused || !!isReplayRequiresVariables),
    [isReplay, isReplayPaused, isReplayRequiresVariables, messageIsStreaming],
  );
  const showModelSelect = useMemo(
    () =>
      enabledFeatures.has(Feature.TopChatModelSettings) &&
      !isPlayback &&
      !isExternal,
    [enabledFeatures, isPlayback, isExternal],
  );
  const showClearConversations = useMemo(
    () =>
      enabledFeatures.has(Feature.TopClearConversation) &&
      !isPlayback &&
      !isReplay &&
      !messageIsStreaming &&
      !isExternal,
    [enabledFeatures, isExternal, isPlayback, isReplay, messageIsStreaming],
  );

  return (
    <div
      className="relative min-w-0 flex-auto shrink grow overflow-y-auto"
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
                        {showChatHeader(conv) && (
                          <div className="z-10 flex flex-col">
                            <ChatHeader
                              conversation={conv}
                              isCompareMode={isCompareMode}
                              isShowChatInfo={enabledFeatures.has(
                                Feature.TopChatInfo,
                              )}
                              isShowClearConversation={showClearConversations}
                              isShowModelSelect={showModelSelect}
                              isShowSettings={showChatSettings}
                              setShowSettings={handleSetShowSettings}
                              selectedConversationIds={selectedConversationsIds}
                              onClearConversation={() =>
                                handleClearConversation(conv)
                              }
                              onUnselectConversation={(id) =>
                                unselectConversations([id])
                              }
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div
                    onScroll={handleContainerScroll}
                    ref={chatContainerRef}
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
                      {mergedMessages.length > 0 && (
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
                  {showNotAllowedModel ? (
                    <NotAllowedModel
                      showScrollDownButton={showScrollDownButton}
                      onScrollDownClick={handleScrollDown}
                      type={notAllowedType}
                    />
                  ) : (
                    <>
                      {showPublicationControls && (
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
                          onStopConversation={() => stopStreamMessage()}
                          onResize={onChatInputResize}
                          isShowInput={showChatInput}
                        >
                          {showReplayControls && !isNotEmptyConversations && (
                            <StartReplayButton />
                          )}
                          {isExternal && (
                            <ChatExternalControls
                              conversations={selectedConversations}
                              showScrollDownButton={showScrollDownButton}
                              onScrollDownClick={handleScrollDown}
                            />
                          )}
                        </ChatInput>
                      )}

                      {showPlaybackControls && (
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
              {showChatSettings && (
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
                      onChangeSettings={(args) =>
                        handleTemporarySettingsSave(conv, args)
                      }
                      onApplySettings={onApplySettings}
                      onClose={() => setShowChatSettings(false)}
                      isOpen={showChatSettings}
                      isRight={index === 1}
                      isCompareMode={isCompareMode}
                    />
                  ))}
                </div>
              )}
              {showChatCompare && (
                <div className="flex h-full w-[50%] flex-col overflow-auto">
                  <ChatCompareSelect
                    conversations={conversations}
                    selectedConversations={selectedConversations}
                    onConversationSelect={(conversation) => {
                      selectForCompare(conversation);
                    }}
                  />
                  <div
                    className="shrink-0"
                    style={{ height: inputHeight + 56 }}
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
