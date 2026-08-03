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
  isSelected,
}) => {
  const { colors } = cardStyles ?? {};
  const isPasted = attachment.type === AttachmentType.Pasted;
  const isExpandable = isPasted && onExpand !== undefined;

  const cssVars = buildCssVars({
    '--ai-tile-bg': colors?.background,
    '--ai-tile-border': colors?.border,
    '--ai-tile-bg-hover': colors?.backgroundHover,
    '--ai-tile-border-hover': colors?.borderHover,
    '--ai-tile-bg-selected': colors?.backgroundSelected,
    '--ai-tile-border-selected': colors?.borderSelected,
    '--ai-tile-focus-outline': colors?.focusOutline,
    '--ai-tile-bg-error': colors?.backgroundError,
    '--ai-tile-border-error': colors?.borderError,
    '--ai-tile-error-text': colors?.errorText,
    '--ai-tile-name-text': colors?.nameText,
    '--ai-tile-type-text': colors?.typeText,
    '--ai-tile-hover-icon-bg': colors?.hoverIconBackground,
    '--ai-tile-hover-icon-color': colors?.hoverIconColor,
    '--ai-tile-progress-track': colors?.trackBackground,
    '--ai-tile-fill-bg': colors?.fillBackground,
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
        isSelected={isSelected}
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
        isSelected={isSelected}
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
      isSelected={isSelected}
    />
  );
};
