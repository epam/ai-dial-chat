import { AttachmentType, buildCssVars } from '@epam/ai-dial-chat-shared';
import { type FC, useMemo } from 'react';
import type { AttachmentCardProps } from '../../models/attachment-card';
import { getAttachmentCardState } from '../../utils/attachment';
import { AudioAttachment } from './Attachments/Audio';
import { FileAttachment } from './Attachments/File';
import { ImageAttachment } from './Attachments/Image';

/** Square tile for a single attachment (image, audio, file, or pasted-text card) inside the composer tray. */
export const AttachmentCard: FC<AttachmentCardProps> = ({
  attachment,
  searchQuery = '',
  onRemove,
  onRetry,
  onExpand,
  onClick,
  onDownload,
  labels,
  styles: cardStyles,
}) => {
  const { colors } = cardStyles ?? {};
  const isPasted = attachment.type === AttachmentType.Pasted;
  const isExpandable = isPasted && onExpand !== undefined;

  const cssVars = buildCssVars({
    '--ci-tile-bg': colors?.background,
    '--ci-tile-border': colors?.border,
    '--ci-tile-border-hover': colors?.borderHover,
    '--ci-tile-focus-outline': colors?.focusOutline,
    '--ci-tile-bg-error': colors?.backgroundError,
    '--ci-tile-border-error': colors?.borderError,
    '--ci-tile-error-text': colors?.errorText,
    '--ci-tile-name-text': colors?.nameText,
    '--ci-tile-type-text': colors?.typeText,
    '--ci-tile-hover-icon-bg': colors?.hoverIconBackground,
    '--ci-tile-hover-icon-color': colors?.hoverIconColor,
    '--ci-tile-track-bg': colors?.trackBackground,
    '--ci-tile-fill-bg': colors?.fillBackground,
  });

  const { isImage, isAudio, isLink } = useMemo(
    () => getAttachmentCardState(attachment),
    [attachment],
  );

  if (isAudio) {
    return (
      <AudioAttachment
        attachment={attachment}
        labels={labels}
        onClick={onClick}
        onDownload={onDownload}
        onRemove={onRemove}
        searchQuery={searchQuery}
        styles={cardStyles}
        cssVars={cssVars}
      />
    );
  }

  if (isImage) {
    return (
      <ImageAttachment
        attachment={attachment}
        labels={labels}
        onClick={onClick}
        onExpand={onExpand}
        styles={cardStyles}
        onRemove={onRemove}
        cssVars={cssVars}
        onDownload={onDownload}
      />
    );
  }

  return (
    <FileAttachment
      attachment={attachment}
      onClick={onClick}
      onRetry={onRetry}
      onRemove={onRemove}
      onDownload={onDownload}
      isLink={isLink}
      isPasted={isPasted}
      styles={cardStyles}
      labels={labels}
      onExpand={onExpand}
      cssVars={cssVars}
      isExpandable={isExpandable}
    />
  );
};
