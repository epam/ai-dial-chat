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
  DialGhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconFile, IconMicrophone } from '@tabler/icons-react';
import {
  ChangeEvent,
  type FC,
  KeyboardEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAttachments } from '../../hooks/useAttachments';
import { useDelayedUnmount } from '../../hooks/useDelayedUnmount';
import { useInputHistoryNavigation } from '../../hooks/useInputHistoryNavigation';
import { useMessageState } from '../../hooks/useMessageState';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { SendOnEnter } from '../../models/Input';
import type { InputProps } from '../../models/Input';
import { AddAttachmentButton } from '../AddAttachmentButton/AddAttachmentButton';
import { VoiceBar } from '../VoiceBar/VoiceBar';
import { SendButton } from './Buttons/SendButton';
import { StopButton } from './Buttons/StopButton';
import styles from './Input.module.scss';
import { ModelSelectorControl } from './ModelSelectorControl';

const SEND_BUTTON_EXIT_MS = 160;

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
  sendLabel,
  stopLabel,
  micLabel = 'Record voice message',
  colors,
  typography,
  className,
  pendingDropFiles = [],
  onDropFilesConsumed,
  pendingAttachments = [],
  onPendingAttachmentsConsumed,
  pasteTextThreshold = 4000,
  deployments,
  selectedDeploymentId,
  onDeploymentChange,
  modelSelectorLabels,
  initialAttachments = [],
  isStacked = false,
  hideAddButton = false,
  hideAttachFile = false,
  hideActionBar = false,
  renderFooterActions,
  isInputDisabled = false,
  isModelSelectorDisabled = false,
  isSendDisabled = false,
  isTranscriptionSupported = false,
  onUploadAudio,
  onTranscribeAudio,
  sendOnEnter = SendOnEnter.Enter,
  prefixAttachments = [],
  onRemovePrefixAttachment,
  chatSettings,
  autoFocus = false,
  messageHistory,
  onDialFileSystemClick,
  dialFileSystemLabel,
  validateAttachment,
  onAttachmentClick,
  modelPickerOverlay,
  maximumAttachmentsAmount,
  onAttachmentsLimitExceeded,
}) => {
  const isMobile = useIsMobile();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const historyNav = useInputHistoryNavigation(messageHistory);

  const cssVars = useMemo(
    () =>
      buildCssVars({
        '--ci-bg': colors?.background,
        '--ci-text': colors?.text,
        '--ci-border': colors?.border,
        '--ci-border-hover': colors?.borderHover,
        '--ci-border-focus': colors?.borderFocus,
        '--ci-placeholder': colors?.placeholder,
        '--ci-shadow': colors?.shadow,
        '--ci-shadow-focus': colors?.shadowFocus,
        '--ci-send-bg': colors?.sendBackground,
        '--ci-send-text': colors?.sendText,
        '--ci-stop-color': colors?.stopColor,
      }),
    [colors],
  );

  const dialFileSystemMenuItem = useMemo(
    () =>
      onDialFileSystemClick
        ? [
            {
              key: 'dial-fs',
              label: dialFileSystemLabel ?? 'DIAL file system',
              icon: <IconFile size={BASE_ICON_SIZE} aria-hidden />,
              onClick: onDialFileSystemClick,
            },
          ]
        : [],
    [onDialFileSystemClick, dialFileSystemLabel],
  );

  const { message, setMessage, textareaRef, isMultiLine } = useMessageState({
    messageProp,
    messageRevision,
  });

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

  const handleTranscript = useCallback(
    (transcript: string) => {
      setMessage(transcript);
      onChange?.(transcript);
    },
    [onChange, setMessage],
  );

  const {
    state: voiceState,
    waveformData,
    errorMessage: voiceError,
    startRecording,
    stopRecording,
    confirmRecording,
    discardRecording,
  } = useVoiceRecorder({
    onUploadAudio,
    onTranscribeAudio,
    onTranscript: handleTranscript,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { handlePaste } = useClipboardPaste(addAttachments, pasteTextThreshold);

  const hasSendableContent =
    message.trim().length > 0 || attachments.length > 0;
  const canSend =
    hasSendableContent && !hasBlockedAttachments && !isSendDisabled;
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
   * Stacked layout: textarea on its own row above the action bar. Used when the
   * caller opts in (edit mode), whenever attachments are present, or when the
   * message spans multiple visual lines (either explicit newlines or word-wrap).
   */
  const isStackedLayout =
    isStacked ||
    attachments.length > 0 ||
    message.includes('\n') ||
    isMultiLine;
  const hasModelSelected =
    deployments === undefined || selectedDeploymentId != null;

  const handleSend = async () => {
    if (isSendDisabled) return;

    const currentMessage = message;
    const currentAttachments = attachments;
    setMessage('');
    historyNav.reset();
    try {
      await onSend?.(currentMessage, currentAttachments);
      currentAttachments.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
      resetAttachments([]);
    } catch {
      setMessage(currentMessage);
      resetAttachments(currentAttachments);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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

  if (voiceState !== 'idle') {
    return (
      <VoiceBar
        state={voiceState}
        waveformData={waveformData}
        errorMessage={voiceError}
        onStop={stopRecording}
        onConfirm={confirmRecording}
        onDiscard={discardRecording}
        style={cssVars}
        className={className}
      />
    );
  }

  const textarea = (
    <textarea
      className={mergeClasses(
        styles.textarea,
        typography?.fontClassName,
        'max-h-[272px] w-full resize-none overflow-y-auto border-0 bg-transparent outline-none [field-sizing:content]',
      )}
      ref={textareaRef}
      autoFocus={autoFocus}
      value={message}
      onChange={(e) => {
        setMessage(e.target.value);
        historyNav.notifyChange();
        onChange?.(e.target.value);
      }}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={isInputDisabled}
      rows={1}
    />
  );

  const inputBox = (
    <div
      ref={containerRef}
      style={cssVars}
      className={mergeClasses(
        styles.wrapper,
        isInputDisabled && styles.wrapperDisabled,
        'flex min-h-[56px] w-full max-w-[748px] flex-col justify-center gap-3 rounded-xl border',
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
          labels={{ removeLabel, retryLabel }}
          onAttachmentClick={
            onAttachmentClick != null
              ? (id) => {
                  const found = attachments.find((a) => a.id === id);
                  if (found != null) onAttachmentClick(found);
                }
              : undefined
          }
        />
      )}
      {hideActionBar ? (
        isStackedLayout && textarea
      ) : (
        <div
          className={mergeClasses(
            'flex items-center gap-2',
            isStackedLayout ? 'flex-wrap' : 'flex-wrap desktop:flex-nowrap',
          )}
        >
          {!hideAddButton && (
            <div
              className={mergeClasses(
                'order-2 flex',
                !isStackedLayout && 'desktop:order-1',
              )}
            >
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
              />
            </div>
          )}
          <div
            className={mergeClasses(
              'order-1 flex w-full min-w-0 items-center self-stretch',
              !isStackedLayout &&
                'desktop:order-2 desktop:w-auto desktop:flex-1',
            )}
          >
            {textarea}
          </div>
          <div
            className={mergeClasses(
              'flex flex-shrink-0 items-center gap-2',
              'order-3 ms-auto',
              !isStackedLayout && 'desktop:ms-0',
            )}
          >
            {renderFooterActions ? (
              renderFooterActions({ canSend, onSend: handleSend })
            ) : (
              <>
                <ModelSelectorControl
                  deployments={deployments}
                  selectedDeploymentId={selectedDeploymentId}
                  onDeploymentChange={onDeploymentChange}
                  modelSelectorLabels={modelSelectorLabels}
                  isStreaming={isStreaming}
                  isMobile={isMobile}
                  isInputDisabled={isInputDisabled}
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
            {isTranscriptionSupported &&
              !message.trim() &&
              !isSendButtonExiting && (
                <DialGhostIconButton
                  icon={<IconMicrophone size={DIAL_ICON_SIZE.LG} aria-hidden />}
                  aria-label={micLabel}
                  className="size-8 flex-shrink-0"
                  onClick={startRecording}
                  disabled={isInputDisabled || isStreaming}
                />
              )}
          </div>
        </div>
      )}
    </div>
  );

  return inputBox;
};
