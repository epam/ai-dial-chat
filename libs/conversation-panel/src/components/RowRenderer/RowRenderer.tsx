import type { RowComponentProps } from 'react-window';
import { type RowRendererData, VirtualRowKind } from '../../models/virtual-row';
import { FilterTab } from '../../types/conversation-classification';
import { ConversationGroupHeader } from '../ConversationGroupHeader/ConversationGroupHeader';
import { ConversationRow } from '../ConversationRow/ConversationRow';

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

  if (row.kind === VirtualRowKind.Header) {
    const isPinnedHeader = row.groupKey === FilterTab.Pinned;
    return (
      <div
        role="presentation"
        style={style}
        className={index === 0 ? 'pt-0' : 'pt-8'}
      >
        <ConversationGroupHeader
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
    <div role="presentation" style={style} className="pt-1">
      <ConversationRow
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
        taskBadgeClassName={styles?.taskBadgeClassName}
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
