import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { IconCaretDownFilled, IconCaretRightFilled } from '@tabler/icons-react';
import type { DragEvent, FC } from 'react';
import { ConversationGroupKey } from '../../types/conversation-group-key';
import styles from '../ConversationPanel/ConversationPanel.module.scss';

/** Props for `ConversationGroupHeader`. */
export interface ConversationGroupHeaderProps {
  /** Section heading label. */
  label: string;
  /** Whether the group is currently expanded. */
  isExpanded: boolean;
  /** Called when the user clicks the header to toggle expansion. */
  onToggle: () => void;
  /** Typography class applied to the header button. Defaults to `'dial-tiny-text'`. */
  className?: string;
  /**
   * When provided the header acts as a drop zone for drag-and-drop.
   * Only the Pinned group header receives this prop.
   */
  dropZoneGroupKey?: ConversationGroupKey;
  /** Whether the drag cursor is currently over this header. */
  isDragOver?: boolean;
  /** Called when the drag cursor enters this header drop zone. */
  onDragOver?: (id: string) => void;
  /** Called when the drag cursor leaves this header drop zone. */
  onDragLeave?: () => void;
  /** Called when the user drops onto this header drop zone. */
  onDrop?: (
    targetId: string,
    targetGroupKey: ConversationGroupKey,
    afterId: string | null,
  ) => void;
}

/** Collapsible group header button used in the virtualised conversation list. */
export const ConversationGroupHeader: FC<ConversationGroupHeaderProps> = ({
  label,
  isExpanded,
  onToggle,
  className = 'dial-tiny-semi-text uppercase',
  dropZoneGroupKey,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const isDropZone = dropZoneGroupKey != null;

  const handleDragOver = (e: DragEvent<HTMLButtonElement>) => {
    if (!isDropZone) return;
    e.preventDefault();
    onDragOver?.(dropZoneGroupKey);
  };

  const handleDragLeave = (e: DragEvent<HTMLButtonElement>) => {
    if (!isDropZone) return;
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      onDragLeave?.();
    }
  };

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    if (!isDropZone) return;
    e.preventDefault();
    // Drop onto header always inserts at the top of the group (afterId = null)
    onDrop?.(dropZoneGroupKey, dropZoneGroupKey, null);
  };

  return (
    <button
      type="button"
      aria-expanded={isExpanded}
      onClick={onToggle}
      onDragOver={isDropZone ? handleDragOver : undefined}
      onDragLeave={isDropZone ? handleDragLeave : undefined}
      onDrop={isDropZone ? handleDrop : undefined}
      className={mergeClasses(
        'flex h-6 w-full items-center gap-1 rounded py-1 pe-3 text-start',
        className,
        styles.groupHeader,
        isDragOver && 'ring-accent-secondary ring-1 ring-inset',
      )}
    >
      {isExpanded ? (
        <IconCaretDownFilled stroke={0.5} size={12} className="shrink-0" />
      ) : (
        <IconCaretRightFilled stroke={0.5} size={12} className="shrink-0" />
      )}
      <DialEllipsisTooltip text={label} />
    </button>
  );
};
