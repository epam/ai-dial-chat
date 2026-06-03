import {
  buildCssVars,
  AttachmentType,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialEllipsisTooltip,
  DialGhostIconButton,
  DialLoader,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconRefresh, IconX } from '@tabler/icons-react';
import { type FC, type KeyboardEvent, type MouseEvent, useMemo } from 'react';
import type { AttachmentCardProps } from '../../models/AttachmentCard.js';
import { getAttachmentCardState } from '../../utils/getAttachmentCardState.js';
import { getNameWithoutExtension } from '../../utils/getNameWithoutExtension.js';
import styles from './AttachmentCard.module.scss';

export const AttachmentCard: FC<AttachmentCardProps> = ({
  attachment,
  onRemove,
  onRetry,
  onExpand,
  isSelected,
  shouldAlwaysShowActions,
  removeLabel = 'Remove attachment',
  retryLabel = 'Retry upload',
  colors,
  typography,
  roundedClassName = 'rounded',
  className,
}) => {
  const { id, name } = attachment;
  const isPasted = attachment.type === AttachmentType.Pasted;
  const isExpandable = isPasted && onExpand !== undefined;

  const displayName = useMemo(() => {
    return isPasted ? name : getNameWithoutExtension(name);
  }, [isPasted, name]);

  const cssVars = buildCssVars({
    '--ci-card-border': colors?.border,
    '--ci-card-bg': colors?.background,
    '--ci-card-name': colors?.nameText,
    '--ci-card-meta': colors?.metaText,
  });

  const {
    isLoading,
    isError,
    isImage,
    areActionsVisible,
    BottomIcon,
    bottomLabel,
    cardColorClass,
    removeBtnClass,
  } = useMemo(
    () =>
      getAttachmentCardState(
        attachment,
        isSelected ?? false,
        shouldAlwaysShowActions ?? false,
      ),
    [attachment, isSelected, shouldAlwaysShowActions],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isExpandable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onExpand(id);
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      style={cssVars}
      className={mergeClasses(
        'group relative flex h-[100px] w-[100px] flex-shrink-0 border focus-within:outline focus-within:outline-1 focus-within:outline-offset-1',
        roundedClassName,
        cardColorClass,
        !isImage && 'flex-col gap-3 p-3',
        isExpandable && 'cursor-pointer',
        className,
      )}
      onClick={isExpandable ? () => onExpand(id) : undefined}
      onKeyDown={isExpandable ? handleKeyDown : undefined}
      tabIndex={isExpandable ? 0 : undefined}
      role={isExpandable ? 'button' : undefined}
    >
      {isImage ? (
        <img
          src={attachment.previewUrl}
          alt={name}
          className={mergeClasses(
            'h-full w-full object-cover',
            roundedClassName,
          )}
        />
      ) : (
        <>
          {/* Top group: file name */}
          <div className="flex flex-1 items-start overflow-hidden">
            <span
              className={mergeClasses(
                typography?.fontClassName ?? 'dial-tiny-text',
                'line-clamp-3 max-w-[76px] break-words',
                styles.name,
              )}
            >
              {displayName}
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
                typography?.metaClassName ?? 'dial-tiny-text',
                styles.meta,
              )}
            />
          </div>
        </>
      )}

      {isLoading && (
        <span
          className={mergeClasses(
            'absolute inset-0 flex items-center justify-center',
            roundedClassName,
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
            areActionsVisible
              ? 'opacity-100'
              : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 mobile:opacity-100',
          )}
        >
          {isError && onRetry && (
            <DialGhostIconButton
              icon={<IconRefresh size={DIAL_ICON_SIZE.SM} aria-hidden />}
              size={ElementSize.Small}
              className={mergeClasses(
                'h-6 w-6 rounded bg-transparent',
                styles.actionBtn,
              )}
              aria-label={retryLabel}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                onRetry(id);
              }}
            />
          )}
          {onRemove && (
            <DialGhostIconButton
              icon={<IconX size={DIAL_ICON_SIZE.SM} aria-hidden />}
              size={ElementSize.Small}
              className={mergeClasses('h-6 w-6 rounded', removeBtnClass)}
              aria-label={removeLabel}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                onRemove?.(id);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};
