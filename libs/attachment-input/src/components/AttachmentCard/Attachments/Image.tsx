import {
  AttachmentType,
  DisplayAttachment,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Skeleton,
  SkeletonVariant,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconPhoto } from '@tabler/icons-react';
import {
  CSSProperties,
  type FC,
  type HTMLAttributes,
  type KeyboardEvent,
  useMemo,
} from 'react';
import {
  ATTACHMENT_TILE_BASE_CLASS,
  ATTACHMENT_TILE_FOCUS_RING_CLASS,
} from '../../../constants/attachment-group';
import { ATTACHMENT_INPUT_CLASS } from '../../../constants/public-class-names';
import {
  LazyImageLoadStatus,
  useLazyImageLoad,
} from '../../../hooks/useLazyImageLoad';
import type {
  AttachmentCardLabels,
  AttachmentCardStyles,
} from '../../../models/attachment-card';
import { getAttachmentCardState } from '../../../utils/attachment';
import { DownloadAction, RemoveAction } from './Actions';
import styles from './Attachment.module.scss';

interface ImageAttachmentProps {
  attachment: DisplayAttachment;
  onExpand?: (attachmentId: string) => void;
  onClick?: (attachmentId: string) => void;
  onRemove?: (attachmentId: string) => void;
  labels?: AttachmentCardLabels;
  styles?: AttachmentCardStyles;
  cssVars?: CSSProperties;
  onDownload?: (id: string) => void;
  /** Whether this attachment is the one currently open in the canvas panel. Renders the tile's selected visual state. */
  isSelected?: boolean;
}

/** Square tile for a single image attachment inside the composer tray. */
export const ImageAttachment: FC<ImageAttachmentProps> = ({
  attachment,
  onExpand,
  onClick,
  labels,
  onRemove,
  cssVars,
  onDownload,
  styles: cardStyles,
  isSelected,
}) => {
  const {
    clickLabel = 'Open attachment',
    expandLabel = 'Expand pasted text',
    removeLabel = 'Remove attachment',
    downloadLabel = 'Download attachment',
    uploadingLabel = 'Uploading',
  } = labels ?? {};
  const { className } = cardStyles ?? {};
  const { id, name } = attachment;
  const imageSrc = attachment.previewUrl ?? attachment.url;
  const isPasted = attachment.type === AttachmentType.Pasted;
  const isExpandable = isPasted && onExpand !== undefined;

  const { isLoading, isError, isImage } = useMemo(
    () => getAttachmentCardState(attachment),
    [attachment],
  );

  const isClickable =
    onClick !== undefined && !isExpandable && !isLoading && !isError;
  /*
   * The tile is a button only when activating it does something; otherwise it
   * is a plain element so it adds no unnamed, no-op Tab stop.
   */
  const hasAction = isExpandable || isClickable;
  const canDownload = !!onDownload && !isLoading;
  /* See FileAttachment: the tile ring stands for a lone action's focus. */
  const isProxyFocus =
    !hasAction && Number(!!onRemove) + Number(canDownload) === 1;

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
    /*
     * Only the tile itself activates on Enter/Space — see FileAttachment for
     * why the corner action buttons must not have their activation cancelled
     * by the preventDefault() below.
     */
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  };

  /*
   * Role, Tab stop, name and handlers travel together, so the tile is either a
   * complete button or a plain element — never a focusable no-op.
   */
  const interactiveProps: HTMLAttributes<HTMLDivElement> = hasAction
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-label': isExpandable ? expandLabel : clickLabel,
        onClick: handleCardClick,
        onKeyDown: handleKeyDown,
      }
    : {};

  const cardClassName = mergeClasses(
    ATTACHMENT_TILE_BASE_CLASS,
    'group/attachment-tile',
    hasAction && 'cursor-pointer',
    styles.tile,
    isSelected && styles.selected,
    isLoading && styles.loading,
    isProxyFocus && styles.proxyFocus,
    ATTACHMENT_TILE_FOCUS_RING_CLASS,
    className,
    ATTACHMENT_INPUT_CLASS.tile,
    isSelected && ATTACHMENT_INPUT_CLASS.tileSelected,
  );

  return (
    <div
      className={cardClassName}
      {...interactiveProps}
      aria-busy={isLoading}
      style={cssVars}
    >
      <div className="relative h-full w-full overflow-hidden">
        <div className="absolute end-1 top-1 z-10 flex">
          {onRemove && (
            <RemoveAction
              ariaLabel={removeLabel}
              onClick={onRemove}
              id={id}
              className={styles.imageActionButton}
              isAlwaysVisible={isLoading}
            />
          )}
          {canDownload && (
            <DownloadAction
              ariaLabel={downloadLabel}
              onClick={onDownload}
              id={id}
              className={styles.imageActionButton}
            />
          )}
        </div>
        {imageLoadStatus !== LazyImageLoadStatus.Loaded && (
          <Skeleton
            variant={SkeletonVariant.Rectangular}
            width="100%"
            height="100%"
            active={imageLoadStatus === LazyImageLoadStatus.Loading}
            overlay={
              <IconPhoto
                size={DIAL_ICON_SIZE.LG}
                className={styles.placeholderIcon}
                aria-hidden
                stroke={DIAL_KIT_ICON_STROKE}
              />
            }
            className="absolute inset-0 rounded-xl"
          />
        )}
        <img
          ref={imageRef}
          src={imageSrc}
          alt={name}
          loading="lazy"
          decoding="async"
          className={mergeClasses(
            'h-full w-full rounded-xl object-cover transition-opacity duration-200',
            imageLoadStatus === LazyImageLoadStatus.Loaded
              ? 'opacity-100'
              : 'opacity-0',
          )}
        />
        {isLoading && (
          /* Same indeterminate progressbar as FileAttachment's upload overlay. */
          <div
            role="progressbar"
            aria-label={uploadingLabel}
            className={mergeClasses(
              'absolute inset-0 flex items-center justify-center rounded-xl',
              styles.track,
            )}
          >
            <Spinner size={32} />
          </div>
        )}
      </div>
    </div>
  );
};
