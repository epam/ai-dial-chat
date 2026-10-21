import type { FilterTab } from '@epam/ai-dial-chat-shared';
import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import type { ReactNode } from 'react';
import type { ConversationTypeFilter } from '../types/conversation-kind';
import type {
  ConversationListLabels,
  ConversationListStyles,
} from './conversation-list';
import type {
  ConversationListHeaderLabels,
  ConversationListHeaderStyles,
} from './conversation-list-header';
import type { ConversationItem, ConversationMove } from './panel-props';

/** Localised labels for `ConversationListSection`: those of its header and of its list. */
export interface ConversationListSectionLabels
  extends ConversationListHeaderLabels, ConversationListLabels {}

/** Style overrides for `ConversationListSection`. */
export interface ConversationListSectionStyles {
  /** Overrides for the header. */
  header?: ConversationListHeaderStyles;
  /** Overrides for the list. */
  list?: ConversationListStyles;
}

/** Props accepted by `ConversationListSection`. */
export interface ConversationListSectionProps {
  /** Ordered list of conversations to display. */
  conversations: ConversationItem[];
  /** When true, renders skeleton rows instead of the conversation list. */
  isLoading?: boolean;
  /** Called with the conversation `id` when a row is clicked. */
  onSelectConversation: (id: string) => void;
  /** `id` of the currently viewed conversation; that row gets `aria-current="page"`. */
  activeConversationId?: string;
  /** Localised labels for the header and the list; `labels.title` also names the section. */
  labels: ConversationListSectionLabels;
  /** Filter tab the host asks for; the section adopts it whenever it changes. */
  requestedFilter?: FilterTab;
  /** Hides the filter trigger in the header. Defaults to `false`. */
  isFilterHidden?: boolean;
  /** Called when the user chooses a filter in the header. */
  onFilterChange?: (tab: FilterTab) => void;
  /** Hides the "Type" submenu of the filter menu, e.g. when the host has no scheduled tasks. Defaults to `false`. */
  isTypeFilterHidden?: boolean;
  /** Called when the user chooses a type in the filter menu. */
  onTypeFilterChange?: (type: ConversationTypeFilter) => void;
  /** Sources to exclude entirely, before filtering and grouping. */
  hiddenSources?: FilterTab[];
  /** Extra controls rendered at the end of the header, e.g. an overflow menu. */
  headerActions?: ReactNode;
  /** Builds dropdown actions for a row. When absent or empty, no action trigger is rendered. */
  getActions?: (item: ConversationItem) => DropdownItem[];
  /** Called when a row action menu opens; receives the trigger button. */
  onActionMenuOpen?: (
    item: ConversationItem,
    trigger: HTMLButtonElement,
  ) => void;
  /** Called when the user completes a drag-and-drop move. */
  onMoveConversation?: (move: ConversationMove) => void;
  /** Style overrides for the header and the list. */
  styles?: ConversationListSectionStyles;
  /** Extra class name(s) merged onto the list root, e.g. a host anchor. */
  listClassName?: string;
  /** Extra class name(s) merged onto the section root. */
  className?: string;
}
