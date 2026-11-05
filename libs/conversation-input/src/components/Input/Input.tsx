import { AttachmentTray } from '@epam/ai-dial-attachment-input';
import {
  mergeClasses,
  useIsMobile,
  useIsPhone,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ErrorText,
  GhostIconButton,
  LiveRegion,
  LiveRegionElement,
  LiveRegionPoliteness,
} from '@epam/ai-dial-ui-kit';
import { IconMicrophone } from '@tabler/icons-react';
import {
  ChangeEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CONVERSATION_INPUT_CLASS } from '../../constants/public-class-names';
import { useAttachments } from '../../hooks/useAttachments';
import { useInputHistoryNavigation } from '../../hooks/useInputHistoryNavigation';
import { useMessageState } from '../../hooks/useMessageState';
import { useTextInsertion } from '../../hooks/useTextInsertion';
import { VoiceRecordingMode } from '../../hooks/useVoiceRecorder';
import { ActionRowLayout, SendOnEnter } from '../../models/Input';
import type { InputHandle, InputProps } from '../../models/Input';
import { ToolsChips } from '../ToolsChips/ToolsChips';
import { VoiceBar } from '../VoiceBar/VoiceBar';
import { SendButton } from './Buttons/SendButton';
import { StopButton } from './Buttons/StopButton';
import { useCommandMenuAnchor } from './hooks/useCommandMenuAnchor';
import { useCommandMenuController } from './hooks/useCommandMenuController';
import { useDismissibleTools } from './hooks/useDismissibleTools';
import { usePasteHandling } from './hooks/usePasteHandling';
import { useSendKeyboard } from './hooks/useSendKeyboard';
import { useVoiceInput } from './hooks/useVoiceInput';
import { buildInputCssVars } from './input-css-vars';
import styles from './Input.module.scss';
import { InputAttachButton } from './InputAttachButton';
import { InputCommandMenuArea } from './InputCommandMenuArea';
import { InputTextareaArea } from './InputTextareaArea';
import { ModelSelectorControl } from './ModelSelectorControl';

/** Full conversation input field: textarea, send/stop, model selector, attachment menu, voice recording, and chat-settings controls. */
export const Input = forwardRef<InputHandle, InputProps>(
  (
    {
      message: messageProp = '',
      messageRevision,
      focusRequestId,
      textInsertion,
      onSend,
      onUploadAttachment,
      onStop,
      isStreaming = false,
      onChange,
      onAttachmentsChange,
      placeholder = 'Type a message...',
      ariaLabel,
      attachLabel = 'Attach file',
      fileAccept,
      addMenuTitle = 'Add',
      menuTitle = 'Menu',
      menuCloseLabel = 'Close',
      removeLabel,
      retryLabel,
      uploadingLabel,
      expandLabel,
      clickLabel,
      sendLabel,
      sendTooltip,
      emptyMessageTooltip,
      stopLabel,
      micLabel = 'Dictate',
      recordVoiceLabel = 'Record voice',
      stopRecordingLabel,
      discardRecordingLabel,
      colors,
      typography,
      attachmentTray,
      modelMenu,
      className,
      pendingDropFiles = [],
      onDropFilesConsumed,
      pendingAttachments = [],
      onPendingAttachmentsConsumed,
      pasteTextThreshold = 4000,
      maxMessageLength = 50000,
      deployments,
      selectedDeploymentId,
      onDeploymentChange,
      modelSelectorLabels,
      initialAttachments = [],
      hideAddButton = false,
      hideAttachFile = false,
      hideActionBar = false,
      actionRowLayout = ActionRowLayout.Stacked,
      isInlineActionRowAllowedBelowDesktop = false,
      renderFooterActions,
      isInputDisabled = false,
      isModelSelectorDisabled = false,
      isSendDisabled = false,
      isAudioMessageSupported = false,
      isVoiceRecordingSupported = isAudioMessageSupported,
      onTranscribeAudio,
      transcribingLabel,
      voiceErrorLabel,
      sendOnEnter = SendOnEnter.Enter,
      prefixAttachments = [],
      onRemovePrefixAttachment,
      chatSettings,
      toolsMenuItems,
      onToolToggle,
      canRemoveTools = true,
      toolsMenuTitle,
      toolsBackLabel,
      toolsChipLabels,
      menuOverlays,
      activeMentions,
      onBackspaceAtCaret,
      caretPositionOverride,
      commandMenu,
      autoFocus = false,
      messageHistory,
      onDialFileSystemClick,
      dialFileSystemLabel,
      validateAttachment,
      onAttachmentClick,
      modelPickerOverlay,
      onModelPickerOpenChange,
      maximumAttachmentsAmount,
      onAttachmentsLimitExceeded,
      isAttachmentsEnabled = true,
      isTextAttachmentsAllowed = true,
      usageLimitsSlot,
      onMessageTooLong,
    },
    ref,
  ) => {
    const isMobile = useIsMobile();
    const isPhone = useIsPhone();
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const handlePickerOpenChange = (open: boolean) => {
      setIsPickerOpen(open);
      onModelPickerOpenChange?.(open);
    };
    const historyNav = useInputHistoryNavigation(messageHistory);
    const mentionRanges = activeMentions ?? [];
    const hasActiveMentions = mentionRanges.length > 0;

    const cssVars = useMemo(() => buildInputCssVars(colors), [colors]);
    const { message, setMessage, textareaRef } = useMessageState({
      messageProp,
      messageRevision,
    });

    /*
     * An autofocused textarea created already holding text keeps its caret at the
     * start, so typing would land in front of a seeded `/skill` mention. Only a
     * focused textarea is touched: `setSelectionRange` on an unfocused one moves
     * focus in some WebKit versions, and `useTextInsertion` already inserts at
     * the end of a composer nobody has focused.
     */
    useEffect(() => {
      const textarea = textareaRef.current;
      if (
        textarea == null ||
        textarea.value.length === 0 ||
        document.activeElement !== textarea
      ) {
        return;
      }
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }, [textareaRef]);

    useEffect(() => {
      if (focusRequestId !== undefined) textareaRef.current?.focus();
    }, [focusRequestId, textareaRef]);

    useImperativeHandle(
      ref,
      () => ({
        getCaretPosition: () =>
          textareaRef.current?.selectionStart ?? message.length,
      }),
      [message, textareaRef],
    );

    const { handleUndoKeyDown, markCaretPlaced } = useTextInsertion({
      insertion: textInsertion,
      textareaRef,
    });

    const {
      isMenuOpen,
      query,
      activeWordStart,
      closeOnOutsidePress,
      handleValueChange,
      commandMenuListboxId,
      commandMenuOverlayRef,
      activeCommandOptionId,
      handleTextareaClick,
      handleTextareaFocus,
      handleTextareaKeyUp,
      skipFocusMenuEvaluationRef,
      triggerEnd,
      hasCommandEmptyQueryHint,
      markerOffset,
      handleCloseCommandMenu,
      isSendGesture,
      handleCommandMenuKeyDown,
    } = useCommandMenuController({
      commandMenu,
      message,
      setMessage,
      textareaRef,
      historyNav,
      onChange,
      caretPositionOverride,
      messageRevision,
      markCaretPlaced,
      sendOnEnter,
    });

    const draftRef = useRef(message);
    draftRef.current = message;

    /* Reads the text through draftRef so the handler keeps its identity across keystrokes. */
    const handleExpandPastedText = useCallback(
      (text: string) => {
        const draft = draftRef.current;
        const next = draft ? `${draft}\n${text}` : text;
        draftRef.current = next;
        setMessage(next);
        onChange?.(next);
      },
      [setMessage, onChange],
    );

    const {
      attachments,
      buildAttachments,
      addAttachments,
      resetAttachments,
      handleRemove,
      handleRetry,
      handleExpand,
      hasBlockedAttachments,
    } = useAttachments({
      initialAttachments,
      onUploadAttachment,
      onAttachmentsChange,
      validateAttachment,
      pendingDropFiles,
      onDropFilesConsumed,
      isDropDisabled: isInputDisabled,
      pendingAttachments,
      onPendingAttachmentsConsumed,
      onExpandPastedText: handleExpandPastedText,
      maximumAttachmentsAmount,
      baseAttachmentsAmount: prefixAttachments.length,
      onAttachmentsLimitExceeded,
    });

    const {
      voiceState,
      analyserNodeRef,
      voiceError,
      startRecording,
      stopRecording,
      discardRecording,
      isVoiceActive,
      latestTranscript,
    } = useVoiceInput({
      addAttachments,
      buildAttachments,
      draftRef,
      setMessage,
      historyNav,
      onChange,
      onTranscribeAudio,
      voiceErrorLabel,
      textareaRef,
      skipFocusMenuEvaluationRef,
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const handlePaste = usePasteHandling({
      addAttachments,
      isAttachmentsEnabled,
      isTextAttachmentsAllowed,
      pasteTextThreshold,
      maxMessageLength,
      onMessageTooLong,
      commandMenu,
    });

    /*
     * A tracked mention's `/{name}` text is part of `message` itself, so a
     * message that carries only a mention already has non-whitespace content —
     * no separate "has a mention" branch is needed here.
     */
    const hasSendableContent =
      message.trim().length > 0 || attachments.length > 0;
    const canSend =
      hasSendableContent &&
      !hasBlockedAttachments &&
      !isSendDisabled &&
      !isVoiceActive;
    const { visibleTools, handleToolDismiss } = useDismissibleTools({
      toolsMenuItems,
      canRemoveTools,
      isPhone,
      onToolToggle,
    });

    const hasModelSelected =
      deployments === undefined || selectedDeploymentId != null;
    const shouldShowMicButton = isAudioMessageSupported && !isStreaming;

    const { handleSend, handleKeyDown } = useSendKeyboard({
      message,
      setMessage,
      attachments,
      resetAttachments,
      historyNav,
      onSend,
      onMessageTooLong,
      maxMessageLength,
      isSendDisabled,
      isVoiceActive,
      isInputDisabled,
      isStreaming,
      canSend,
      hasModelSelected,
      handleUndoKeyDown,
      handleCommandMenuKeyDown,
      isSendGesture,
      onBackspaceAtCaret,
    });

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;
      const newAttachments = buildAttachments(files);
      // Reset so the same file can be picked again
      e.target.value = '';
      addAttachments(newAttachments);
    };

    const {
      textareaAreaRef,
      caretAnchor,
      mirrorInsertions,
      isMirrorActive,
      mirrorRef,
      selectionRects,
      updateSelectionRects,
      handleTextareaScroll,
    } = useCommandMenuAnchor({
      commandMenu,
      message,
      textareaRef,
      hasActiveMentions,
      markerOffset,
      triggerEnd,
      hasCommandEmptyQueryHint,
    });

    const textarea = (
      <textarea
        className={mergeClasses(
          styles.textarea,
          isMirrorActive && styles.textareaMentionMode,
          typography?.fontClassName || 'dial-body-paragraph-text',
          'relative z-0 field-sizing-content max-h-[272px] w-full resize-none overflow-y-auto border-0 bg-transparent ps-1 pe-1 outline-hidden',
          'disabled:cursor-not-allowed',
        )}
        ref={textareaRef}
        autoFocus={autoFocus}
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          historyNav.notifyChange();

          const inputEvent =
            e.nativeEvent instanceof InputEvent ? e.nativeEvent : undefined;
          handleValueChange(
            e.target.value,
            e.target.selectionStart ?? e.target.value.length,
            inputEvent?.isComposing ?? false,
          );
          onChange?.(e.target.value);
        }}
        onSelect={updateSelectionRects}
        onScroll={handleTextareaScroll}
        onFocus={handleTextareaFocus}
        onClick={handleTextareaClick}
        onKeyDown={handleKeyDown}
        onKeyUp={handleTextareaKeyUp}
        onPaste={handlePaste}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-autocomplete={commandMenu == null ? undefined : 'list'}
        aria-controls={isMenuOpen ? commandMenuListboxId : undefined}
        aria-activedescendant={activeCommandOptionId ?? undefined}
        aria-hidden={hasActiveMentions ? true : undefined}
        disabled={isInputDisabled}
        readOnly={isVoiceActive}
        rows={1}
      />
    );

    const textareaArea = (
      <InputTextareaArea
        areaRef={textareaAreaRef}
        mirrorRef={mirrorRef}
        isMirrorActive={isMirrorActive}
        fontClassName={typography?.fontClassName}
        message={message}
        mentionRanges={mentionRanges}
        mirrorInsertions={mirrorInsertions}
        selectionRects={selectionRects}
      >
        <InputCommandMenuArea
          textarea={textarea}
          textareaRef={textareaRef}
          commandMenu={commandMenu}
          caretAnchor={caretAnchor}
          fontClassName={typography?.fontClassName}
          isMenuOpen={isMenuOpen}
          query={query}
          activeWordStart={activeWordStart}
          listboxId={commandMenuListboxId}
          activeOptionId={activeCommandOptionId}
          overlayRef={commandMenuOverlayRef}
          onOutsidePress={closeOnOutsidePress}
          onClose={handleCloseCommandMenu}
        />
      </InputTextareaArea>
    );

    /*
     * Shared between the normal footer and the voice bar's second row: same
     * menu, same file input, only its disabled state differs. Disabled while
     * a dictation/attachment recording is anything but actively Recording, so
     * it cannot be used to interrupt a pending transcription.
     */
    const attachButtonNode = hideAddButton ? undefined : (
      <InputAttachButton
        fileInputRef={fileInputRef}
        textareaRef={textareaRef}
        message={message}
        style={cssVars}
        hideAttachFile={hideAttachFile}
        isInputDisabled={isInputDisabled}
        isStreaming={isStreaming}
        isAttachmentsEnabled={isAttachmentsEnabled}
        isVoiceRecordingSupported={isVoiceRecordingSupported}
        isVoiceActive={isVoiceActive}
        startRecording={startRecording}
        isPhone={isPhone}
        canRemoveTools={canRemoveTools}
        toolsMenuItems={toolsMenuItems}
        onToolToggle={onToolToggle}
        chatSettings={chatSettings}
        menuOverlays={menuOverlays}
        onDialFileSystemClick={onDialFileSystemClick}
        dialFileSystemLabel={dialFileSystemLabel}
        attachLabel={attachLabel}
        addMenuTitle={addMenuTitle}
        menuTitle={menuTitle}
        menuCloseLabel={menuCloseLabel}
        recordVoiceLabel={recordVoiceLabel}
        toolsMenuTitle={toolsMenuTitle}
        toolsBackLabel={toolsBackLabel}
      />
    );

    /*
     * One line does not fit a phone, so the inline layout is desktop-only by
     * default and a host does not have to branch on viewport itself. An embed
     * whose composer is already wide below 1280px opts the narrower widths in
     * rather than reimplementing the layout.
     */
    const isInlineActionRow =
      actionRowLayout === ActionRowLayout.Inline &&
      (!isMobile || isInlineActionRowAllowedBelowDesktop);

    const addClusterNode = attachButtonNode && (
      <div
        className={mergeClasses('flex', CONVERSATION_INPUT_CLASS.addCluster)}
      >
        {attachButtonNode}
      </div>
    );

    /*
     * In the wrapping row the chips never shrink below their own width, so on
     * a phone the trailing actions wrap to the next line instead of crushing
     * a chip down to its icon. `max-w-full` still lets one over-long chip
     * truncate its label.
     */
    const chipsNode = visibleTools.length > 0 && onToolToggle != null && (
      <div
        className={mergeClasses(
          'min-w-0',
          isInlineActionRow ? 'flex-1' : 'max-w-full flex-[1_0_auto]',
          CONVERSATION_INPUT_CLASS.toolsChips,
        )}
      >
        <ToolsChips
          items={visibleTools}
          onToolToggle={onToolToggle}
          onToolDismiss={handleToolDismiss}
          canRemove={canRemoveTools}
          removeLabel={toolsChipLabels?.removeLabel}
          stateOnLabel={toolsChipLabels?.stateOnLabel}
          stateOffLabel={toolsChipLabels?.stateOffLabel}
        />
      </div>
    );

    return (
      <div
        ref={containerRef}
        style={cssVars}
        className={mergeClasses(
          styles.wrapper,
          isInputDisabled && styles.wrapperDisabled,
          isInputDisabled && 'cursor-not-allowed',
          'flex w-full max-w-[748px] flex-col justify-center gap-3 rounded-xl border',
          'p-4 focus-within:outline focus-within:-outline-offset-1 active:outline active:-outline-offset-1',
          className,
          CONVERSATION_INPUT_CLASS.wrapper,
        )}
      >
        {(prefixAttachments.length > 0 || attachments.length > 0) && (
          <AttachmentTray
            attachments={[...prefixAttachments, ...attachments]}
            onRemove={(id) => {
              if (prefixAttachments.some((a) => a.id === id)) {
                onRemovePrefixAttachment?.(id);
              } else {
                handleRemove(id);
              }
            }}
            onRetry={handleRetry}
            onExpand={handleExpand}
            labels={{
              removeLabel,
              retryLabel,
              uploadingLabel,
              expandLabel,
              clickLabel,
            }}
            styles={{
              ...attachmentTray,
              /*
               * A full tray bleeds into the wrapper's inline-end padding so the
               * cards scroll to the edge; the wrapper itself keeps `p-4`, so
               * the action row and its controls never shift.
               */
              className: mergeClasses(
                attachments.length > 6 && '-me-4',
                attachmentTray?.className,
              ),
            }}
            onAttachmentClick={
              onAttachmentClick != null
                ? (id) => {
                    const found = [...prefixAttachments, ...attachments].find(
                      (a) => a.id === id,
                    );
                    if (found != null) onAttachmentClick(found);
                  }
                : undefined
            }
          />
        )}
        {!hideAddButton && (
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={fileAccept}
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={handleFileChange}
          />
        )}
        {/* A failed dictation is not a field error: announce it. Mounted before the failure so it is announced; out of the column gap while empty. */}
        <LiveRegion
          politeness={LiveRegionPoliteness.Assertive}
          className="min-w-0 px-1 wrap-break-word"
        >
          {voiceError && <ErrorText text={voiceError} />}
        </LiveRegion>
        {isVoiceActive && (
          <VoiceBar
            embedded
            state={voiceState}
            analyserNodeRef={analyserNodeRef}
            onStop={stopRecording}
            onDiscard={discardRecording}
            attachButton={attachButtonNode}
            stopLabel={stopRecordingLabel}
            discardLabel={discardRecordingLabel}
            processingLabel={transcribingLabel}
          />
        )}
        {!isVoiceActive && hideActionBar && textareaArea}
        {/*
         * Tool chips are variable-width, so in the inline layout they get their
         * own row above rather than competing with the textarea for the line.
         */}
        {!isVoiceActive && !hideActionBar && isInlineActionRow && chipsNode && (
          <div className="flex">{chipsNode}</div>
        )}
        {!isVoiceActive && !hideActionBar && (
          <div
            className={mergeClasses(
              'flex items-center gap-2',
              isInlineActionRow ? 'flex-nowrap' : 'flex-wrap',
              CONVERSATION_INPUT_CLASS.actionRow,
            )}
          >
            {/*
             * Both layouts render in visual order rather than reordering with
             * `order-*`, so the tab order always matches what is on screen.
             */}
            {isInlineActionRow && addClusterNode}
            <div
              className={mergeClasses(
                'flex min-w-0 items-center self-stretch',
                isInlineActionRow ? 'flex-1' : 'w-full',
                CONVERSATION_INPUT_CLASS.textareaWrap,
              )}
            >
              {textareaArea}
            </div>
            {!isInlineActionRow && addClusterNode}
            {!isInlineActionRow && chipsNode}
            <div
              className={mergeClasses(
                'ms-auto flex shrink-0 items-center gap-2',
                CONVERSATION_INPUT_CLASS.footerActions,
              )}
            >
              {renderFooterActions ? (
                renderFooterActions({ canSend, onSend: handleSend })
              ) : (
                <>
                  {usageLimitsSlot}
                  <ModelSelectorControl
                    deployments={deployments}
                    selectedDeploymentId={selectedDeploymentId}
                    onDeploymentChange={onDeploymentChange}
                    modelSelectorLabels={modelSelectorLabels}
                    menuStyles={modelMenu}
                    nameClassName={typography?.modelSelectorNameClassName}
                    versionClassName={typography?.modelSelectorVersionClassName}
                    isStreaming={isStreaming}
                    isMobile={isPhone}
                    isDisabled={isModelSelectorDisabled}
                    style={cssVars}
                    modelPickerOverlay={modelPickerOverlay}
                    isPickerOpen={isPickerOpen}
                    onPickerToggle={() => handlePickerOpenChange(!isPickerOpen)}
                    onPickerOpenChange={handlePickerOpenChange}
                  />
                  {shouldShowMicButton && (
                    <GhostIconButton
                      icon={
                        <IconMicrophone
                          size={DIAL_ICON_SIZE.LG}
                          stroke={DIAL_KIT_ICON_STROKE}
                          aria-hidden
                        />
                      }
                      aria-label={micLabel}
                      tooltipProps={{ tooltip: micLabel }}
                      className="shrink-0"
                      onClick={() =>
                        startRecording(VoiceRecordingMode.Dictation)
                      }
                      disabled={isInputDisabled || isStreaming}
                    />
                  )}
                  {isStreaming && onStop ? (
                    <StopButton onStop={onStop} ariaLabel={stopLabel} />
                  ) : (
                    !isStreaming && (
                      <SendButton
                        onSend={handleSend}
                        isDisabled={!hasModelSelected || !canSend}
                        ariaLabel={sendLabel}
                        sendTooltip={
                          hasSendableContent
                            ? sendTooltip
                            : (emptyMessageTooltip ?? sendTooltip)
                        }
                      />
                    )
                  )}
                </>
              )}
            </div>
          </div>
        )}
        <LiveRegion visuallyHidden atomic as={LiveRegionElement.Span}>
          <span key={latestTranscript.revision}>{latestTranscript.text}</span>
        </LiveRegion>
      </div>
    );
  },
);

Input.displayName = 'Input';
