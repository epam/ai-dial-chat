import {
  AttachmentType,
  buildCssVars,
  type DisplayAttachment,
  mergeClasses,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import {
  IconDownload,
  IconFile,
  IconPaperclip,
  IconPhoto,
} from '@tabler/icons-react';
import { type FC } from 'react';
import { ATTACHMENT_COLLAPSE_THRESHOLD } from '../../constants/attachment-group';
import { type AttachmentGroupProps } from '../../models/attachment-group';
import { AttachmentCard } from '../AttachmentCard/AttachmentCard';
import styles from './AttachmentGroup.module.scss';

const pluralize = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

/** Renders every attachment as a tile: a wrapping flex row below the collapse threshold, a fixed 5-column grid at or above it. */
export const AttachmentGroup: FC<AttachmentGroupProps> = ({
  attachments,
  onAttachmentClick,
  onDownloadAll,
  isAttachmentDownloadable,
  onRetry,
  labels,
  styles: groupStyles,
  selectedAttachmentId,
}) => {
  const {
    ariaLabel = 'Attachments',
    clickLabel = 'Download attachment',
    downloadLabel = 'Download attachment',
    retryLabel = 'Retry upload',
    downloadAllLabel = 'Download all',
    openInNewTabLabel,
    getHeaderLabel = (count: number) => pluralize(count, 'attachment'),
    promptLabel,
    pastedLabel,
    imageLabel,
  } = labels ?? {};
  const { typography, colors, className } = groupStyles ?? {};
  const cssVars = buildCssVars({
    '--ai-group-text': colors?.text,
  });

  if (attachments.length === 0) return null;

  const hasImages = attachments.some((a) => a.type === AttachmentType.Image);
  const hasFiles = attachments.some((a) => a.type !== AttachmentType.Image);
  const isMixed = hasImages && hasFiles;
  const isCollapsible = attachments.length >= ATTACHMENT_COLLAPSE_THRESHOLD;

  const HeaderIcon = isMixed ? IconPaperclip : hasImages ? IconPhoto : IconFile;
  const headerLabel = getHeaderLabel(attachments.length);

  const isDownloadable = (attachment: DisplayAttachment): boolean =>
    isAttachmentDownloadable?.(attachment) !== false;
  /*
   * Skip attachments that individual tiles themselves wouldn't allow
   * downloading (still uploading, failed, or rejected by the host, e.g. a
   * folder) — "download all" must not fire on them just because they are in
   * the list.
   */
  const downloadableAttachments = attachments.filter(
    (attachment) =>
      attachment.status === RequestStatus.Idle && isDownloadable(attachment),
  );

  const handleDownloadAll = () => {
    if (onDownloadAll) {
      onDownloadAll(downloadableAttachments);
    } else {
      downloadableAttachments.forEach((attachment) =>
        onAttachmentClick?.(attachment.id),
      );
    }
  };

  const handleDownload = (id: string) => {
    const downloadableAttachment = attachments.find(
      (attachment) => attachment.id === id,
    );
    if (downloadableAttachment) {
      onDownloadAll?.([downloadableAttachment]);
    }
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={cssVars}
      className={mergeClasses(
        'flex flex-col gap-2',
        isCollapsible ? 'w-full max-w-[532px] min-w-0' : 'max-w-[424px]',
        styles.container,
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <HeaderIcon
            size={DIAL_ICON_SIZE.SM}
            className={mergeClasses('shrink-0', styles.headerIcon)}
            aria-hidden
          />
          <span
            className={mergeClasses(
              typography?.headerLabelClassName ?? 'dial-tiny-semi-text',
              styles.headerLabel,
            )}
          >
            {headerLabel}
          </span>
        </div>
        {attachments.length >= 2 &&
          downloadableAttachments.length > 0 &&
          (onDownloadAll || onAttachmentClick) && (
            <GhostIconButton
              icon={
                <IconDownload
                  size={DIAL_ICON_SIZE.SM}
                  aria-hidden
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              }
              size={ElementSize.Small}
              aria-label={downloadAllLabel}
              onClick={handleDownloadAll}
            />
          )}
      </div>

      <div
        role="list"
        aria-label={headerLabel}
        className={mergeClasses(
          'gap-2',
          isCollapsible ? 'grid grid-cols-[repeat(5,100px)]' : 'flex flex-wrap',
        )}
      >
        {attachments.map((attachment, index) => (
          <div key={`${attachment.id}-${index}`} role="listitem">
            <AttachmentCard
              attachment={attachment}
              onClick={onAttachmentClick}
              onDownload={
                onDownloadAll && isDownloadable(attachment)
                  ? handleDownload
                  : undefined
              }
              onRetry={onRetry}
              labels={{
                clickLabel,
                downloadLabel,
                retryLabel,
                promptLabel,
                pastedLabel,
                imageLabel,
                openInNewTabLabel,
              }}
              isSelected={attachment.id === selectedAttachmentId}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
