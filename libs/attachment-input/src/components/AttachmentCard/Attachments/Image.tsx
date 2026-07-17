import {
  AttachmentType,
  DisplayAttachment,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialSkeleton,
  DialSkeletonVariant,
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
import styles from './Attachment.module.scss';

interface ImageAttachmentProps {
  attachment: DisplayAttachment;
  onExpand?: (attachmentId: string) => void;
  onClick?: (attachmentId: string) => void;
  labels?: AttachmentCardLabels;
  styles?: AttachmentCardStyles;
  cssVars?: CSSProperties;
}

/** Square tile for a single image attachment inside the composer tray. */
export const ImageAttachment: FC<ImageAttachmentProps> = ({
  attachment,
  onExpand,
  onClick,
  labels,
  cssVars,
  styles: cardStyles,
}) => {
  const { clickLabel = 'Open attachment', expandLabel = 'Expand pasted text' } =
    labels ?? {};
  const { typography, className } = cardStyles ?? {};
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
    isClickable && 'cursor-pointer',
    styles.tile,
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
