import {
  AttachmentErrorReason,
  AttachmentType,
  buildCssVars,
  Highlight,
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
import type { AttachmentCardProps } from '../../models/attachment-card';
import {
  getAttachmentCardState,
  getNameWithoutExtension,
} from '../../utils/attachment';
import styles from './AttachmentCard.module.scss';

/** Square tile for a single attachment (image, audio, file, or pasted-text card) inside the composer tray. */
export const AttachmentCard: FC<AttachmentCardProps> = ({
  attachment,
  searchQuery = '',
  onRemove,
  onRetry,
  onExpand,
  onClick,
  isSelected,
  shouldAlwaysShowActions,
  labels,
  styles: cardStyles,
  showHoverDownloadIcon = false,
}) => {
  const {
    removeLabel = 'Remove attachment',
    retryLabel = 'Retry upload',
    clickLabel = 'Open attachment',
    expandLabel = 'Expand pasted text',
    loadingLabel = 'Loading attachment',
    uploadFailedStatusLabel = 'Upload failed',
  } = labels ?? {};
  const {
    colors,
    typography,
    roundedClassName = 'rounded-xl',
    className,
  } = cardStyles ?? {};
  const { id, name } = attachment;
  const imageSrc = attachment.previewUrl ?? attachment.url;
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
    '--ci-card-border-error': colors?.borderError,
    '--ci-card-bg-selected': colors?.backgroundSelected,
    '--ci-card-border-selected': colors?.borderSelected,
    '--ci-card-bg-hover': colors?.backgroundHover,
    '--ci-loading-overlay-bg': colors?.loadingOverlayBackground,
    '--ci-card-action-color': colors?.actionColor,
    '--ci-card-remove-bg-hover': colors?.actionBackgroundHover,
    '--ci-card-focus-outline': colors?.focusOutline,
    '--ci-card-remove-bg': colors?.removeBackground,
    '--ci-card-remove-color': colors?.removeColor,
    '--ci-card-hover-icon-bg': colors?.hoverIconBackground,
    '--ci-card-hover-icon-color': colors?.hoverIconColor,
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
        labels,
      ),
    [attachment, isSelected, shouldAlwaysShowActions, labels],
  );

  /*
   * Not downloadable while still uploading or after a failed upload —
   * matches AttachmentFileRow's `canDownload` gating so a broken/incomplete
   * attachment never looks or behaves clickable (no false download attempt).
   */
  const isClickable =
    onClick !== undefined && !isExpandable && !isLoading && !isError;
  const isInteractive = isExpandable || isClickable;

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
            {searchQuery ? (
              <Highlight
                text={attachment.name}
                query={searchQuery}
                maxLines={1}
              />
            ) : (
              attachment.name
            )}
          </span>
          {onClick && (
            <DialGhostIconButton
              icon={<IconDownload size={DIAL_ICON_SIZE.SM} aria-hidden />}
              size={ElementSize.Small}
              className={mergeClasses(
                'h-6 w-6 shrink-0 rounded',
                removeBtnClass,
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
            aria-label={attachment.name}
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
                'line-clamp-3 break-words',
                styles.name,
              )}
            >
              {searchQuery ? (
                <Highlight
                  text={displayName}
                  query={searchQuery}
                  maxLines={3}
                />
              ) : (
                displayName
              )}
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
                'line-clamp-3 break-words',
                styles.name,
              )}
            >
              {searchQuery ? (
                <Highlight
                  text={displayName}
                  query={searchQuery}
                  maxLines={3}
                />
              ) : (
                displayName
              )}
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
          <DialSpinner size={40} ariaLabel={loadingLabel} className="z-50" />
        </span>
      )}

      <span role="status" aria-live="polite" className="sr-only">
        {isError ? uploadFailedStatusLabel : ''}
      </span>

      {!isLoading && (
        <div
          className={mergeClasses(
            'absolute end-1 top-1 flex gap-1 transition-opacity',
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
          {showHoverDownloadIcon && !onRemove && !isError && (
            <IconDownload
              size={DIAL_ICON_SIZE.SM}
              aria-hidden
              className={mergeClasses(
                'h-6 w-6 rounded-lg p-1',
                styles.hoverDownloadIcon,
              )}
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
        aria-label={
          isClickable ? clickLabel : isExpandable ? expandLabel : undefined
        }
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
