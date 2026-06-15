import type { RowComponentProps } from 'react-window';
import { type RowRendererData, VirtualRowKind } from '../../models/virtual-row';
import { ConversationRow } from '../ConversationGroup/ConversationRow';
import { ConversationGroupHeader } from '../ConversationGroupHeader/ConversationGroupHeader';

/** Renders a single virtual row — either a collapsible group header or a conversation item. */
export const RowRenderer = ({
  index,
  style,
  rows,
  expandedGroups,
  onToggleGroup,
  activeConversationId,
  onSelectConversation,
  getActions,
  actionsLabel,
  groupHeaderClassName,
  itemTitleClassName,
}: RowComponentProps<RowRendererData>) => {
  const row = rows[index];

  if (row.kind === VirtualRowKind.Header) {
    return (
      <div style={style} className={index === 0 ? undefined : 'pt-2'}>
        <ConversationGroupHeader
          label={row.label}
          isExpanded={expandedGroups.has(row.groupKey)}
          onToggle={() => onToggleGroup(row.groupKey)}
          className={groupHeaderClassName}
        />
      </div>
    );
  }

  return (
    <div style={style} className="pt-1">
      <ConversationRow
        item={row.item}
        isActive={row.item.id === activeConversationId}
        onSelectConversation={onSelectConversation}
        getActions={getActions}
        actionsLabel={actionsLabel}
        itemTitleClassName={itemTitleClassName}
      />
    </div>
  );
};
