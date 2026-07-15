import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import type { ConversationGroupKey } from '../types/conversation-group-key';
import { VirtualRowKind } from '../types/virtual-row';
import type { ConversationHistoryItem } from './panel-props';

export { VirtualRowKind };

/** A collapsible group header row in the virtual list. */
export interface GroupHeaderRow {
  /** Row discriminant. */
  kind: VirtualRowKind.Header;
  /** Identifies which group this header belongs to. */
  groupKey: ConversationGroupKey;
  /** Visible section heading text. */
  label: string;
}

/** A single conversation item row in the virtual list. */
export interface ConversationItemRow {
  /** Row discriminant. */
  kind: VirtualRowKind.Item;
  /** The conversation to render. */
  item: ConversationHistoryItem;
  /** The group this item belongs to — used for drag-and-drop validation. */
  groupKey: ConversationGroupKey;
}

/** Union of all possible virtual row shapes. */
export type VirtualRow = GroupHeaderRow | ConversationItemRow;

/** Data passed to every virtual row renderer via `react-window`'s `rowProps`. */
export interface RowRendererData {
  /** The full flat row array, indexed by the virtual list. */
  rows: VirtualRow[];
  /** Set of group keys that are currently expanded. */
  expandedGroups: Set<string>;
  /** Toggles the expanded state of the given group. */
  onToggleGroup: (key: string) => void;
  /** `id` of the currently active conversation. */
  activeConversationId?: string;
  /** Current search query — used to highlight matches in conversation titles. */
  searchQuery: string;
  /** Called when the user selects a conversation row. */
  onSelectConversation: (id: string) => void;
  /** Builds dropdown actions for a conversation item. */
  getActions?: (item: ConversationHistoryItem) => DropdownItem[];
  /** Called when a row action menu opens. */
  onActionMenuOpen?: (
    item: ConversationHistoryItem,
    trigger: HTMLButtonElement,
  ) => void;
  /** Accessible label for the actions trigger button. */
  actionsLabel?: string;
  /** Typography class applied to group header buttons. */
  groupHeaderClassName?: string;
  /** Typography class applied to conversation title text. */
  itemTitleClassName?: string;
  /** CSS class applied to the icon badge in each conversation row. */
  itemIconBadgeClassName?: string;
  /** Id of the conversation currently being dragged. `null` when no drag is in progress. */
  draggingId: string | null;
  /** Id of the row (item or group header sentinel) currently under the drag cursor. */
  dragOverId: string | null;
  /** Groups that are valid drop targets for the current drag. `null` when no drag is in progress. */
  allowedDropGroups: Set<ConversationGroupKey> | null;
  /** Called when the user starts dragging a conversation row. */
  onDragStart: (id: string) => void;
  /** Called when the drag ends (drop or cancel). */
  onDragEnd: () => void;
  /** Called when the drag cursor enters a row. */
  onDragOver: (id: string) => void;
  /** Called when the drag cursor leaves a row. */
  onDragLeave: () => void;
  /**
   * Called when the user drops onto a target row or group header.
   * `targetId` is the item id or `ConversationGroupKey` sentinel for header drops.
   * `targetGroupKey` is the group the item was dropped into.
   * `afterId` is the id of the item to insert after, or `null` for top of group.
   */
  onDrop: (
    targetId: string,
    targetGroupKey: ConversationGroupKey,
    afterId: string | null,
  ) => void;
}
