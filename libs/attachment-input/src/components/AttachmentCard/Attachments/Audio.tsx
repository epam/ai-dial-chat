import {
  DisplayAttachment,
  Highlight,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { CSSProperties, type FC, type KeyboardEvent } from 'react';
import {
  AttachmentCardLabels,
  AttachmentCardStyles,
} from '../../../models/attachment-card';
import { DownloadAction, RemoveAction } from './Actions';
import styles from './Attachment.module.scss';

interface AudioAttachmentProps {
  attachment: DisplayAttachment;
  searchQuery?: string;
  /** Called when the user clicks the card body — opens the attachment canvas. */
  onClick?: (id: string) => void;
  /** Called when the user clicks the download button. */
  onDownload?: (id: string) => void;
  /** Called when the user clicks the remove button. */
  onRemove?: (id: string) => void;
  labels?: AttachmentCardLabels;
  styles?: AttachmentCardStyles;
  cssVars?: CSSProperties;
}

/** Widescreen tile for a single audio attachment inside the composer tray. */
export const AudioAttachment: FC<AudioAttachmentProps> = ({
  attachment,
  searchQuery = '',
  onClick,
  onDownload,
  onRemove,
  labels,
  styles: cardStyles,
  cssVars,
}) => {
  const {
    clickLabel = 'Open attachment',
    downloadLabel = 'Download attachment',
    removeLabel = 'Remove attachment',
  } = labels ?? {};
  const { typography, className } = cardStyles ?? {};

  const handleCardClick = (): void => {
    onClick?.(attachment.id);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  };

  return (
    <div
      style={cssVars}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? clickLabel : undefined}
      onClick={onClick ? handleCardClick : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      className={mergeClasses(
        'group relative flex w-full min-w-[280px] max-w-[300px] flex-col gap-2 rounded-xl border p-3',
        onClick && 'cursor-pointer',
        (onDownload || onRemove) && 'pe-8',
        className,
      )}
    >
      <span
        title={attachment.name}
        className={mergeClasses(
          typography?.fontClassName ?? 'dial-tiny-text',
          'min-w-0 truncate',
          styles.nameText,
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
      {attachment.playUrl && (
        <audio
          controls
          src={attachment.playUrl}
          aria-label={attachment.name}
          className="w-full"
          preload="metadata"
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {onDownload && (
        <DownloadAction
          ariaLabel={downloadLabel}
          onClick={onDownload}
          id={attachment.id}
        />
      )}
      {onRemove && (
        <RemoveAction
          ariaLabel={removeLabel}
          onClick={onRemove}
          id={attachment.id}
        />
      )}
    </div>
  );
};
