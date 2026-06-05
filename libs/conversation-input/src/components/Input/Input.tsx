import type { Attachment } from '@epam/ai-dial-chat-shared';
import {
  AttachmentType,
  RequestStatus,
  buildCssVars,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  ChangeEvent,
  type FC,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useClipboardPaste } from '../../hooks/useClipboardPaste.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import type { InputProps } from '../../models/Input.js';
import { generateAttachmentId } from '../../utils/generateAttachmentId.js';
import { AddAttachmentButton } from '../AddAttachmentButton/AddAttachmentButton.js';
import { AttachmentTray } from '../AttachmentTray/AttachmentTray.js';
import { SendButton } from './Buttons/SendButton.js';
import { StopButton } from './Buttons/StopButton.js';
import styles from './Input.module.scss';
import { ModelSelectorControl } from './ModelSelectorControl.js';

export const Input: FC<InputProps> = ({
  message: messageProp = '',
  onSend,
  onUploadAttachment,
  onStop,
  isStreaming = false,
  onChange,
  onAttachmentsChange,
  placeholder = 'Type a message...',
  ariaLabel,
  attachLabel = 'Attach file',
  addMenuLabel = 'Add',
  menuTitle = 'Menu',
  menuCloseLabel = 'Close',
  removeLabel,
  retryLabel,
  sendLabel,
  stopLabel,
  colors,
  typography,
  className,
  pendingDropFiles = [],
  onDropFilesConsumed,
  pasteTextThreshold = 4000,
  deployments,
  selectedDeploymentId,
  onDeploymentChange,
  modelSelectorLabels,
  initialAttachments = [],
  isStacked = false,
  hideAddButton = false,
  hideActionBar = false,
  renderFooterActions,
  isInputDisabled = false,
}) => {
  const isMobile = useIsMobile();
  const cssVars = useMemo(
    () =>
      buildCssVars({
        '--ci-bg': colors?.background,
        '--ci-text': colors?.text,
        '--ci-border': colors?.border,
        '--ci-border-focus': colors?.borderFocus,
        '--ci-placeholder': colors?.placeholder,
        '--ci-send-bg': colors?.sendBackground,
        '--ci-send-text': colors?.sendText,
        '--ci-stop-color': colors?.stopColor,
        '--ci-font-family': typography?.fontFamily,
        '--ci-font-size': typography?.fontSize,
        '--ci-font-weight': typography?.fontWeight?.toString(),
        '--ci-line-height': typography?.lineHeight,
      }),
    [colors, typography],
  );

  const [message, setMessage] = useState(messageProp);
  const [attachments, setAttachments] =
    useState<Attachment[]>(initialAttachments);

  useEffect(() => {
    if (messageProp) {
      setMessage(messageProp);
    }
  }, [messageProp]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      attachments.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
    };
  }, []);

  const buildAttachments = useCallback((files: File[]): Attachment[] => {
    return files.map((file) => {
      const isImage = file.type.startsWith('image/');
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
      return {
        id: generateAttachmentId(),
        name: file.name,
        contentType: file.type,
        file,
        type: isImage ? AttachmentType.Image : AttachmentType.File,
        status: RequestStatus.Idle,
        previewUrl,
      };
    });
  }, []);

  const updateAttachments = useCallback(
    (updater: (current: Attachment[]) => Attachment[]) => {
      setAttachments((prev) => {
        const updated = updater(prev);
        onAttachmentsChange?.(updated);
        return updated;
      });
    },
    [onAttachmentsChange],
  );

  const uploadAttachment = useCallback(
    async (attachment: Attachment) => {
      if (!onUploadAttachment) return;

      updateAttachments((current) =>
        current.map((item) =>
          item.id === attachment.id
            ? { ...item, status: RequestStatus.Loading }
            : item,
        ),
      );

      try {
        const url = await onUploadAttachment(attachment);
        updateAttachments((current) =>
          current.map((item) =>
            item.id === attachment.id
              ? { ...item, status: RequestStatus.Idle, url }
              : item,
          ),
        );
      } catch {
        updateAttachments((current) =>
          current.map((item) =>
            item.id === attachment.id
              ? { ...item, status: RequestStatus.Error }
              : item,
          ),
        );
      }
    },
    [onUploadAttachment, updateAttachments],
  );

  const addAttachments = useCallback(
    (newAttachments: Attachment[]) => {
      updateAttachments((prev) => [...prev, ...newAttachments]);
      newAttachments.forEach((attachment) => {
        void uploadAttachment(attachment);
      });
    },
    [updateAttachments, uploadAttachment],
  );

  useEffect(() => {
    if (pendingDropFiles.length === 0) return;
    const built = buildAttachments(pendingDropFiles);
    addAttachments(built);
    onDropFilesConsumed?.();
  }, [pendingDropFiles]); // intentionally omit buildAttachments/addAttachments/onDropFilesConsumed — stable refs

  const { handlePaste } = useClipboardPaste(addAttachments, pasteTextThreshold);

  const hasBlockedAttachments = attachments.some(
    (attachment) =>
      attachment.status === RequestStatus.Loading ||
      attachment.status === RequestStatus.Error,
  );
  const hasSendableContent =
    message.trim().length > 0 || attachments.length > 0;
  const canSend = hasSendableContent && !hasBlockedAttachments;
  // Stacked layout: textarea on its own row above the action bar. Used when the
  // caller opts in (edit mode) or whenever attachments are present.
  const isStackedLayout = isStacked || attachments.length > 0;
  const hasModelSelected =
    deployments === undefined || selectedDeploymentId != null;

  const handleSend = async () => {
    if (isInputDisabled) return;
    const currentMessage = message;
    const currentAttachments = attachments;
    setMessage('');
    try {
      await onSend?.(currentMessage, currentAttachments);
      currentAttachments.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
      setAttachments([]);
      onAttachmentsChange?.([]);
    } catch {
      setMessage(currentMessage);
      setAttachments(currentAttachments);
      onAttachmentsChange?.(currentAttachments);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && canSend && hasModelSelected) {
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

  const handleRemove = useCallback(
    (id: string) => {
      updateAttachments((prev) => {
        const target = prev.find((a) => a.id === id);
        if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
        return prev.filter((a) => a.id !== id);
      });
    },
    [updateAttachments],
  );

  const handleRetry = useCallback(
    (id: string) => {
      const target = attachments.find((a) => a.id === id);
      if (!target) return;
      void uploadAttachment(target);
    },
    [attachments, uploadAttachment],
  );

  const handleExpand = useCallback(
    async (id: string) => {
      const target = attachments.find((a) => a.id === id);
      if (!target || target.type !== AttachmentType.Pasted) return;
      const text = await target.file.text();
      setMessage((prev) => (prev ? `${prev}\n${text}` : text));
      handleRemove(id);
    },
    [attachments, handleRemove],
  );

  const textarea = (
    <textarea
      className={mergeClasses(
        styles.textarea,
        'max-h-[272px] w-full resize-none overflow-y-auto border-0 bg-transparent outline-none [field-sizing:content]',
      )}
      value={message}
      onChange={(e) => {
        setMessage(e.target.value);
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
  return (
    <div
      style={cssVars}
      className={mergeClasses(
        styles.wrapper,
        isInputDisabled && styles.wrapperDisabled,
        'flex min-h-[56px] w-full max-w-[748px] flex-col justify-center gap-3 rounded border px-3 py-2',
        className,
      )}
    >
      {attachments.length > 0 && (
        <AttachmentTray
          attachments={attachments}
          onRemove={handleRemove}
          onRetry={handleRetry}
          onExpand={handleExpand}
          removeLabel={removeLabel}
          retryLabel={retryLabel}
        />
      )}
      {isStackedLayout && textarea}

      {!hideActionBar && (
        <div
          className={mergeClasses(
            'flex items-center gap-2',
            isStackedLayout
              ? hideAddButton
                ? 'justify-end'
                : 'justify-between'
              : 'flex-wrap desktop:flex-nowrap',
          )}
        >
          {!hideAddButton && (
            <div
              className={mergeClasses(
                'flex',
                !isStackedLayout && 'order-2 desktop:order-1',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="sr-only"
                aria-hidden
                tabIndex={-1}
                onChange={handleFileChange}
              />
              <AddAttachmentButton
                onAttachClick={() => fileInputRef.current?.click()}
                attachLabel={attachLabel}
                addMenuLabel={addMenuLabel}
                menuTitle={menuTitle}
                menuCloseLabel={menuCloseLabel}
                style={cssVars}
                isDisabled={isInputDisabled}
              />
            </div>
          )}
          {!isStackedLayout && (
            <div className="order-1 flex w-full min-w-0 items-center self-stretch desktop:order-2 desktop:w-auto desktop:flex-1">
              {textarea}
            </div>
          )}
          <div
            className={mergeClasses(
              'flex flex-shrink-0 items-center gap-2',
              !isStackedLayout && 'order-3 ml-auto desktop:ml-0',
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
                  style={cssVars}
                />
                {isStreaming ? (
                  <StopButton onStop={onStop} ariaLabel={stopLabel} />
                ) : (
                  hasSendableContent && (
                    <SendButton
                      onSend={handleSend}
                      isDisabled={
                        isInputDisabled ||
                        !hasModelSelected ||
                        hasBlockedAttachments
                      }
                      ariaLabel={sendLabel}
                    />
                  )
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
