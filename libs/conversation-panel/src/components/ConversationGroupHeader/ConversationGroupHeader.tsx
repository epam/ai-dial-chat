import { FilterTab, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  EllipsisTooltip,
} from '@epam/ai-dial-ui-kit';
import {
  IconCaretDownFilled,
  IconCaretRightFilled,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react';
import type { DragEvent, FC } from 'react';
import { ConversationRowVariant } from '../../types/conversation-row-variant';
import styles from '../ConversationPanel/ConversationPanel.module.scss';

/** Props for `ConversationGroupHeader`. */
export interface ConversationGroupHeaderProps {
  /** Section heading label. */
  label: string;
  /** Whether the group is currently expanded. */
  isExpanded: boolean;
  /** Called when the user clicks the header to toggle expansion. */
  onToggle: () => void;
  /** `id` of the virtualized list container this header's rows belong to, referenced via `aria-controls`. */
  listId: string;
  /** Typography class applied to the header button. Defaults to `'dial-tiny-lead-text'`. */
  className?: string;
  /** Presentation of the header. `Indicator` puts the hover chevron after the label. Defaults to `ConversationRowVariant.Avatar`. */
  variant?: ConversationRowVariant;
  /** When provided the header acts as a drag-and-drop drop zone. */
  dropZoneGroupKey?: FilterTab;
  /** Whether the drag cursor is currently over this header. */
  isDragOver?: boolean;
  /** Called when the drag cursor enters this header drop zone. */
  onDragOver?: (id: string) => void;
  /** Called when the drag cursor leaves this header drop zone. */
  onDragLeave?: () => void;
  /** Called when the user drops onto this header drop zone. */
  onDrop?: (
    targetId: string,
    targetGroupKey: FilterTab,
    afterId: string | null,
  ) => void;
}

/** Collapsible group header button used in the virtualised conversation list. */
export const ConversationGroupHeader: FC<ConversationGroupHeaderProps> = ({
  label,
  isExpanded,
  onToggle,
  listId,
  className = 'dial-tiny-lead-text',
  variant = ConversationRowVariant.Avatar,
  dropZoneGroupKey,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const isDropZone = dropZoneGroupKey != null;
  const isIndicator = variant === ConversationRowVariant.Indicator;

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

  const renderLeadingCaret = () =>
    isExpanded ? (
      <IconCaretDownFilled
        size={12}
        className="shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden
      />
    ) : (
      <IconCaretRightFilled
        size={12}
        className="shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 rtl:scale-x-[-1]"
        aria-hidden
      />
    );

  const renderTrailingChevron = () =>
    isExpanded ? (
      <IconChevronDown
        size={DIAL_ICON_SIZE.SM}
        stroke={DIAL_KIT_ICON_STROKE}
        className="shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden
      />
    ) : (
      <IconChevronRight
        size={DIAL_ICON_SIZE.SM}
        stroke={DIAL_KIT_ICON_STROKE}
        className="shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 rtl:scale-x-[-1]"
        aria-hidden
      />
    );

  return (
    <button
      type="button"
      aria-expanded={isExpanded}
      aria-controls={listId}
      onClick={onToggle}
      onDragOver={isDropZone ? handleDragOver : undefined}
      onDragLeave={isDropZone ? handleDragLeave : undefined}
      onDrop={isDropZone ? handleDrop : undefined}
      className={mergeClasses(
        'group flex h-6 w-full items-center gap-1 rounded text-start',
        isIndicator ? 'px-2' : 'py-1 pe-3',
        className,
        styles.groupHeader,
        isDragOver && styles.dropZoneActive,
      )}
    >
      {!isIndicator && renderLeadingCaret()}
      {isIndicator ? (
        /* Sized to its text, so the chevron sits right after the label. */
        <span className="max-w-full min-w-0">
          <EllipsisTooltip text={label} />
        </span>
      ) : (
        <EllipsisTooltip text={label} />
      )}
      {isIndicator && renderTrailingChevron()}
    </button>
  );
};
