import {
  DeploymentIcon,
  Highlight,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  DIAL_ICON_SIZE,
  DialButton,
  DialDropdown,
  DialIconButton,
  DialSkeleton,
  DialSkeletonVariant,
  ElementSize,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import { IconDotsVertical } from '@tabler/icons-react';
import { useCallback, useRef, useState, type DragEvent, type FC } from 'react';
import { ConversationItem } from '../../models/panel-props';
import type { VirtualRow } from '../../models/virtual-row';
import { FilterTab } from '../../types/conversation-classification';
import { getButtonPaddingEnd } from '../../utils/conversation-row';
import { getDropAfterId } from '../../utils/drag';
import styles from '../ConversationPanel/ConversationPanel.module.scss';

/** Props for `ConversationRow`. */
export interface ConversationRowProps {
  /** The conversation item to display. */
  item: ConversationItem;
  /** Whether this row is currently active/selected. */
  isActive: boolean;
  /** Called when the user clicks the row to select the conversation. */
  onSelectConversation: (id: string) => void;
  /** Current search query — matched text in the title is highlighted. */
  searchQuery?: string;
  /**
   * Builds the dropdown menu items for this row.
   * Receives the item so actions can reflect per-item state (e.g. pin toggle).
   * When omitted or returns an empty array, the actions trigger is not rendered.
   */
  getActions?: (item: ConversationItem) => DropdownItem[];
  /** Called when this row's action menu opens. */
  onActionMenuOpen?: (
    item: ConversationItem,
    trigger: HTMLButtonElement,
  ) => void;
  /** Accessible label for the actions trigger button. Defaults to `"More actions"`. */
  actionsLabel?: string;
  /** Typography class for the conversation title text. Defaults to `'dial-small-text'`. */
  itemTitleClassName?: string;
  /** CSS class applied to the icon badge. Defaults to `'rounded-full'`. */
  itemIconBadgeClassName?: string;
  /**
   * The group this row belongs to — required to enable drag-and-drop.
   * When absent the row is not draggable (used by `ConversationGroup`).
   */
  rowGroupKey?: FilterTab;
  /** The full virtual rows array — used to compute drop position. */
  rows?: VirtualRow[];
  /** Id of the conversation currently being dragged. `null` when no drag is active. */
  draggingId?: string | null;
  /** Id of the row currently under the drag cursor. */
  dragOverId?: string | null;
  /** Groups that are valid drop targets for the current drag. `null` when no drag is active. */
  allowedDropGroups?: Set<FilterTab> | null;
  /** Called when the user starts dragging this row. */
  onDragStart?: (id: string) => void;
  /** Called when the drag ends (drop or cancel). */
  onDragEnd?: () => void;
  /** Called when the drag cursor enters this row. */
  onDragOver?: (id: string) => void;
  /** Called when the drag cursor leaves this row. */
  onDragLeave?: () => void;
  /** Called when the user drops onto this row. */
  onDrop?: (
    targetId: string,
    targetGroupKey: FilterTab,
    afterId: string | null,
  ) => void;
}

/** Single draggable conversation row rendered inside the virtualised list or a static `ConversationGroup`. */
export const ConversationRow: FC<ConversationRowProps> = ({
  item,
  isActive,
  onSelectConversation,
  searchQuery = '',
  getActions,
  onActionMenuOpen,
  actionsLabel = 'More actions',
  itemTitleClassName = 'dial-small-text',
  itemIconBadgeClassName,
  rowGroupKey,
  rows,
  draggingId,
  dragOverId,
  allowedDropGroups,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const actionTriggerRef = useRef<HTMLButtonElement>(null);

  const handleMenuOpenChange = useCallback(
    (isOpen: boolean) => {
      setIsMenuOpen(isOpen);
      if (isOpen && actionTriggerRef.current) {
        onActionMenuOpen?.(item, actionTriggerRef.current);
      }
    },
    [item, onActionMenuOpen],
  );

  const menuItems = getActions?.(item) ?? [];
  const hasActions = menuItems.length > 0;

  const avatar = item.isIconLoading ? (
    <DialSkeleton
      variant={DialSkeletonVariant.Circular}
      width={DIAL_ICON_SIZE.LG}
      height={DIAL_ICON_SIZE.LG}
      color={styles.skeletonColor}
      aria-hidden
    />
  ) : (
    <DeploymentIcon
      src={item.iconUrl}
      size={DIAL_ICON_SIZE.LG}
      initialsName={item.iconTooltip ?? ''}
      tooltip={item.iconTooltip}
      badgeClassName={itemIconBadgeClassName}
    />
  );

  const buttonPaddingEnd = getButtonPaddingEnd(hasActions, isMenuOpen);

  const isDragEnabled = rowGroupKey != null;

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLLIElement>) => {
      // Only clear dragOver when truly leaving the row (not moving between child elements)
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        onDragLeave?.();
      }
    },
    [onDragLeave],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLLIElement>) => {
      if (!rowGroupKey || !rows || !onDrop) return;
      e.preventDefault();
      const afterId = getDropAfterId(e, item.id, rows, rowGroupKey);
      onDrop(item.id, rowGroupKey, afterId);
    },
    [item.id, rows, rowGroupKey, onDrop],
  );

  const isDragging = item.id === draggingId;
  const isDropTarget = item.id === dragOverId;
  const isDropAllowed =
    rowGroupKey != null && (allowedDropGroups?.has(rowGroupKey) ?? false);
  const isDragActive = draggingId != null;

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <li
      className={mergeClasses(
        'group/conversation relative',
        isDragging && 'cursor-grabbing opacity-50',
        isDropTarget && isDropAllowed && 'rounded',
        isDropTarget && isDropAllowed && styles.dropZoneActive,
        isDragActive && !isDragging && !isDropAllowed && 'cursor-not-allowed',
      )}
      draggable={isDragEnabled || undefined}
      onDragStart={isDragEnabled ? () => onDragStart?.(item.id) : undefined}
      onDragEnd={isDragEnabled ? onDragEnd : undefined}
      onDragOver={
        isDragEnabled
          ? (e) => {
              e.preventDefault();
              onDragOver?.(item.id);
            }
          : undefined
      }
      onDragLeave={isDragEnabled ? handleDragLeave : undefined}
      onDrop={isDragEnabled ? handleDrop : undefined}
    >
      <a
        href={item.href}
        className="contents"
        onClick={(e) => {
          if (!item.href) return;
          e.preventDefault();
          onSelectConversation(item.id);
        }}
      >
        <DialButton
          iconBefore={avatar}
          label={
            <Highlight
              text={item.title}
              query={searchQuery}
              className={itemTitleClassName}
              maxLines={1}
            />
          }
          textClassName="min-w-0"
          aria-current={isActive ? 'page' : undefined}
          onClick={item.href ? undefined : () => onSelectConversation(item.id)}
          tabIndex={item.href ? -1 : undefined}
          className={mergeClasses(
            'flex h-8 w-full items-center justify-start gap-2 rounded-xl py-2 ps-3',
            buttonPaddingEnd,
            styles.item,
            isActive && styles.itemActive,
            isMenuOpen && styles.itemActive,
          )}
        />
      </a>

      {hasActions && (
        <div
          className={mergeClasses(
            'absolute inset-y-0 end-1 flex items-center',
            isMenuOpen
              ? 'opacity-100'
              : 'opacity-0 group-focus-within/conversation:opacity-100 group-hover/conversation:opacity-100',
          )}
        >
          <DialDropdown
            items={menuItems}
            onOpenChange={handleMenuOpenChange}
            matchReferenceWidth={false}
            listClassName="w-[140px] cp-dropdown-overlay"
          >
            <DialIconButton
              ref={actionTriggerRef}
              icon={
                <IconDotsVertical
                  size={DIAL_ICON_SIZE.SM}
                  className={styles.triggerIcon}
                  aria-hidden
                />
              }
              appearance={ButtonAppearance.Ghost}
              size={ElementSize.Small}
              aria-label={actionsLabel}
              className={mergeClasses(
                'flex items-center justify-center rounded',
                styles.trigger,
                isMenuOpen && styles.triggerActive,
              )}
            />
          </DialDropdown>
        </div>
      )}
    </li>
  );
};
