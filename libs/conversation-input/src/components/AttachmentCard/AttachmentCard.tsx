import {
  AttachmentType,
  RequestStatus,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialEllipsisTooltip,
  DialGhostIconButton,
  DialLoader,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import {
  IconClipboard,
  IconPhoto,
  IconRefresh,
  IconTerminal2,
  IconX,
} from '@tabler/icons-react';
import { type FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AttachmentCardProps } from '../../models/AttachmentCard.js';
import { getAttachmentIcon } from '../../utils/getAttachmentIcon.js';
import styles from './AttachmentCard.module.scss';

export const AttachmentCard: FC<AttachmentCardProps> = ({
  attachment,
  onRemove,
  onRetry,
  selected,
  alwaysShowActions,
  className,
}) => {
  const { t } = useTranslation();
  const { id, name, contentType, type, status, previewUrl } = attachment;

  const {
    isLoading,
    isError,
    isImage,
    actionsVisible,
    BottomIcon,
    bottomLabel,
    cardColorClass,
    removeBtnClass,
  } = useMemo(() => {
    const loading = status === RequestStatus.Loading;
    const error = status === RequestStatus.Error;
    const image = type === AttachmentType.Image && !!previewUrl && !error;

    const FileIcon = getAttachmentIcon(contentType);
    const bottomIcon =
      type === AttachmentType.Prompt
        ? IconTerminal2
        : type === AttachmentType.Pasted
          ? IconClipboard
          : type === AttachmentType.Image
            ? IconPhoto
            : FileIcon;

    const ext = name.includes('.')
      ? `.${name.slice(name.lastIndexOf('.') + 1).toLowerCase()}`
      : contentType.split('/')[1]
        ? `.${contentType.split('/')[1].toLowerCase()}`
        : '';

    const label =
      type === AttachmentType.Prompt
        ? 'Prompt'
        : type === AttachmentType.Pasted
          ? 'Pasted'
          : type === AttachmentType.Image
            ? 'Image'
            : ext || name;

    const colorClass = mergeClasses(
      styles.card,
      error && styles.cardError,
      selected && styles.cardSelected,
      !error &&
        !selected &&
        type === AttachmentType.Prompt &&
        styles.cardPrompt,
      !error &&
        !selected &&
        type === AttachmentType.Pasted &&
        styles.cardPasted,
    );

    const removeBtn = image ? styles.removeBtnImage : styles.actionBtn;

    return {
      isLoading: loading,
      isError: error,
      isImage: image,
      actionsVisible: error || alwaysShowActions,
      BottomIcon: bottomIcon,
      bottomLabel: label,
      cardColorClass: colorClass,
      removeBtnClass: removeBtn,
    };
  }, [
    status,
    type,
    previewUrl,
    contentType,
    name,
    selected,
    alwaysShowActions,
  ]);

  return (
    <div
      className={mergeClasses(
        'group relative flex h-[100px] w-[100px] flex-shrink-0 rounded border',
        cardColorClass,
        !isImage && 'flex-col gap-3 p-3',
        className,
      )}
    >
      {isImage ? (
        <img
          src={previewUrl}
          alt={name}
          className="h-full w-full rounded object-cover"
        />
      ) : (
        <>
          {/* Top group: file name */}
          <div className="flex flex-1 items-start overflow-hidden">
            <span
              className={mergeClasses(
                'dial-tiny-text line-clamp-3 max-w-[76px] break-words',
                styles.name,
              )}
              title={name}
            >
              {name}
            </span>
          </div>

          {/* Bottom group: icon + label */}
          <div className="flex flex-row items-center gap-1 overflow-hidden">
            <BottomIcon
              size={DIAL_ICON_SIZE.SM}
              className={mergeClasses('shrink-0', styles.meta)}
              aria-hidden
            />
            <DialEllipsisTooltip
              text={bottomLabel}
              className={mergeClasses(
                'dial-tiny-text min-w-0 flex-1 truncate',
                styles.meta,
              )}
            />
          </div>
        </>
      )}

      {isLoading && (
        <span
          className={mergeClasses(
            'absolute inset-0 flex items-center justify-center rounded',
            styles.loadingOverlay,
          )}
        >
          <DialLoader
            size={16}
            fullWidth={false}
            iconClassName="text-primary"
            ariaLabel="Loading attachment"
          />
        </span>
      )}

      {!isLoading && (
        <div
          className={mergeClasses(
            'absolute right-1 top-1 flex gap-1 transition-opacity',
            actionsVisible
              ? 'opacity-100'
              : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
          )}
        >
          {isError && onRetry && (
            <DialGhostIconButton
              icon={<IconRefresh size={DIAL_ICON_SIZE.SM} aria-hidden />}
              size={ElementSize.Small}
              className={mergeClasses('h-6 w-6 rounded', styles.actionBtn)}
              aria-label={t('conversationInput.attachment.retry')}
              onClick={() => onRetry(id)}
            />
          )}
          <DialGhostIconButton
            icon={<IconX size={DIAL_ICON_SIZE.SM} aria-hidden />}
            size={ElementSize.Small}
            className={mergeClasses('h-6 w-6 rounded', removeBtnClass)}
            aria-label={t('conversationInput.attachment.remove')}
            onClick={() => onRemove(id)}
          />
        </div>
      )}
    </div>
  );
};
