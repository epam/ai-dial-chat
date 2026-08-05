import { DisplayAttachment, mergeClasses } from '@epam/ai-dial-chat-shared';
import { Highlight } from '@epam/ai-dial-ui-kit';
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
  /** Whether this attachment is the one currently open in the canvas panel. Renders the tile's selected visual state. */
  isSelected?: boolean;
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
  isSelected,
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
      {...(onClick != null
        ? {
            role: 'button' as const,
            tabIndex: 0,
            'aria-label': clickLabel,
            onClick: handleCardClick,
            onKeyDown: handleKeyDown,
          }
        : {})}
      className={mergeClasses(
        'group/attachment-tile relative flex w-full min-w-[280px] max-w-[300px] flex-col gap-2 rounded-xl border p-3',
        onClick && 'cursor-pointer',
        (onDownload || onRemove) && 'pe-8',
        isSelected && styles.selected,
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
          <Highlight text={attachment.name} query={searchQuery} maxLines={1} />
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
