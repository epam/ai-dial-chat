import { FilterTab } from '@epam/ai-dial-chat-shared';
import type { RowComponentProps } from 'react-window';
import type { RowRendererData } from '../../models/virtual-row';
import { ConversationRowVariant } from '../../types/conversation-row-variant';
import { VirtualRowKind } from '../../types/virtual-row';
import { ConversationGroupHeader } from '../ConversationGroupHeader/ConversationGroupHeader';
import { ConversationRow } from '../ConversationRow/ConversationRow';
import { ProjectRow } from '../ProjectRow/ProjectRow';
import { ProjectSeeAllRow } from '../ProjectRow/ProjectSeeAllRow';

/** Returns the top padding class that separates a group header from the row above it. */
const getHeaderPaddingClassName = (
  index: number,
  isIndicator: boolean,
): string => {
  if (isIndicator) return index === 0 ? 'pt-2' : 'pt-4';
  return index === 0 ? 'pt-0' : 'pt-8';
};

/** Renders a single virtual row — a collapsible group header, a conversation item, or a pinned project's row. */
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
  activeProjectId,
  onSelectProject,
  onSelectProjectConversation,
  onSeeAll,
  getProjectActions,
  onProjectActionMenuOpen,
  seeAllLabel,
  seeAllAriaLabel,
  styles,
  rowVariant = ConversationRowVariant.Avatar,
  projectConversationVariant = ConversationRowVariant.Indicator,
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
    /* A list owns only list items: the header is one, and a conversation row
       is the `li` the row itself renders. */
    return (
      <div
        role="listitem"
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

  if (row.kind === VirtualRowKind.Project) {
    return (
      <div role="presentation" style={style} className="pt-0.5">
        <ProjectRow
          project={row.project}
          isActive={row.project.id === activeProjectId}
          onSelectProject={onSelectProject}
          searchQuery={searchQuery}
          getActions={getProjectActions}
          onActionMenuOpen={onProjectActionMenuOpen}
          actionsLabel={actionsLabel}
          titleClassName={styles?.itemTitleClassName}
        />
      </div>
    );
  }

  if (row.kind === VirtualRowKind.ProjectSeeAll) {
    return (
      <div role="presentation" style={style} className="pt-0.5">
        <ProjectSeeAllRow
          project={row.project}
          position={row}
          onSeeAll={onSeeAll}
          label={seeAllLabel}
          ariaLabel={seeAllAriaLabel}
          titleClassName={styles?.itemTitleClassName}
        />
      </div>
    );
  }

  /* A nested chat has no actions and no drag: it is opened, nothing more. */
  if (row.kind === VirtualRowKind.ProjectConversation) {
    return (
      <div role="presentation" style={style} className="pt-0.5">
        <ConversationRow
          variant={projectConversationVariant}
          nesting={row}
          item={row.item}
          isActive={row.item.id === activeConversationId}
          searchQuery={searchQuery}
          onSelectConversation={onSelectProjectConversation}
          unreadIndicatorLabel={unreadIndicatorLabel}
          itemTitleClassName={styles?.itemTitleClassName}
          unreadItemTitleClassName={styles?.unreadItemTitleClassName}
          itemIconBadgeClassName={styles?.itemIconBadgeClassName}
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
        unreadItemTitleClassName={styles?.unreadItemTitleClassName}
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
