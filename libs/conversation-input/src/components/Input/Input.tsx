import type { ApiAttachment, UiAttachment } from '@epam/ai-dial-chat-shared';
import {
  AttachmentType,
  RequestStatus,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  BASE_ICON_SIZE,
  DialDropdown,
  DialGhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconPaperclip, IconPlus } from '@tabler/icons-react';
import {
  CSSProperties,
  type FC,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { InputProps } from '../../models/Input.js';
import { AttachmentTray } from '../AttachmentTray/AttachmentTray.js';
import styles from './Input.module.scss';
import { SendButton } from './SendButton.js';
import { StopButton } from './StopButton.js';

export const Input: FC<InputProps> = ({
  initialMessage = '',
  onSend,
  onStop,
  isStreaming = false,
  onChange,
  onAttachmentsChange,
  onUploadAttachment,
  placeholder = 'Type a message...',
  ariaLabel,
  attachLabel = 'Attach file',
  addMenuLabel = 'Add',
  removeLabel,
  retryLabel,
  colors,
  typography,
  className,
}) => {
  const cssVars = {
    ...(colors?.background && { '--ci-bg': colors.background }),
    ...(colors?.text && { '--ci-text': colors.text }),
    ...(colors?.border && { '--ci-border': colors.border }),
    ...(colors?.borderFocus && { '--ci-border-focus': colors.borderFocus }),
    ...(colors?.placeholder && { '--ci-placeholder': colors.placeholder }),
    ...(colors?.sendBackground && { '--ci-send-bg': colors.sendBackground }),
    ...(colors?.sendText && { '--ci-send-text': colors.sendText }),
    ...(typography?.fontFamily && {
      '--ci-font-family': typography.fontFamily,
    }),
    ...(typography?.fontSize && { '--ci-font-size': typography.fontSize }),
    ...(typography?.fontWeight && {
      '--ci-font-weight': String(typography.fontWeight),
    }),
    ...(typography?.lineHeight && {
      '--ci-line-height': typography.lineHeight,
    }),
  } as CSSProperties;

  const [message, setMessage] = useState(initialMessage);
  const [attachments, setAttachments] = useState<UiAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      attachments.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
    };
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasUploadedAttachment = attachments.some(
    (a) => a.apiAttachment != null,
  );
  const hasLoadingAttachment = attachments.some(
    (a) => a.status === RequestStatus.Loading,
  );
  const canSend =
    (message.trim().length > 0 || hasUploadedAttachment) &&
    !hasLoadingAttachment;

  const handleSend = () => {
    if (isStreaming || !canSend) return;

    const apiAttachments = attachments
      .filter((a) => a.apiAttachment != null)
      .map((a) => a.apiAttachment as ApiAttachment);

    onSend?.({
      message,
      attachments: apiAttachments.length > 0 ? apiAttachments : undefined,
    });
    setMessage('');
    setAttachments([]);
  };

  const startUpload = (attachment: UiAttachment) => {
    if (!onUploadAttachment || !attachment.file) return;

    setAttachments((prev) => {
      const updated = prev.map((a) =>
        a.id === attachment.id ? { ...a, status: RequestStatus.Loading } : a,
      );
      onAttachmentsChange?.(updated);
      return updated;
    });

    onUploadAttachment(attachment.file)
      .then((apiAttachment) => {
        setAttachments((prev) => {
          const updated = prev.map((a) =>
            a.id === attachment.id
              ? { ...a, status: RequestStatus.Idle, apiAttachment }
              : a,
          );
          onAttachmentsChange?.(updated);
          return updated;
        });
      })
      .catch(() => {
        setAttachments((prev) => {
          const updated = prev.map((a) =>
            a.id === attachment.id ? { ...a, status: RequestStatus.Error } : a,
          );
          onAttachmentsChange?.(updated);
          return updated;
        });
      });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const newAttachments: UiAttachment[] = files.map((file) => {
      const isImage = file.type.startsWith('image/');
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        contentType: file.type,
        file,
        type: isImage ? AttachmentType.Image : AttachmentType.File,
        status: onUploadAttachment ? RequestStatus.Loading : RequestStatus.Idle,
        previewUrl,
      };
    });

    // Reset so the same file can be picked again
    e.target.value = '';

    setAttachments((prev) => {
      const updated = [...prev, ...newAttachments];
      onAttachmentsChange?.(updated);
      return updated;
    });

    if (onUploadAttachment) {
      newAttachments.forEach((a) => startUpload(a));
    }
  };

  const handleRemove = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      const updated = prev.filter((a) => a.id !== id);
      onAttachmentsChange?.(updated);
      return updated;
    });
  };

  const handleRetry = (id: string) => {
    const target = attachments.find((a) => a.id === id);
    if (target) startUpload(target);
  };

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        styles.wrapper,
        'flex min-h-[56px] w-full max-w-[748px] flex-col rounded border px-3 py-2',
        className,
      )}
    >
      {attachments.length > 0 && (
        <AttachmentTray
          attachments={attachments}
          onRemove={handleRemove}
          onRetry={handleRetry}
          removeLabel={removeLabel}
          retryLabel={retryLabel}
          className="mb-2"
        />
      )}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={handleFileChange}
        />
        <DialDropdown
          matchReferenceWidth={false}
          placement="bottom-start"
          listClassName="!w-[240px]"
          menu={{
            items: [
              {
                key: 'attach',
                label: attachLabel,
                icon: <IconPaperclip size={BASE_ICON_SIZE} aria-hidden />,
                onClick: () => fileInputRef.current?.click(),
              },
            ],
          }}
        >
          <DialGhostIconButton
            icon={<IconPlus size={BASE_ICON_SIZE} aria-hidden />}
            aria-label={addMenuLabel}
            className="size-10 flex-shrink-0"
          />
        </DialDropdown>
        <textarea
          className={mergeClasses(
            styles.textarea,
            'flex-1 resize-none bg-transparent outline-none',
          )}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            onChange?.(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          rows={1}
        />
        {isStreaming ? (
          <StopButton onStop={onStop} />
        ) : (
          canSend && <SendButton onSend={handleSend} />
        )}
      </div>
    </div>
  );
};
