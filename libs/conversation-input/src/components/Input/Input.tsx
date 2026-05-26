import type { Attachment } from '@epam/ai-dial-chat-shared';
import {
  AttachmentType,
  RequestStatus,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  BASE_ICON_SIZE,
  DIAL_ICON_SIZE,
  DialDropdown,
  DialDropdownIcon,
  DialGhostIconButton,
} from '@epam/ai-dial-ui-kit';
import {
  IconApps,
  IconPaperclip,
  IconPlus,
  IconRobot,
} from '@tabler/icons-react';
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
import { resolveIconUrl } from '../../utils/resolveIconUrl.js';
import { AttachmentTray } from '../AttachmentTray/AttachmentTray.js';
import styles from './Input.module.scss';
import { SendButton } from './SendButton.js';
import { StopButton } from './StopButton.js';

export const Input: FC<InputProps> = ({
  message: messageProp = '',
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
  deployments,
  selectedDeploymentId,
  onDeploymentChange,
  modelSelectorLabels,
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

  const [message, setMessage] = useState(messageProp);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

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

  const canSend = message.trim().length > 0;
  const hasModelSelected =
    deployments === undefined || selectedDeploymentId != null;

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
      if (!isStreaming && canSend && hasModelSelected) {
        handleSend();
      }
    }
  };

  const selectedItem = deployments?.find((i) => i.id === selectedDeploymentId);
  const selectedIconUrl = resolveIconUrl(selectedItem?.iconUrl);
  const selectorIcon = selectedIconUrl ? (
    <img src={selectedIconUrl} alt="" width={18} height={18} />
  ) : (
    <IconRobot size={18} aria-hidden />
  );
  const selectedLabel = selectedItem?.displayName ?? selectedItem?.id;
  const selectorAriaLabel = selectedLabel
    ? `${modelSelectorLabels?.ariaLabel ?? 'Select model'}: ${selectedLabel}`
    : (modelSelectorLabels?.ariaLabel ?? 'Select model');

  const buildSelectorMenuItems = () => {
    if (!deployments || deployments.length === 0) {
      const stateLabel =
        modelSelectorLabels?.loading ??
        modelSelectorLabels?.error ??
        modelSelectorLabels?.empty;
      if (stateLabel) {
        return [{ key: '__state', label: stateLabel, disabled: true }];
      }
      return [];
    }
    return deployments.map((item) => {
      const itemIconUrl = resolveIconUrl(item.iconUrl);
      const icon = itemIconUrl ? (
        <img
          src={itemIconUrl}
          alt=""
          width={DIAL_ICON_SIZE.SM}
          height={DIAL_ICON_SIZE.SM}
        />
      ) : item.type === 'application' ? (
        <IconApps size={DIAL_ICON_SIZE.SM} aria-hidden />
      ) : (
        <IconRobot size={DIAL_ICON_SIZE.SM} aria-hidden />
      );
      return {
        key: item.id,
        label: item.displayName ?? item.id,
        icon,
        onClick: () => onDeploymentChange?.(item.id),
      };
    });
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
        <div className="flex flex-shrink-0 items-center gap-2">
          {deployments !== undefined && (
            <DialDropdownIcon
              icon={selectorIcon}
              ariaLabel={selectorAriaLabel}
              menu={{ items: buildSelectorMenuItems() }}
              buttonClassName={
                isStreaming ? 'pointer-events-none opacity-50' : undefined
              }
            />
          )}
          {isStreaming ? (
            <StopButton onStop={onStop} />
          ) : (
            canSend && (
              <SendButton onSend={handleSend} disabled={!hasModelSelected} />
            )
          )}
        </div>
      </div>
    </div>
  );
};
