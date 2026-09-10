import {
  AttachmentTray,
  useClipboardPaste,
} from '@epam/ai-dial-attachment-input';
import {
  buildCssVars,
  mergeClasses,
  useIsMobile,
} from '@epam/ai-dial-chat-shared';
import {
  BASE_ICON_SIZE,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconFile, IconMicrophone } from '@tabler/icons-react';
import {
  ChangeEvent,
  ClipboardEvent,
  type FC,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAttachments } from '../../hooks/useAttachments';
import { useCommandMenu } from '../../hooks/useCommandMenu/useCommandMenu';
import { useDelayedUnmount } from '../../hooks/useDelayedUnmount';
import { useInputHistoryNavigation } from '../../hooks/useInputHistoryNavigation';
import { useMessageState } from '../../hooks/useMessageState';
import {
  useVoiceRecorder,
  VoiceRecorderState,
  VoiceRecordingMode,
} from '../../hooks/useVoiceRecorder';
import { SendOnEnter } from '../../models/Input';
import type { InputProps } from '../../models/Input';
import { AddAttachmentButton } from '../AddAttachmentButton/AddAttachmentButton';
import { ToolsChips } from '../ToolsChips/ToolsChips';
import { VoiceBar } from '../VoiceBar/VoiceBar';
import { SendButton } from './Buttons/SendButton';
import { StopButton } from './Buttons/StopButton';
import styles from './Input.module.scss';
import { ModelSelectorControl } from './ModelSelectorControl';

const SEND_BUTTON_EXIT_MS = 160;

/** Full conversation input field: textarea, send/stop, model selector, attachment menu, voice recording, and chat-settings controls. */
export const Input: FC<InputProps> = ({
  message: messageProp = '',
  messageRevision,
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
  sendLabel,
  stopLabel,
  micLabel = 'Dictate',
  recordVoiceLabel = 'Record voice',
  stopRecordingLabel,
  discardRecordingLabel,
  colors,
  typography,
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
  inlineStartSlot,
  onInlineStartRemove,
  commandMenu,
  autoFocus = false,
  messageHistory,
  onDialFileSystemClick,
  dialFileSystemLabel,
  validateAttachment,
  onAttachmentClick,
  modelPickerOverlay,
  maximumAttachmentsAmount,
  onAttachmentsLimitExceeded,
  isAttachmentsEnabled = true,
  usageLimitsSlot,
  onMessageTooLong,
}) => {
  const isMobile = useIsMobile();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const historyNav = useInputHistoryNavigation(messageHistory);
  const hasInlineStartSlot = inlineStartSlot != null;
  const inlineStartSlotRef = useRef<HTMLDivElement>(null);
  const [inlineStartIndent, setInlineStartIndent] = useState(0);

  const cssVars = useMemo(
    () =>
      buildCssVars({
        '--ci-bg': colors?.background,
        '--ci-text': colors?.text,
        '--ci-border': colors?.border,
        '--ci-border-focus': colors?.borderFocus,
        '--ci-placeholder': colors?.placeholder,
        '--ci-text-disabled': colors?.textDisabled,
        '--ci-model-selector-caret-color': colors?.modelSelectorCaret,
        '--ci-model-selector-hover-bg': colors?.modelSelectorHoverBg,
        '--ci-model-selector-disabled-color': colors?.modelSelectorDisabled,
        '--ci-model-selector-name-color': colors?.modelSelectorName,
        '--ci-model-selector-version-color': colors?.modelSelectorVersion,
        '--ci-voice-error': colors?.voiceError,
        '--ci-voice-waveform': colors?.voiceWaveform,
        '--ci-voice-accent': colors?.voiceAccent,
        /*
         * Where the textarea's first text line starts (the inline-start
         * slot's width plus a caret gap while a slot is present, unset
         * otherwise) — shared by the first-line `text-indent` and the
         * command-menu hint overlay so both start at the same offset.
         */
        '--ci-first-line-indent': hasInlineStartSlot
          ? `calc(${inlineStartIndent}px + 4px)`
          : undefined,
      }),
    [colors, hasInlineStartSlot, inlineStartIndent],
  );

  const dialFileSystemMenuItem = useMemo(
    () =>
      onDialFileSystemClick
        ? [
            {
              key: 'dial-fs',
              label: dialFileSystemLabel ?? 'DIAL file system',
              icon: (
                <IconFile
                  size={BASE_ICON_SIZE}
                  aria-hidden
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              ),
              onClick: onDialFileSystemClick,
            },
          ]
        : [],
    [onDialFileSystemClick, dialFileSystemLabel],
  );

  const { message, setMessage, textareaRef } = useMessageState({
    messageProp,
    messageRevision,
  });

  const { isMenuOpen, query, dismiss, handleValueChange } = useCommandMenu({
    config: commandMenu,
    message,
  });

  /*
   * The command menu's empty-query hint: while the menu is open the value is
   * the trigger prefix plus the query, so an empty query means the textarea
   * holds exactly the prefix — the hint renders right after it and disappears
   * with the first query keystroke. This gates only the hint overlay itself:
   * the textarea's wrapper below is driven by the hint's *configuration*, not
   * the live menu state, so the hint appearing and disappearing never
   * remounts the textarea mid-typing.
   */
  const hasCommandHintConfigured = commandMenu?.emptyQueryHint != null;
  const hasCommandEmptyQueryHint =
    hasCommandHintConfigured && isMenuOpen && query === '';

  /*
   * Selection path of the command menu: removes the `/query` text from the
   * textarea so it is never sent, resets the draft-history state to match,
   * and notifies the host. The consume lives here because the textarea value
   * is owned by this component — a host-side removal would race the lib.
   */
  const handleCloseCommandMenu = useCallback(
    (options?: { consumeQuery?: boolean }) => {
      if (commandMenu == null) return;

      dismiss();
      if (!options?.consumeQuery) return;

      /*
       * A selection made by mouse moved focus to the menu row, and that row
       * unmounts with the menu — return focus to the textarea so typing
       * continues where the consumed `/query` left off.
       */
      textareaRef.current?.focus();

      const consumed = `${commandMenu.triggerPrefix}${query}`;
      if (!message.startsWith(consumed)) return;

      const nextMessage = message.slice(consumed.length);
      setMessage(nextMessage);
      historyNav.notifyChange();
      onChange?.(nextMessage);
    },
    [
      commandMenu,
      dismiss,
      query,
      message,
      setMessage,
      historyNav,
      onChange,
      textareaRef,
    ],
  );

  useEffect(() => {
    const slotElement = inlineStartSlotRef.current;
    if (slotElement == null) return;
    /*
     * The slot's width drives the textarea's first-line `text-indent`, so it
     * is re-measured whenever the slot's content resizes (e.g. a different
     * element of a different width), not only when the slot first mounts.
     */
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry != null) setInlineStartIndent(entry.contentRect.width);
    });
    observer.observe(slotElement);
    return () => observer.disconnect();
  }, [hasInlineStartSlot]);

  const handleExpandPastedText = useCallback(
    (text: string) => {
      setMessage((prev) => (prev ? `${prev}\n${text}` : text));
    },
    [setMessage],
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
    pendingAttachments,
    onPendingAttachmentsConsumed,
    onExpandPastedText: handleExpandPastedText,
    maximumAttachmentsAmount,
    baseAttachmentsAmount: prefixAttachments.length,
    onAttachmentsLimitExceeded,
  });

  const handleAttachAudio = useCallback(
    (file: File) => {
      addAttachments(buildAttachments([file]));
    },
    [addAttachments, buildAttachments],
  );

  const focusAfterTranscriptRef = useRef(false);
  const draftRef = useRef(message);
  draftRef.current = message;
  const [latestTranscript, setLatestTranscript] = useState({
    text: '',
    revision: 0,
  });
  const handleTranscript = useCallback(
    (text: string) => {
      const transcript = text.trim();
      if (transcript) {
        const draft = draftRef.current;
        const nextMessage = `${draft}${draft && !/\s$/.test(draft) ? ' ' : ''}${transcript}`;
        draftRef.current = nextMessage;
        setMessage(nextMessage);
        setLatestTranscript((previous) => ({
          text: transcript,
          revision: previous.revision + 1,
        }));
        historyNav.notifyChange();
        onChange?.(nextMessage);
      }
      focusAfterTranscriptRef.current = true;
    },
    [setMessage, historyNav, onChange],
  );

  const {
    state: voiceState,
    analyserNodeRef,
    errorMessage: voiceError,
    startRecording,
    stopRecording,
    discardRecording,
  } = useVoiceRecorder({
    onAttachAudio: handleAttachAudio,
    onTranscribeAudio,
    onTranscript: handleTranscript,
    errorLabel: voiceErrorLabel,
  });
  const isVoiceActive = voiceState !== VoiceRecorderState.Idle;

  useEffect(() => {
    if (
      voiceState === VoiceRecorderState.Idle &&
      focusAfterTranscriptRef.current
    ) {
      focusAfterTranscriptRef.current = false;
      textareaRef.current?.focus();
    }
  }, [voiceState, textareaRef]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { handlePaste: handleClipboardPaste } = useClipboardPaste(
    addAttachments,
    isAttachmentsEnabled ? pasteTextThreshold : Infinity,
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      /*
       * Deliberately narrower than the send gate above. With attachments
       * enabled an over-threshold paste is converted to an attachment and
       * never reaches the textarea, so warning here would be about text the
       * user did not paste inline; an under-threshold paste is at most
       * pasteTextThreshold characters and cannot reach the cap on its own.
       * Existing text plus a small paste crossing the cap is not visible from
       * the pasted string's length at all — the send gate catches that.
       */
      if (!isAttachmentsEnabled) {
        const text = e.clipboardData.getData('text/plain');
        if (text.length >= maxMessageLength) {
          onMessageTooLong?.(text.length, maxMessageLength);
        }
      }
      handleClipboardPaste(e);
    },
    [
      isAttachmentsEnabled,
      maxMessageLength,
      onMessageTooLong,
      handleClipboardPaste,
    ],
  );

  /*
   * The inline-start slot (a selected skill) counts as sendable content on
   * its own: the host's send-time payload includes it, so a skill with an
   * empty draft is a valid message and the send button mounts and enables.
   */
  const hasSendableContent =
    message.trim().length > 0 ||
    attachments.length > 0 ||
    hasInlineStartSlot;
  const canSend =
    hasSendableContent &&
    !hasBlockedAttachments &&
    !isSendDisabled &&
    !isVoiceActive;
  /*
   * Keeps the send button mounted just long enough to play its exit
   * animation (`.sendButtonExiting` in Input.module.scss) after content is
   * cleared, instead of vanishing instantly.
   */
  const {
    shouldRender: shouldRenderSendButton,
    isExiting: isSendButtonExiting,
    instanceKey: sendButtonKey,
  } = useDelayedUnmount(
    !isStreaming && hasSendableContent,
    SEND_BUTTON_EXIT_MS,
  );
  /*
   * Chips the user dismissed with the chip's ×. Dismissal is view state of this
   * input only: a dismissed tool comes back the moment it is switched on again
   * from the `+` menu, and the whole set is forgotten when the deployment
   * offers a different list of tools.
   */
  const [dismissedToolIds, setDismissedToolIds] = useState<string[]>([]);
  const toolIdsSignature = (toolsMenuItems ?? [])
    .map((tool) => tool.id)
    .join('|');

  useEffect(() => {
    setDismissedToolIds([]);
  }, [toolIdsSignature]);

  const visibleTools = useMemo(() => {
    const tools = toolsMenuItems ?? [];
    if (!canRemoveTools) return tools;
    return tools.filter(
      (tool) => tool.isSelected || !dismissedToolIds.includes(tool.id),
    );
  }, [toolsMenuItems, dismissedToolIds, canRemoveTools]);

  const handleToolDismiss = useCallback(
    (toolId: string) => {
      setDismissedToolIds((prev) =>
        prev.includes(toolId) ? prev : [...prev, toolId],
      );
      const tool = toolsMenuItems?.find((item) => item.id === toolId);
      if (tool?.isSelected) onToolToggle?.(toolId);
    },
    [toolsMenuItems, onToolToggle],
  );

  const hasModelSelected =
    deployments === undefined || selectedDeploymentId != null;
  const shouldShowMicButton = useMemo(
    () => isAudioMessageSupported && !isSendButtonExiting && !isStreaming,
    [isAudioMessageSupported, isSendButtonExiting, isStreaming],
  );

  const handleSend = async () => {
    if (isSendDisabled || isVoiceActive) return;
    if (message.length >= maxMessageLength) {
      onMessageTooLong?.(message.length, maxMessageLength);
      return;
    }

    const currentMessage = message;
    const currentAttachments = attachments;
    setMessage('');
    historyNav.reset();
    try {
      await onSend?.(currentMessage, currentAttachments);
      currentAttachments.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
        if (a.playUrl) URL.revokeObjectURL(a.playUrl);
      });
      resetAttachments([]);
    } catch {
      setMessage(currentMessage);
      resetAttachments(currentAttachments);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isVoiceActive) return;
    if (!e.nativeEvent.isComposing && !isInputDisabled && !isStreaming) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const cursorPos = e.currentTarget.selectionStart ?? 0;
        const newValue = historyNav.navigate(
          e.key === 'ArrowUp' ? 'up' : 'down',
          message,
          cursorPos,
        );
        if (newValue !== null) {
          e.preventDefault();
          setMessage(newValue);
          return;
        }
      }

      /*
       * The slot's remove gesture: a Backspace with the caret collapsed at
       * position 0 has nothing to delete backwards, so it is redirected to
       * the inline-start slot instead — the standard chip-removal gesture of
       * chat composers.
       */
      if (
        e.key === 'Backspace' &&
        hasInlineStartSlot &&
        onInlineStartRemove != null &&
        e.currentTarget.selectionStart === 0 &&
        e.currentTarget.selectionEnd === 0
      ) {
        e.preventDefault();
        onInlineStartRemove();
        return;
      }
    }

    const isEnterKey = e.key === 'Enter';
    if (!isEnterKey) return;

    const shouldSend =
      sendOnEnter === SendOnEnter.MetaEnter
        ? (e.metaKey || e.ctrlKey) && !e.shiftKey
        : !e.shiftKey && !e.metaKey && !e.ctrlKey;

    if (shouldSend) {
      e.preventDefault();
      if (!isStreaming && canSend && hasModelSelected && !isInputDisabled) {
        handleSend();
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const newAttachments = buildAttachments(files);
    // Reset so the same file can be picked again
    e.target.value = '';
    addAttachments(newAttachments);
  };

  const textarea = (
    <textarea
      className={mergeClasses(
        styles.textarea,
        hasInlineStartSlot && styles.textareaIndented,
        typography?.fontClassName || 'dial-body-paragraph-text',
        'max-h-[272px] w-full resize-none overflow-y-auto border-0 bg-transparent outline-none [field-sizing:content]',
      )}
      ref={textareaRef}
      autoFocus={autoFocus}
      value={message}
      onChange={(e) => {
        setMessage(e.target.value);
        historyNav.notifyChange();
        handleValueChange(e.target.value, e.nativeEvent.isComposing);
        onChange?.(e.target.value);
      }}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      /* The placeholder is suppressed while a slot occupies the first line: the slot itself says what the input holds. */
      placeholder={hasInlineStartSlot ? undefined : placeholder}
      aria-label={ariaLabel}
      disabled={isInputDisabled}
      readOnly={isVoiceActive}
      rows={1}
    />
  );

  /*
   * The command menu anchors to the textarea itself: the kit `Dropdown` runs
   * with interactions off (`trigger={[]}`) so the controlled `open` is the
   * only opener, keeps focus in the textarea on open (`initialFocus={-1}`)
   * so typing continues to filter, and treats clicks inside the textarea as
   * inside the menu (`outsidePressIgnoreRef`). `className="w-full"` offsets
   * the kit trigger wrapper's flex display so the textarea keeps full width.
   * `matchReferenceWidth={false}` drops the kit's default min-width equal to
   * the textarea's width, so the overlay sizes to its rendered content
   * instead of stretching across the whole input.
   */
  const commandMenuArea =
    commandMenu == null ? (
      textarea
    ) : (
      <Dropdown
        className="w-full"
        open={isMenuOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) dismiss();
        }}
        placement="top-start"
        trigger={[]}
        initialFocus={-1}
        matchReferenceWidth={false}
        outsidePressIgnoreRef={textareaRef}
        renderOverlay={() => {
          const menu = commandMenu.renderMenu({
            query,
            close: handleCloseCommandMenu,
          });
          if (commandMenu.menuLabel == null) {
            return menu;
          }
          return (
            <div role="group" aria-label={commandMenu.menuLabel}>
              {menu}
            </div>
          );
        }}
      >
        {textarea}
      </Dropdown>
    );

  /*
   * The inline-start slot overlays the textarea's first line from inside its
   * container: the slot is absolutely positioned at the inline-start edge of
   * the first line, the first text line indents past it via
   * `--ci-first-line-indent`, and slot content whose height is one label
   * line (the ChatSkill chip) aligns with the first text line exactly. Every
   * following line keeps the full width (a textarea is one paragraph block,
   * so `text-indent` applies to its first line only). The same wrapper hosts
   * the command menu's empty-query hint overlay. The wrapper's presence is
   * decided by configuration only — a slot is present, a hint is configured —
   * never by live menu state: toggling an ancestor of the textarea when the
   * menu opens or when the hint appears/disappears would remount it and throw
   * away focus and the caret mid-typing. Without either configured the
   * wrapper collapses to the bare textarea, byte-identical to the slot-less
   * rendering.
   */
  const textareaArea =
    hasInlineStartSlot || hasCommandHintConfigured ? (
      <div className="relative w-full">
        {hasInlineStartSlot && (
          <div ref={inlineStartSlotRef} className={styles.inlineStartSlot}>
            {inlineStartSlot}
          </div>
        )}
        {hasCommandEmptyQueryHint && commandMenu != null && (
          <span
            className={mergeClasses(
              styles.commandHint,
              typography?.fontClassName || 'dial-body-paragraph-text',
            )}
            aria-hidden
          >
            {/*
             * The invisible mirror of the trigger prefix occupies exactly the
             * prefix's rendered width in the textarea's own typography, so
             * the hint lands immediately after the real prefix without
             * measuring anything. `aria-hidden`: the hint restates the open
             * menu, which announces itself.
             */}
            <span className="invisible">{commandMenu.triggerPrefix}</span>
            {commandMenu.emptyQueryHint}
          </span>
        )}
        {commandMenuArea}
      </div>
    ) : (
      commandMenuArea
    );

  return (
    <div
      ref={containerRef}
      style={cssVars}
      className={mergeClasses(
        styles.wrapper,
        isInputDisabled && styles.wrapperDisabled,
        'flex w-full max-w-[748px] flex-col justify-center gap-3 rounded-xl border shadow-md',
        'focus-within:outline focus-within:-outline-offset-1 active:outline active:-outline-offset-1',
        attachments.length > 6 ? 'py-3 ps-3' : 'p-3',
        className,
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
          labels={{ removeLabel, retryLabel, uploadingLabel }}
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
      {isVoiceActive && (
        <VoiceBar
          embedded
          state={voiceState}
          analyserNodeRef={analyserNodeRef}
          errorMessage={voiceError}
          onStop={stopRecording}
          onDiscard={discardRecording}
          stopLabel={stopRecordingLabel}
          discardLabel={discardRecordingLabel}
          processingLabel={transcribingLabel}
        />
      )}
      {!isVoiceActive && hideActionBar && textareaArea}
      {!isVoiceActive && !hideActionBar && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-full min-w-0 items-center self-stretch">
            {textareaArea}
          </div>
          {!hideAddButton && (
            <div className="flex">
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
              <AddAttachmentButton
                onAttachClick={
                  hideAttachFile
                    ? undefined
                    : () => fileInputRef.current?.click()
                }
                attachLabel={attachLabel}
                addMenuTitle={addMenuTitle}
                menuTitle={menuTitle}
                menuCloseLabel={menuCloseLabel}
                style={cssVars}
                isDisabled={isInputDisabled}
                chatSettings={chatSettings}
                extraMenuItems={dialFileSystemMenuItem}
                onRecordVoice={
                  isVoiceRecordingSupported &&
                  isAttachmentsEnabled &&
                  !isStreaming
                    ? () => startRecording(VoiceRecordingMode.Attachment)
                    : undefined
                }
                recordVoiceLabel={recordVoiceLabel}
                /*
                 * The "Tools" submenu exists only to bring a dismissed chip
                 * back. With removal off every chip is always on screen, so the
                 * entry would be dead weight — and where tools are the menu's
                 * only content, withholding them drops the `+` button entirely.
                 */
                toolsMenuItems={canRemoveTools ? toolsMenuItems : undefined}
                onToolToggle={onToolToggle}
                toolsMenuTitle={toolsMenuTitle}
                toolsBackLabel={toolsBackLabel}
                menuOverlays={menuOverlays}
              />
            </div>
          )}
          {visibleTools.length > 0 && onToolToggle != null && (
            <div className="min-w-0 flex-1">
              <ToolsChips
                items={visibleTools}
                onToolToggle={onToolToggle}
                onToolDismiss={handleToolDismiss}
                canRemove={canRemoveTools}
                removeLabel={toolsChipLabels?.removeLabel}
              />
            </div>
          )}
          <div className="ms-auto flex flex-shrink-0 items-center gap-2">
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
                  isStreaming={isStreaming}
                  isMobile={isMobile}
                  isDisabled={isModelSelectorDisabled}
                  style={cssVars}
                  modelPickerOverlay={modelPickerOverlay}
                  isPickerOpen={isPickerOpen}
                  onPickerToggle={() => setIsPickerOpen((prev) => !prev)}
                  onPickerOpenChange={setIsPickerOpen}
                />
                {isStreaming && onStop ? (
                  <StopButton onStop={onStop} ariaLabel={stopLabel} />
                ) : (
                  !isStreaming &&
                  shouldRenderSendButton && (
                    <SendButton
                      key={sendButtonKey}
                      onSend={handleSend}
                      isDisabled={
                        !hasModelSelected ||
                        hasBlockedAttachments ||
                        isSendDisabled
                      }
                      ariaLabel={sendLabel}
                      isExiting={isSendButtonExiting}
                    />
                  )
                )}
              </>
            )}

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
                className="size-[40px] flex-shrink-0 mobile:min-h-11 mobile:min-w-11"
                onClick={() => startRecording(VoiceRecordingMode.Dictation)}
                disabled={isInputDisabled || isStreaming}
              />
            )}
          </div>
        </div>
      )}
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span key={latestTranscript.revision}>{latestTranscript.text}</span>
      </span>
    </div>
  );
};
