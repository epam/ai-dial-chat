import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, mergeClasses } from '@epam/ai-dial-chat-shared';
import { AttachmentCard } from '@epam/ai-dial-conversation-input';
import { memo, type FC } from 'react';

/** Props for the FilesSection component. */
interface FilesSectionProps {
  /** List of attachments to display. Renders nothing when empty. */
  attachments: DisplayAttachment[];
  /** Heading text rendered above the attachment grid. */
  title: string;
  /** Current search query — used to highlight matches in attachment names. */
  searchQuery?: string;
  /** CSS class applied to the section heading. Defaults to `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** Called when the user clicks an attachment card. */
  onAttachmentClick?: (attachment: DisplayAttachment) => void;
  /** Accessible label for the attachment click action, forwarded to `AttachmentCard`. */
  attachmentClickLabel?: string;
}

const FilesSection: FC<FilesSectionProps> = ({
  attachments,
  title,
  searchQuery,
  titleClassName = 'dial-body-semi-text',
  onAttachmentClick,
  attachmentClickLabel,
}) => {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <section className="mb-6">
      <h2 className={mergeClasses(titleClassName, 'mb-3')}>{title}</h2>
      <div
        role="list"
        className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3"
      >
        {attachments.map((att) => (
          <div
            key={att.id}
            role="listitem"
            className={
              att.type === AttachmentType.Audio ? 'col-span-full' : undefined
            }
          >
            <AttachmentCard
              attachment={att}
              searchQuery={searchQuery}
              className="w-full"
              onClick={
                onAttachmentClick ? () => onAttachmentClick(att) : undefined
              }
              clickLabel={attachmentClickLabel}
            />
          </div>
        ))}
      </div>
    </section>
  );
};

export default memo(FilesSection);
