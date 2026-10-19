import { FilterTab } from '@epam/ai-dial-chat-shared';
import type { RowComponentProps } from 'react-window';
import type { RowRendererData } from '../../models/virtual-row';
import { ConversationRowVariant } from '../../types/conversation-row-variant';
import { VirtualRowKind } from '../../types/virtual-row';
import { ConversationGroupHeader } from '../ConversationGroupHeader/ConversationGroupHeader';
import { ConversationRow } from '../ConversationRow/ConversationRow';

/** Returns the top padding class that separates a group header from the row above it. */
const getHeaderPaddingClassName = (
  index: number,
  isIndicator: boolean,
): string => {
  if (isIndicator) return index === 0 ? 'pt-2' : 'pt-4';
  return index === 0 ? 'pt-0' : 'pt-8';
};

/** Renders a single virtual row — either a collapsible group header or a conversation item. */
export const RowRenderer = ({
  index,
  style,
  rows,
  expandedGroups,
  onToggleGroup,
  listId,
  activeConversationId,
  searchQuery,
  onSelectConversation,
  getActions,
  onActionMenuOpen,
  actionsLabel,
  unreadIndicatorLabel,
  styles,
  rowVariant = ConversationRowVariant.Avatar,
  draggingId,
  dragOverId,
  allowedDropGroups,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: RowComponentProps<RowRendererData>) => {
  const row = rows[index];
  const isIndicator = rowVariant === ConversationRowVariant.Indicator;

  if (row.kind === VirtualRowKind.Header) {
    const isPinnedHeader = row.groupKey === FilterTab.Pinned;
    return (
      <div
        role="presentation"
        style={style}
        className={getHeaderPaddingClassName(index, isIndicator)}
      >
        <ConversationGroupHeader
          variant={rowVariant}
          label={row.label}
          isExpanded={expandedGroups.has(row.groupKey)}
          onToggle={() => onToggleGroup(row.groupKey)}
          listId={listId}
          className={styles?.groupHeaderClassName}
          dropZoneGroupKey={isPinnedHeader ? FilterTab.Pinned : undefined}
          isDragOver={isPinnedHeader && dragOverId === FilterTab.Pinned}
          onDragOver={isPinnedHeader ? onDragOver : undefined}
          onDragLeave={isPinnedHeader ? onDragLeave : undefined}
          onDrop={isPinnedHeader ? onDrop : undefined}
        />
      </div>
    );
  }

  return (
    <div
      role="presentation"
      style={style}
      className={isIndicator ? 'pt-0.5' : 'pt-1'}
    >
      <ConversationRow
        variant={rowVariant}
        item={row.item}
        isActive={row.item.id === activeConversationId}
        searchQuery={searchQuery}
        onSelectConversation={onSelectConversation}
        getActions={getActions}
        onActionMenuOpen={onActionMenuOpen}
        actionsLabel={actionsLabel}
        unreadIndicatorLabel={unreadIndicatorLabel}
        itemTitleClassName={styles?.itemTitleClassName}
        itemIconBadgeClassName={styles?.itemIconBadgeClassName}
        rowGroupKey={row.groupKey}
        rows={rows}
        draggingId={draggingId}
        dragOverId={dragOverId}
        allowedDropGroups={allowedDropGroups}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      />
    </div>
  );
};
