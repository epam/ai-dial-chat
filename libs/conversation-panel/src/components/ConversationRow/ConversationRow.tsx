import {
  DeploymentIcon,
  FilterTab,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  Button,
  DIAL_ICON_SIZE,
  Highlight,
  Skeleton,
  SkeletonVariant,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useMemo, type DragEvent, type FC } from 'react';
import { useRowActions } from '../../hooks/useRowActions';
import { ConversationItem } from '../../models/panel-props';
import type { NestedRowPosition } from '../../models/pinned-projects';
import type { VirtualRow } from '../../models/virtual-row';
import { ConversationRowVariant } from '../../types/conversation-row-variant';
import { getButtonPaddingEnd } from '../../utils/conversation-row';
import { getDropAfterId } from '../../utils/drag';
import styles from '../ConversationPanel/ConversationPanel.module.scss';
import projectStyles from '../ProjectRow/ProjectRow.module.scss';
import { RowActionsMenu } from '../RowActionsMenu/RowActionsMenu';

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
  /** Builds dropdown actions for this row. When absent or empty, the action trigger is not rendered. */
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
  /** Typography class for the title of an unread conversation. Defaults to `'dial-small-semi-text'`. */
  unreadItemTitleClassName?: string;
  /** CSS class applied to the icon badge. Defaults to `'rounded-full'`. */
  itemIconBadgeClassName?: string;
  /** Accessible (visually hidden) label announced for the unread indicator dot. Defaults to `"Unread"`. */
  unreadIndicatorLabel?: string;
  /** Presentation of the row's leading slot and metrics. Defaults to `ConversationRowVariant.Avatar`. */
  variant?: ConversationRowVariant;
  /** Renders the row nested under a pinned project: indented, with its guide-line segment and level-2 ARIA position. */
  nesting?: NestedRowPosition;
  /** Group this row belongs to — required to enable drag-and-drop. */
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

const ConversationRowComponent: FC<ConversationRowProps> = ({
  item,
  isActive,
  onSelectConversation,
  searchQuery = '',
  getActions,
  onActionMenuOpen,
  actionsLabel = 'More actions',
  itemTitleClassName = 'dial-small-text',
  unreadItemTitleClassName = 'dial-small-semi-text',
  itemIconBadgeClassName,
  unreadIndicatorLabel = 'Unread',
  variant = ConversationRowVariant.Avatar,
  nesting,
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
  /* A host's new `getActions` (e.g. a landed revoke-count lookup) still
     refreshes an open menu. */
  const {
    menuItems,
    hasActions,
    isMenuOpen,
    handleOpenChange: handleMenuOpenChange,
    handleOpen: handleMenuOpen,
  } = useRowActions(item, getActions, onActionMenuOpen);

  const deploymentIconLabels = useMemo(
    () => ({ tooltip: item.iconTooltip }),
    [item.iconTooltip],
  );
  const deploymentIconStyles = useMemo(
    () => ({ badgeClassName: itemIconBadgeClassName }),
    [itemIconBadgeClassName],
  );

  const isIndicator = variant === ConversationRowVariant.Indicator;

  const avatar = item.leadingIcon ? (
    <span className="flex size-6 shrink-0 items-center justify-center">
      {item.leadingIcon}
    </span>
  ) : item.isIconLoading ? (
    <Skeleton
      variant={SkeletonVariant.Circular}
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
      labels={deploymentIconLabels}
      styles={deploymentIconStyles}
    />
  );

  const buttonPaddingEnd = getButtonPaddingEnd(hasActions, isMenuOpen, variant);

  /*
   * The dot sits in a 24px trailing slot. Whenever the actions trigger is shown
   * (hover, focus-within, open menu) the dot is hidden so the trigger takes that
   * spot; the visually hidden label keeps announcing the unread state.
   */
  const leadingIndicator = (
    <span className="flex size-6 shrink-0 items-center justify-center">
      <span
        className={mergeClasses(
          'size-[7.11px] rounded-full',
          item.isUnread ? styles.unreadDot : styles.indicatorDot,
        )}
        aria-hidden
      />
      {item.isUnread && <span className="sr-only">{unreadIndicatorLabel}</span>}
    </span>
  );

  const unreadIndicator =
    item.isUnread && !isIndicator ? (
      <span className="flex size-6 shrink-0 items-center justify-center">
        <span
          className={mergeClasses(
            'size-[7.11px] rounded-full',
            styles.unreadDot,
            hasActions &&
              (isMenuOpen
                ? 'opacity-0'
                : 'group-focus-within/conversation:opacity-0 group-hover/conversation:opacity-0'),
          )}
          aria-hidden
        />
        <span className="sr-only">{unreadIndicatorLabel}</span>
      </span>
    ) : undefined;

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
      aria-level={nesting ? 2 : undefined}
      aria-posinset={nesting?.posInSet}
      aria-setsize={nesting?.setSize}
      className={mergeClasses(
        'group/conversation relative',
        nesting && mergeClasses('ps-7', projectStyles.guideLine),
        nesting?.isFirstNested && projectStyles.guideLineFirst,
        nesting?.isLastNested && projectStyles.guideLineLast,
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
        <Button
          iconBefore={isIndicator ? leadingIndicator : avatar}
          label={
            <Highlight
              text={item.title}
              query={searchQuery}
              className={
                item.isUnread ? unreadItemTitleClassName : itemTitleClassName
              }
              maxLines={1}
            />
          }
          iconAfter={unreadIndicator}
          textClassName="min-w-0 flex-1"
          aria-current={isActive ? 'page' : undefined}
          onClick={item.href ? undefined : () => onSelectConversation(item.id)}
          tabIndex={item.href ? -1 : undefined}
          className={mergeClasses(
            /* The row's corner radius comes from `styles.item` (--cp-row-radius). */
            'h-8 w-full justify-start py-2 after:pointer-events-none',
            isIndicator ? 'gap-0.5 ps-2' : 'gap-2 ps-3',
            buttonPaddingEnd,
            styles.item,
            isIndicator && styles.itemIndicator,
            isActive && styles.itemActive,
            isMenuOpen && styles.itemActive,
          )}
        />
      </a>

      {hasActions && (
        <RowActionsMenu
          items={menuItems}
          isOpen={isMenuOpen}
          onOpenChange={handleMenuOpenChange}
          onOpen={handleMenuOpen}
          actionsLabel={actionsLabel}
          variant={variant}
        />
      )}
    </li>
  );
};

/** Single draggable conversation row rendered inside the virtualised list or a static `ConversationGroup`. */
export const ConversationRow = memo(ConversationRowComponent);
