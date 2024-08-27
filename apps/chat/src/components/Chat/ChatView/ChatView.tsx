import { FloatingOverlay } from '@floating-ui/react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import classNames from 'classnames';

import { useChatViewAutoScroll } from './hooks/useChatViewAutoScroll';
import { useChatViewConversationHandlers } from './hooks/useChatViewConversationHandlers';
import { useChatViewEnablers } from './hooks/useChatViewEnablers';
import { useChatViewSelectors } from './hooks/useChatViewSelectors';
import { useMergedMessages } from './hooks/useMergedMessages';

import { Role } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';

import { AddonsActions } from '@/src/store/addons/addons.reducers';
import { useAppDispatch } from '@/src/store/hooks';
import { ModelsActions } from '@/src/store/models/models.reducers';

import { ChatCompareRotate } from './components/ChatCompareRotate';
import { ErrorMessageDiv } from './components/ErrorMessageDiv';
import { NotAllowedModel } from './components/NotAllowedModel';

import { ChatCompareSection } from './ChatCompareSection';
import { ChatControlsSection } from './ChatControlsSection';
import { ChatHeaderSection } from './ChatHeaderSection';
import { ChatMessages } from './ChatMessages/ChatMessages';
import { ChatSettingsEmptySection } from './ChatSettingsEmptySection';
import { ChatSettingsSection } from './ChatSettingsSection';

export const ChatView = memo(() => {
  const dispatch = useAppDispatch();
  const {
    appName,
    addons,
    addonsMap,
    models,
    modelsMap,
    conversations,
    selectedConversations,
    selectedConversationsIds,
    prompts,
    enabledFeatures,
    modelError,
    isAnyMenuOpen,
    isChatFullWidth,
    isCompareMode,
    isExternal,
    isIsolatedView,
    isMessageStreaming,
    isModelsLoaded,
    isPlayback,
    isReplay,
    isReplayPaused,
    isReplayRequiresVariables,
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
    isMessageStreaming,
  );

  const {
    mergedMessages,
    isLastMessageError,
    selectedConversationsTemporarySettings,
  } = useMergedMessages({
    selectedConversations,
    onMessagesChange: useCallback(
      ({ isNew, areConversationsEmpty, hasNewSelection }) => {
        setShowChatSettings(false);

        if (isNew) {
          if (areConversationsEmpty) {
            setShowScrollDownButton(false);
          } else {
            handleScroll();
          }
        }

        if (hasNewSelection) {
          setAutoScroll(true);
        }
      },
      [handleScroll, setShowScrollDownButton, setAutoScroll],
    ),
  });

  const {
    handleApplySettings,
    handleCancelPlaybackMode,
    handleChangePrompt,
    handleChangeTemperature,
    handleClearConversation,
    handleDeleteMessage,
    handleEditMessage,
    handleLike,
    handleOnApplyAddons,
    handleOnChangeAddon,
    handleRegenerateMessage,
    handleSelectAssistantSubModel,
    handleSelectForCompare,
    handleSelectModel,
    handleSendMessage,
    handleStopStreamMessage,
    handleTemporarySettingsSave,
    handleUnselectConversations,
  } = useChatViewConversationHandlers(
    modelsMap,
    addonsMap,
    selectedConversations,
    mergedMessages,
    selectedConversationsTemporarySettings,
  );

  const {
    isLikesEnabled,
    showChatControls,
    showChatSection,
    showClearConversations,
    showCompareChatSection,
    showEmptyChatSettings,
    showErrorMessage,
    showFloatingOverlay,
    showLastMessageRegenerate,
    showModelSelect,
    showNotAllowedModel,
    showPlaybackControls,
    showTopChatInfo,
    showTopSettings,
  } = useChatViewEnablers({
    enabledFeatures,
    isAnyMenuOpen,
    isCompareMode,
    isExternal,
    isIsolatedView,
    isLastMessageError,
    isMessageStreaming,
    isPlayback,
    isReplay,
    modelError,
    notAllowedType,
    selectedConversations,
  });

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

  const handleSetShowSettings = useCallback(
    (show: boolean) => {
      if (show) {
        dispatch(ModelsActions.getModels());
        dispatch(AddonsActions.getAddons());
      }
      setShowChatSettings(show);
    },
    [dispatch],
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

  const handleChatInputResize = useCallback((inputHeight: number) => {
    setInputHeight(inputHeight);
  }, []);

  return (
    <div
      className="relative min-w-0 flex-auto shrink grow overflow-y-auto"
      data-qa="chat"
      id="chat"
    >
      {showFloatingOverlay && <FloatingOverlay className="z-30 bg-blackout" />}
      {showErrorMessage && <ErrorMessageDiv error={modelError} />}
      {showChatSection && (
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
                  <ChatHeaderSection
                    modelsMap={modelsMap}
                    addonsMap={addonsMap}
                    selectedConversations={selectedConversations}
                    selectedConversationsIds={selectedConversationsIds}
                    isCompareMode={isCompareMode}
                    isChatFullWidth={isChatFullWidth}
                    isPlayback={isPlayback}
                    isExternal={isExternal}
                    showChatSettings={showChatSettings}
                    showClearConversations={showClearConversations}
                    showModelSelect={showModelSelect}
                    showTopChatInfo={showTopChatInfo}
                    showTopSettings={showTopSettings}
                    onCancelPlaybackMode={handleCancelPlaybackMode}
                    onClearConversation={handleClearConversation}
                    onSetShowSettings={handleSetShowSettings}
                    onUnselectConversations={handleUnselectConversations}
                  />
                  <div
                    ref={chatContainerRef}
                    className="h-full overflow-x-hidden"
                    onScroll={handleContainerScroll}
                    data-qa="scrollable-area"
                  >
                    <ChatSettingsEmptySection
                      appName={appName}
                      selectedConversations={selectedConversations}
                      inputHeight={inputHeight}
                      showSettings={showEmptyChatSettings}
                      models={models}
                      modelsMap={modelsMap}
                      prompts={prompts}
                      onSelectModel={handleSelectModel}
                      onSelectAssistantSubModel={handleSelectAssistantSubModel}
                      onChangeAddon={handleOnChangeAddon}
                      onChangePrompt={handleChangePrompt}
                      onChangeTemperature={handleChangeTemperature}
                      onApplyAddons={handleOnApplyAddons}
                    />
                    <ChatMessages
                      ref={chatMessagesRef}
                      isCompareMode={isCompareMode}
                      isExternal={isExternal}
                      isLikesEnabled={isLikesEnabled}
                      isPlayback={isPlayback}
                      isReplay={isReplay}
                      mergedMessages={mergedMessages}
                      selectedConversations={selectedConversations}
                      notAllowedType={notAllowedType}
                      onDeleteMessage={handleDeleteMessage}
                      onEditMessage={handleEditMessage}
                      onLike={handleLike}
                      onRegenerateMessage={() => {
                        handleRegenerateMessage();
                        handleScrollToContainerHeight('smooth');
                      }}
                      showLastMessageRegenerate={showLastMessageRegenerate}
                    />
                  </div>
                  {showNotAllowedModel && (
                    <NotAllowedModel
                      isChatFullWidth={isChatFullWidth}
                      showScrollDownButton={showScrollDownButton}
                      type={notAllowedType}
                      onScrollDownClick={handleScrollDown}
                    />
                  )}
                  {showChatControls && (
                    <ChatControlsSection
                      isExternal={isExternal}
                      isMessageStreaming={isMessageStreaming}
                      isLastMessageError={isLastMessageError}
                      isReplay={isReplay}
                      isReplayPaused={isReplayPaused}
                      isReplayRequiresVariables={!!isReplayRequiresVariables}
                      selectedConversations={selectedConversations}
                      showPlaybackControls={showPlaybackControls}
                      showScrollDownButton={showScrollDownButton}
                      nextMessageBoxRef={nextMessageBoxRef}
                      textareaRef={textareaRef}
                      onChatInputResize={handleChatInputResize}
                      onRegenerateMessage={handleRegenerateMessage}
                      onScrollDownClick={handleScrollDown}
                      onSendMessage={handleSendMessage}
                      onStopStreamMessage={handleStopStreamMessage}
                    />
                  )}
                </div>
              </div>
              {showChatSettings && (
                <ChatSettingsSection
                  addons={addons}
                  isCompareMode={isCompareMode}
                  prompts={prompts}
                  selectedConversations={selectedConversations}
                  showChatSettings={showChatSettings}
                  onApplySettings={handleApplySettings}
                  onChangeSettings={handleTemporarySettingsSave}
                  onClose={() => setShowChatSettings(false)}
                />
              )}
              {showCompareChatSection && (
                <ChatCompareSection
                  conversations={conversations}
                  inputHeight={inputHeight}
                  selectedConversations={selectedConversations}
                  onConversationSelect={handleSelectForCompare}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
});

ChatView.displayName = 'ChatView';
