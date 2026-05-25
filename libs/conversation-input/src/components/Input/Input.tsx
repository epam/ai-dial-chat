import type { Attachment } from '@epam/ai-dial-chat-shared';
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
import classNames from 'classnames';
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      attachments.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
    };
  }, []);

  const canSend = message.trim().length > 0;

  const handleSend = () => {
    onSend?.(message, attachments);
    setMessage('');
    attachments.forEach((a) => {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
    });
    setAttachments([]);
    onAttachmentsChange?.([]);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && canSend) {
        handleSend();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const newAttachments: Attachment[] = files.map((file) => {
      const isImage = file.type.startsWith('image/');
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        contentType: file.type,
        file,
        type: isImage ? AttachmentType.Image : AttachmentType.File,
        status: RequestStatus.Idle,
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

  const textarea = (
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
  );
  return (
    <div
      style={cssVars}
      className={mergeClasses(
        styles.wrapper,
        'flex min-h-[56px] w-full max-w-[748px] flex-col justify-center gap-3 rounded border px-3 py-2',
        className,
      )}
    >
      {attachments.length > 0 && (
        <>
          <AttachmentTray
            attachments={attachments}
            onRemove={handleRemove}
            removeLabel={removeLabel}
            retryLabel={retryLabel}
          />
          {textarea}
        </>
      )}

      <div
        className={classNames(
          'flex items-center gap-2',
          attachments.length > 0 && 'justify-between',
        )}
      >
        <div className="flex">
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
        </div>
        {attachments.length === 0 && textarea}
        {isStreaming ? (
          <StopButton onStop={onStop} />
        ) : (
          canSend && <SendButton onSend={handleSend} />
        )}
      </div>
    </div>
  );
};
