import {
  AttachmentType,
  mergeClasses,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import {
  IconChevronUp,
  IconDownload,
  IconFile,
  IconPaperclip,
  IconPhoto,
} from '@tabler/icons-react';
import { type FC, useMemo, useState } from 'react';
import type { AttachmentGroupProps } from '../../models/AttachmentGroup';
import {
  ATTACHMENT_COLLAPSE_THRESHOLD,
  AttachmentTilesLayout,
  getAttachmentTilesPlan,
} from '../../utils/getAttachmentGroupLayout';
import { AttachmentCard } from '../AttachmentCard/AttachmentCard';
import { AttachmentFileRow } from '../AttachmentFileRow/AttachmentFileRow';
import { AttachmentMoreTile } from '../AttachmentMoreTile/AttachmentMoreTile';
import styles from './AttachmentGroup.module.scss';

const pluralize = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * Adaptive attachment group for an already-sent message: every attachment —
 * image or file — renders as one uniform 84x84 rounded-square tile, wrapped
 * in a single grid. 5+ attachments collapse behind a "+N" tile; expanding
 * reveals a same-shaped collapse tile to show less again. Type is
 * communicated by glyph + extension text only; color is reserved for
 * upload state. Download actions are icon-only, matching the rest of the app.
 */
export const AttachmentGroup: FC<AttachmentGroupProps> = ({
  attachments,
  onAttachmentClick,
  onRetry,
  getSizeLabel,
  ariaLabel = 'Attachments',
  clickLabel = 'Download attachment',
  retryLabel = 'Retry upload',
  showLessLabel = 'Show less',
  downloadAllLabel = 'Download all',
  theme,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const plan = useMemo(
    () => getAttachmentTilesPlan(attachments.length, isExpanded),
    [attachments.length, isExpanded],
  );

  if (attachments.length === 0) return null;

  const hasImages = attachments.some((a) => a.type === AttachmentType.Image);
  const hasFiles = attachments.some((a) => a.type !== AttachmentType.Image);
  const isMixed = hasImages && hasFiles;
  const isCollapsible = attachments.length >= ATTACHMENT_COLLAPSE_THRESHOLD;

  const HeaderIcon = isMixed ? IconPaperclip : hasImages ? IconPhoto : IconFile;
  const headerLabel = pluralize(attachments.length, 'attachment');

  const visibleAttachments = attachments.slice(0, plan.visibleCount);

  const handleDownloadAll = () => {
    // Skip attachments that individual tiles themselves wouldn't allow
    // downloading (still uploading, or failed) — "download all" must not
    // fire on a broken/incomplete attachment just because it's in the list.
    attachments
      .filter((attachment) => attachment.status === RequestStatus.Idle)
      .forEach((attachment) => onAttachmentClick?.(attachment));
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={mergeClasses(
        'rounded-2xl border p-3',
        isCollapsible ? 'w-full min-w-0 max-w-[492px]' : 'max-w-[420px]',
        styles.container,
        className,
      )}
    >
      <div className="mb-3 flex min-h-6 items-center gap-2">
        <HeaderIcon
          size={DIAL_ICON_SIZE.SM}
          className={mergeClasses('shrink-0', styles.headerIcon)}
          aria-hidden
        />
        <span
          className={mergeClasses('dial-tiny-semi-text', styles.headerLabel)}
        >
          {headerLabel}
        </span>
        {attachments.length >= 2 && onAttachmentClick && (
          <DialGhostIconButton
            icon={<IconDownload size={DIAL_ICON_SIZE.SM} aria-hidden />}
            className={mergeClasses(
              'ms-auto h-6 w-6 rounded-lg',
              styles.downloadAllButton,
            )}
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
          isCollapsible
            ? 'grid grid-cols-[repeat(5,84px)] overflow-x-auto'
            : 'flex flex-wrap',
        )}
      >
        {visibleAttachments.map((attachment) => (
          <div key={attachment.id} role="listitem">
            {attachment.type === AttachmentType.Image ? (
              <AttachmentCard
                attachment={attachment}
                onClick={
                  onAttachmentClick
                    ? () => onAttachmentClick(attachment)
                    : undefined
                }
                onRetry={onRetry}
                clickLabel={clickLabel}
                retryLabel={retryLabel}
                roundedClassName="rounded-xl"
                showHoverDownloadIcon
                className={mergeClasses('size-[84px]', styles.imageTile)}
              />
            ) : (
              <AttachmentFileRow
                attachment={attachment}
                sizeLabel={getSizeLabel?.(attachment)}
                onClick={onAttachmentClick}
                onRetry={onRetry}
                clickLabel={clickLabel}
                retryLabel={retryLabel}
                theme={theme}
              />
            )}
          </div>
        ))}

        {plan.layout === AttachmentTilesLayout.Collapsed && (
          <div role="listitem">
            <AttachmentMoreTile
              count={plan.hiddenCount}
              onClick={() => setIsExpanded(true)}
            />
          </div>
        )}

        {isCollapsible && isExpanded && (
          <div role="listitem">
            <AttachmentMoreTile
              count={0}
              onClick={() => setIsExpanded(false)}
              ariaLabel={showLessLabel}
            >
              <IconChevronUp size={DIAL_ICON_SIZE.MD} aria-hidden />
            </AttachmentMoreTile>
          </div>
        )}
      </div>
    </div>
  );
};
