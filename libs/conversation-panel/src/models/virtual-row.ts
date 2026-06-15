import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import type { ConversationGroupKey } from '../types/conversation-group-key';
import { VirtualRowKind } from '../types/virtual-row';
import type { ConversationHistoryItem } from './ConversationPanel';

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
  /** Called when the user selects a conversation row. */
  onSelectConversation: (id: string) => void;
  /** Builds dropdown actions for a conversation item. */
  getActions?: (item: ConversationHistoryItem) => DropdownItem[];
  /** Accessible label for the actions trigger button. */
  actionsLabel?: string;
  /** Typography class applied to group header buttons. */
  groupHeaderClassName?: string;
  /** Typography class applied to conversation title text. */
  itemTitleClassName?: string;
}
