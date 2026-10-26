import type { FilterTab } from '@epam/ai-dial-chat-shared';
import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import type { ConversationTypeFilter } from '../types/conversation-kind';
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
  /** Border color of the read indicator dot of `Indicator` rows; no effect on `Avatar` rows, so none in `ConversationPanel`. Defaults to `--stroke-secondary`. */
  indicatorDot?: string;
}

/** Typography overrides for the conversation list. */
export interface ConversationListTypography {
  /** Typography class applied to the list root, inherited by rows and group headers that set none of their own. */
  fontClassName?: string;
  /** `font-family` applied to the list root. */
  fontFamily?: string;
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

/** Empty-state text for one filter tab; a field left out falls back to the generic no-results text. */
export interface FilterEmptyLabels {
  /** Heading shown instead of `noResultsLabel`. */
  label?: string;
  /** Secondary line shown instead of `noResultsDescription`. */
  description?: string;
}

/** Localised labels for `ConversationList`. */
export interface ConversationListLabels {
  /** Message shown when the list is empty with no search or filter applied. */
  emptyLabel: string;
  /** Secondary line under `emptyLabel`, e.g. what will fill the list. Omitted when not set. */
  emptyDescription?: string;
  /** Message shown when a search or a filter matches no conversation. */
  noResultsLabel: string;
  /** Secondary line under `noResultsLabel`, e.g. how to widen the search. Omitted when not set. */
  noResultsDescription?: string;
  /** Secondary line under `noResultsLabel` when the `Shared` filter matches nothing and no search is typed. Defaults to `noResultsDescription`. */
  sharedEmptyDescription?: string;
  /**
   * Empty-state text per filter tab, used when that tab alone narrows the list to
   * nothing (no search typed, type filter at `All`). Takes precedence over
   * `noResultsLabel`, `noResultsDescription` and `sharedEmptyDescription`.
   */
  tabEmptyLabels?: Partial<Record<FilterTab, FilterEmptyLabels>>;
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
  /** Which kinds of conversation to show. Defaults to `ConversationTypeFilter.All`. */
  activeTypeFilter?: ConversationTypeFilter;
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
