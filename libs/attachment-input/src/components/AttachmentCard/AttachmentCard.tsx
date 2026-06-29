import {
  AttachmentErrorReason,
  AttachmentType,
  buildCssVars,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialGhostIconButton,
  DialSkeleton,
  DialSkeletonVariant,
  DialSpinner,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import {
  IconDownload,
  IconPhoto,
  IconReload,
  IconX,
} from '@tabler/icons-react';
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
    isAudio,
    areActionsVisible,
    BottomIcon,
    typeLabel,
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

  if (isAudio) {
    return (
      <div
        style={cssVars}
        className={mergeClasses(
          'group flex w-full min-w-[280px] max-w-[300px] flex-col gap-2 border p-3',
          roundedClassName,
          cardColorClass,
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            title={attachment.name}
            className={mergeClasses(
              typography?.fontClassName ?? 'dial-tiny-text',
              'min-w-0 truncate',
              styles.name,
            )}
          >
            {attachment.name}
          </span>
          {onClick && (
            <DialGhostIconButton
              icon={<IconDownload size={DIAL_ICON_SIZE.SM} aria-hidden />}
              size={ElementSize.Small}
              className={mergeClasses(
                'h-6 w-6 shrink-0 rounded',
                styles.actionBtn,
              )}
              aria-label={clickLabel}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                onClick(id);
              }}
            />
          )}
        </div>
        {attachment.playUrl && (
          <audio
            controls
            src={attachment.playUrl}
            className="w-full"
            preload="metadata"
          />
        )}
      </div>
    );
  }

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
                  className={
                    typography?.placeholderIconClassName ?? 'text-secondary'
                  }
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
      ) : isError ? (
        <>
          {/* Error state: icon + label on top, filename below */}
          <div className="flex flex-row items-center gap-1 overflow-hidden">
            <BottomIcon
              size={DIAL_ICON_SIZE.SM}
              className={mergeClasses('shrink-0', styles.meta)}
              aria-hidden
            />
            <span
              title={typeLabel}
              className={mergeClasses(
                typography?.metaClassName ?? 'dial-tiny-text',
                'min-w-0 truncate',
                styles.meta,
              )}
            >
              {typeLabel}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div
              title={displayName}
              className={mergeClasses(
                typography?.fontClassName ?? 'dial-tiny-text',
                styles.name,
              )}
            >
              {displayName}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Normal state: filename on top, icon + label at bottom */}
          <div className="min-w-0 flex-1">
            <div
              title={displayName}
              className={mergeClasses(
                typography?.fontClassName ?? 'dial-tiny-text',
                styles.name,
              )}
            >
              {displayName}
            </div>
          </div>

          <div className="flex flex-row items-center gap-1 overflow-hidden">
            <BottomIcon
              size={DIAL_ICON_SIZE.SM}
              className={mergeClasses('shrink-0', styles.meta)}
              aria-hidden
            />
            <span
              title={typeLabel}
              className={mergeClasses(
                typography?.metaClassName ?? 'dial-tiny-text',
                'min-w-0 truncate',
                styles.meta,
              )}
            >
              {typeLabel}
            </span>
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
          {isError &&
            onRetry &&
            attachment.errorReason !==
              AttachmentErrorReason.UnsupportedType && (
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
