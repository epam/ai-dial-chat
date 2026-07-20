import {
  DisplayAttachment,
  Highlight,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { CSSProperties, type FC } from 'react';
import {
  AttachmentCardLabels,
  AttachmentCardStyles,
} from '../../../models/attachment-card';
import { DownloadAction } from './Actions';
import styles from './Attachment.module.scss';

interface AudioAttachmentProps {
  attachment: DisplayAttachment;
  searchQuery?: string;
  onClick?: (id: string) => void;
  shouldAlwaysShowActions?: boolean;
  labels?: AttachmentCardLabels;
  styles?: AttachmentCardStyles;
  cssVars?: CSSProperties;
}
/** Square tile for a single audio attachment inside the composer tray. */
export const AudioAttachment: FC<AudioAttachmentProps> = ({
  attachment,
  searchQuery = '',
  onClick,
  labels,
  styles: cardStyles,
  cssVars,
}) => {
  const { clickLabel = 'Open attachment' } = labels ?? {};
  const { typography, className } = cardStyles ?? {};

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'group flex w-full min-w-[280px] max-w-[300px] flex-col gap-2 rounded-xl border p-3',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
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
        {onClick && (
          <DownloadAction
            ariaLabel={clickLabel}
            onClick={onClick}
            id={attachment.id}
          />
        )}
      </div>
      {attachment.playUrl && (
        <audio
          controls
          src={attachment.playUrl}
          aria-label={attachment.name}
          className="w-full"
          preload="metadata"
        />
      )}
    </div>
  );
};
