import {
  AttachmentType,
  buildCssVars,
  mergeClasses,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialGhostIconButton,
  ElementSize,
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
  onRetry,
  labels,
  styles: groupStyles,
  selectedAttachmentId,
}) => {
  const {
    ariaLabel = 'Attachments',
    clickLabel = 'Download attachment',
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

  const handleDownloadAll = () => {
    /*
     * Skip attachments that individual tiles themselves wouldn't allow
     * downloading (still uploading, or failed) — "download all" must not
     * fire on a broken/incomplete attachment just because it's in the list.
     */
    const downloadableAttachments = attachments.filter(
      (attachment) => attachment.status === RequestStatus.Idle,
    );

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
        'flex flex-col gap-1',
        isCollapsible ? 'w-full min-w-0 max-w-[492px]' : 'max-w-[420px]',
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
        {attachments.length >= 2 && (onDownloadAll || onAttachmentClick) && (
          <DialGhostIconButton
            icon={<IconDownload size={DIAL_ICON_SIZE.SM} aria-hidden />}
            className={styles.downloadAllButton}
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
          'gap-3',
          isCollapsible ? 'grid grid-cols-[repeat(5,83px)]' : 'flex flex-wrap',
        )}
      >
        {attachments.map((attachment, index) => (
          <div key={`${attachment.id}-${index}`} role="listitem">
            <AttachmentCard
              attachment={attachment}
              onClick={onAttachmentClick}
              onDownload={handleDownload}
              onRetry={onRetry}
              labels={{
                clickLabel,
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
