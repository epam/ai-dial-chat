import {
  AttachmentType,
  DisplayAttachment,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  Skeleton,
  SkeletonVariant,
} from '@epam/ai-dial-ui-kit';
import { IconPhoto } from '@tabler/icons-react';
import { CSSProperties, type FC, type KeyboardEvent, useMemo } from 'react';
import { ATTACHMENT_TILE_BASE_CLASS } from '../../../constants/attachment-group';
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
  const { clickLabel = 'Open attachment', expandLabel = 'Expand pasted text' } =
    labels ?? {};
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
    ATTACHMENT_TILE_BASE_CLASS,
    'group/attachment-tile',
    isClickable && 'cursor-pointer',
    styles.tile,
    isSelected && styles.selected,
    className,
  );

  return (
    <div
      className={cardClassName}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      style={cssVars}
      aria-label={
        isClickable ? clickLabel : isExpandable ? expandLabel : undefined
      }
    >
      <div className="relative h-full w-full overflow-hidden">
        {onRemove && (
          <RemoveAction
            onClick={onRemove}
            id={id}
            className={styles.imageActionButton}
          />
        )}
        {onDownload && (
          <DownloadAction
            onClick={onDownload}
            id={id}
            className={styles.imageActionButton}
          />
        )}
        {imageLoadStatus !== LazyImageLoadStatus.Loaded && (
          <Skeleton
            variant={SkeletonVariant.Rectangular}
            width="100%"
            height="100%"
            active={imageLoadStatus === LazyImageLoadStatus.Loading}
            overlay={
              <IconPhoto
                size={DIAL_ICON_SIZE.LG}
                className={styles.typeText}
                aria-hidden
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
      </div>
    </div>
  );
};
