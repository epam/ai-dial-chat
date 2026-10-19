import type { FilterTab } from '@epam/ai-dial-chat-shared';
import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import type { ConversationRowVariant } from '../types/conversation-row-variant';
import type { ConversationItem, ConversationMove } from './panel-props';

/** CSS custom-property overrides for the conversation list and its rows. */
export interface ConversationListColors {
  /** Hover background for a conversation row. */
  itemHover?: string;
  /** Active/selected background for a conversation row. */
  itemActive?: string;
  /** Primary text color. */
  text?: string;
  /** Secondary text color (dates, metadata). */
  textSecondary?: string;
  /** Ring color shown around a group header acting as a drag-and-drop target. */
  dropZoneRing?: string;
  /** Background color of the active row actions trigger button. */
  triggerBackground?: string;
  /** Icon color of the row actions trigger button while active. */
  triggerIcon?: string;
  /** Icon color of the row actions trigger button in its idle state. */
  triggerIconIdle?: string;
  /** Shimmer color of the loading skeleton avatar. */
  skeletonColor?: string;
  /** Fill color of the unread indicator dot. Defaults to `--text-accent`. */
  unreadDot?: string;
  /** Border color of the read indicator dot of `Indicator` rows. Defaults to `--stroke-secondary`. */
  indicatorDot?: string;
}

/** Typography overrides for the conversation list. */
export interface ConversationListTypography {
  /** Typography class applied to collapsible group header buttons. Defaults to `'dial-tiny-lead-text'`. */
  groupHeaderClassName?: string;
  /** Typography class applied to conversation title text in each row. Defaults to `'dial-small-text'`. */
  itemTitleClassName?: string;
}

/** Style overrides for `ConversationList`. */
export interface ConversationListStyles {
  /** Color overrides applied as CSS custom properties on the list root. */
  colors?: ConversationListColors;
  /** Typography overrides for group headers and row titles. */
  typography?: ConversationListTypography;
  /** CSS class applied to the icon badge in each conversation row. Defaults to `'rounded-full'`. */
  itemIconBadgeClassName?: string;
}

/** Localised labels for `ConversationList`. */
export interface ConversationListLabels {
  /** Message shown when `conversations` is empty. */
  emptyLabel: string;
  /** Message shown when conversations exist but none match the filter and search. */
  noResultsLabel: string;
  /** Status message announced to assistive tech while conversations are loading. Defaults to `'Loading conversations'`. */
  loadingLabel?: string;
  /** Labels for collapsible group section headings. */
  groupLabels?: {
    /** Heading for the Pinned section. Defaults to `"Pinned"`. */
    pinned?: string;
    /** Heading for the My chats section. Defaults to `"My chats"`. */
    myChats?: string;
    /** Heading for the Shared section. Defaults to `"Shared"`. */
    shared?: string;
    /** Heading for the Organization section. Defaults to `"Organization"`. */
    organization?: string;
  };
  /** Accessible label for the row actions trigger button. Defaults to `"More actions"`. */
  actionsLabel?: string;
  /** Accessible (visually hidden) label announced for the unread indicator dot. Defaults to `"Unread"`. */
  unreadIndicatorLabel?: string;
}

/** Props accepted by `ConversationList`. */
export interface ConversationListProps {
  /** Ordered list of conversations to display. */
  conversations: ConversationItem[];
  /** When true, renders skeleton rows instead of the conversation list. */
  isLoading?: boolean;
  /** Called with the conversation `id` when a row is clicked. */
  onSelectConversation: (id: string) => void;
  /** `id` of the currently viewed conversation; that row gets `aria-current="page"`. */
  activeConversationId?: string;
  /** Localised labels for the list. */
  labels: ConversationListLabels;
  /** Current search text. Rows whose title does not contain it are dropped and matches are highlighted. Defaults to `''`. */
  searchQuery?: string;
  /** Filter tab applied to the list. Defaults to `FilterTab.All`. */
  activeFilter?: FilterTab;
  /** Sources to exclude entirely, before filtering and grouping. */
  hiddenSources?: FilterTab[];
  /** Presentation of rows and group headers. Defaults to `ConversationRowVariant.Avatar`. */
  rowVariant?: ConversationRowVariant;
  /** Builds dropdown actions for a row. When absent or empty, no action trigger is rendered. */
  getActions?: (item: ConversationItem) => DropdownItem[];
  /** Called when a row action menu opens; receives the trigger button. */
  onActionMenuOpen?: (
    item: ConversationItem,
    trigger: HTMLButtonElement,
  ) => void;
  /** Called when the user completes a drag-and-drop move. */
  onMoveConversation?: (move: ConversationMove) => void;
  /** Style overrides for colors, typography and the row icon badge. */
  styles?: ConversationListStyles;
  /** `id` of the list root, for a header's `aria-controls` to reference. */
  id?: string;
  /** Extra class name(s) merged onto the list root. */
  className?: string;
}
