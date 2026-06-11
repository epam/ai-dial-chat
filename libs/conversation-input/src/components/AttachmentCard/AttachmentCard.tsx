import {
  AttachmentType,
  buildCssVars,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialEllipsisTooltip,
  DialGhostIconButton,
  DialSkeleton,
  DialSkeletonVariant,
  DialSpinner,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconPhoto, IconReload, IconX } from '@tabler/icons-react';
import { type FC, type KeyboardEvent, type MouseEvent, useMemo } from 'react';
import {
  LazyImageLoadStatus,
  useLazyImageLoad,
} from '../../hooks/useLazyImageLoad';
import type { AttachmentCardProps } from '../../models/AttachmentCard';
import { getAttachmentCardState } from '../../utils/getAttachmentCardState';
import { getNameWithoutExtension } from '../../utils/getNameWithoutExtension';
import styles from './AttachmentCard.module.scss';

export const AttachmentCard: FC<AttachmentCardProps> = ({
  attachment,
  onRemove,
  onRetry,
  onExpand,
  onClick,
  isSelected,
  shouldAlwaysShowActions,
  removeLabel = 'Remove attachment',
  retryLabel = 'Retry upload',
  clickLabel = 'Open attachment',
  colors,
  typography,
  roundedClassName = 'rounded',
  className,
}) => {
  const { id, name } = attachment;
  const imageSrc = attachment.previewUrl ?? attachment.url;
  const isPasted = attachment.type === AttachmentType.Pasted;
  const isExpandable = isPasted && onExpand !== undefined;
  const isClickable = onClick !== undefined && !isExpandable;
  const isInteractive = isExpandable || isClickable;

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

  const { imageRef, imageLoadStatus } = useLazyImageLoad({
    enabled: isImage,
    src: imageSrc,
  });

  const handleCardClick = (): void => {
    if (isExpandable && onExpand) {
      onExpand(id);
    } else if (isClickable && onClick) {
      onClick(id);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  };

  const cardClassName = mergeClasses(
    'group relative flex h-[100px] w-[100px] flex-shrink-0 border focus-within:outline focus-within:outline-1 focus-within:outline-offset-1',
    roundedClassName,
    cardColorClass,
    !isImage && 'flex-col gap-3 p-3',
    isInteractive && 'cursor-pointer',
    className,
  );

  const cardContent = (
    <>
      {isImage ? (
        <div className="relative h-full w-full overflow-hidden">
          {imageLoadStatus !== LazyImageLoadStatus.Loaded && (
            <DialSkeleton
              variant={DialSkeletonVariant.Rectangular}
              width="100%"
              height="100%"
              active={imageLoadStatus === LazyImageLoadStatus.Loading}
              overlay={
                <IconPhoto
                  size={DIAL_ICON_SIZE.LG}
                  className="text-secondary"
                  aria-hidden
                />
              }
              className={mergeClasses('absolute inset-0', roundedClassName)}
            />
          )}
          <img
            ref={imageRef}
            src={imageSrc}
            alt={name}
            loading="lazy"
            decoding="async"
            className={mergeClasses(
              'h-full w-full object-cover transition-opacity duration-200',
              imageLoadStatus === LazyImageLoadStatus.Loaded
                ? 'opacity-100'
                : 'opacity-0',
              roundedClassName,
            )}
          />
        </div>
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
          <DialSpinner
            size={40}
            ariaLabel="Loading attachment"
            className="z-50"
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
              icon={<IconReload size={DIAL_ICON_SIZE.SM} aria-hidden />}
              size={ElementSize.Small}
              className={mergeClasses('h-6 w-6 rounded', removeBtnClass)}
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
    </>
  );

  if (isInteractive) {
    return (
      <div
        style={cssVars}
        className={cardClassName}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={isClickable ? clickLabel : undefined}
      >
        {cardContent}
      </div>
    );
  }

  return (
    <div style={cssVars} className={cardClassName}>
      {cardContent}
    </div>
  );
};
