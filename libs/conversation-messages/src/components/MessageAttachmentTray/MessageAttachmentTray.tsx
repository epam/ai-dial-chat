import {
  getFileNameExtension,
  getFileNameWithoutExtension,
  mergeClasses,
  type ApiAttachment,
} from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconFile } from '@tabler/icons-react';
import { type FC } from 'react';
import styles from './MessageAttachmentTray.module.scss';

interface Props {
  /** List of DIAL attachments to display (read-only). */
  attachments: ApiAttachment[];
  /** 'user' renders tray right-aligned; 'assistant' renders left-aligned. */
  side: 'user' | 'assistant';
  /** Extra class name(s) merged onto the root element. */
  className?: string;
}

const isImageType = (type: string): boolean => type.startsWith('image/');

const AttachmentCard: FC<{ attachment: ApiAttachment }> = ({ attachment }) => {
  const { type, title, url } = attachment;

  if (isImageType(type) && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-[100px] w-[100px] flex-shrink-0 overflow-hidden rounded"
        aria-label={title}
      >
        <img src={url} alt={title} className="h-full w-full object-cover" />
      </a>
    );
  }

  return (
    <div
      className={mergeClasses(
        styles.card,
        'flex h-[100px] w-[100px] flex-shrink-0 flex-col gap-3 rounded-md border p-3',
      )}
    >
      <div className="flex flex-1 items-start overflow-hidden">
        <span
          className={mergeClasses(
            'dial-tiny-text line-clamp-3 max-w-[76px] break-words',
            styles.name,
          )}
        >
          {getFileNameWithoutExtension(title)}
        </span>
      </div>
      <div className="flex flex-row items-center gap-1 overflow-hidden">
        <IconFile
          size={DIAL_ICON_SIZE.SM}
          className={mergeClasses('shrink-0', styles.meta)}
          aria-hidden
        />
        <span
          className={mergeClasses(
            'dial-tiny-text min-w-0 flex-1 truncate',
            styles.meta,
          )}
        >
          {getFileNameExtension(title) || type}
        </span>
      </div>
    </div>
  );
};

export const MessageAttachmentTray: FC<Props> = ({
  attachments,
  side,
  className,
}) => {
  if (attachments.length === 0) return null;

  return (
    <div
      className={mergeClasses(
        'flex flex-wrap gap-2',
        side === 'user' ? 'justify-end' : 'justify-start',
        className,
      )}
    >
      {attachments.map((attachment) => (
        <AttachmentCard
          key={attachment.url ?? attachment.title}
          attachment={attachment}
        />
      ))}
    </div>
  );
};
