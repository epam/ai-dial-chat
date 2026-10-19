import { FilterTab } from '@epam/ai-dial-chat-shared';
import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import type { ReactNode } from 'react';
import type {
  ConversationListColors,
  ConversationListLabels,
  ConversationListTypography,
} from './conversation-list';

/** Labels for each filter tab. */
export interface FilterLabels {
  /** Label for the "All" tab. */
  all: string;
  /** Label for the "My chats" tab. */
  myChats: string;
  /** Label for the "Shared" tab. */
  shared: string;
  /** Label for the "Organization" tab. */
  organization: string;
  /** Accessible name of the filter row itself. Defaults to `"Filter chats"`. */
  groupAriaLabel?: string;
}

/** A single conversation entry shown in the history panel. */
export interface ConversationItem {
  /** Unique conversation identifier (path or UUID). */
  id: string;
  /** Human-readable conversation title. */
  title: string;
  /** When true the item is shown in the Pinned section. */
  isPinned?: boolean;
  /** Ownership/share source — used to filter by tab. */
  source?: FilterTab;
  /** URL of the model or conversation icon. When absent a default icon is shown. */
  iconUrl?: string;
  /** Tooltip text shown on the deployment icon. */
  iconTooltip?: string;
  /** When `true`, a skeleton placeholder is shown instead of the deployment icon. */
  isIconLoading?: boolean;
  /** Conversation URL. When provided, middle-click opens it in a new tab. */
  href?: string;
  /**
   * Decorative node rendered in the leading slot instead of the deployment
   * avatar (`iconUrl`, `iconTooltip` and `isIconLoading` are then ignored).
   * Its meaning belongs to the host; it should fit the 24px avatar footprint
   * and be `aria-hidden`, since the row is named by its title.
   */
  leadingIcon?: ReactNode;
  /**
   * When `true`, the title renders in a heavier weight and an unread dot with a
   * visually hidden label is rendered: at the row's trailing edge for `Avatar`
   * rows, as the leading dot for `Indicator` rows.
   */
  isUnread?: boolean;
}

/** Typography overrides for `ConversationPanel`; the list's own fields are inherited from `ConversationListTypography`. */
export interface ConversationPanelTypography extends ConversationListTypography {
  /** A single utility class (e.g. `'dial-body-semi-text'`) applied to the title span. */
  fontClassName?: string;
  /** Typography class applied to the New chat button label. Defaults to `'dial-small-semi-text'`. */
  newChatLabelClassName?: string;
  /** Class applied to each filter tab. Defaults to `'dial-tiny-semi-text'` (an additional `'flex-1'` class is always applied). */
  tabClassName?: string;
}

/** CSS custom-property overrides for the New chat button. */
export interface NewChatButtonColors {
  /** Default background. */
  background?: string;
  /** Label and icon color. */
  text?: string;
  /** Keyboard focus ring color. Defaults to `--stroke-focus`. */
  focusOutline?: string;
}

/** CSS custom-property overrides for `ConversationPanel`. */
export interface ConversationColors extends ConversationListColors {
  /** Panel background color. */
  background?: string;
  /** Inner-edge divider border color. */
  border?: string;
}

/** Combined style overrides (colors and typography) for `ConversationPanel`. */
export interface ConversationPanelStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ConversationColors;
  /** Color overrides forwarded to the New chat button. */
  newChatButton?: NewChatButtonColors;
  /** Typography overrides for the panel and its children. */
  typography?: ConversationPanelTypography;
  /** CSS class applied to the icon badge in each conversation row. Defaults to `'rounded-full'`. */
  itemIconBadgeClassName?: string;
  /**
   * Extra class name(s) merged onto the panel's header bar. The header is
   * `h-[64px]` by default; a `h-*` utility passed here replaces that height
   * rather than losing to it, so a host does not need `!important` on
   * `.dial-sb-header`.
   */
  headerClassName?: string;
  /** Extra class name(s) merged onto the header's trailing action cluster — `headerActions` and the panel toggle. */
  headerActionsClassName?: string;
  /**
   * Extra class name(s) merged onto the New chat button. Its `h-[36px]` height
   * and `shadow-chat-button` elevation are merged, not fixed, so a `h-*` or
   * `shadow-*` utility passed here replaces them. The corner radius is themed
   * separately, through the kit's `--radius-control`.
   */
  newChatButtonClassName?: string;
  /**
   * Extra CSS class merged onto the search field's wrapper. The wrapper's
   * corner radius is themed with the `--cp-search-radius` custom property, so
   * this is only needed for anything the panel's own stylesheet does not
   * cover; a `rounded-*` utility passed here still wins over that property.
   */
  searchWrapperClassName?: string;
}

/** Localised labels and text content for `ConversationPanel`; the list's own labels are inherited from `ConversationListLabels`. */
export interface ConversationPanelLabels extends ConversationListLabels {
  /** Panel heading text (e.g. `"Chats"`). */
  title: string;
  /** Label for the New chat button (e.g. `"New chat"`). */
  newChatLabel: string;
  /** Placeholder text for the search input (e.g. `"Search chat…"`). */
  searchPlaceholder: string;
  /** Accessible label for the search input clear button. */
  searchClearLabel: string;
  /** Labels for the four filter tabs. */
  filterLabels: FilterLabels;
  /** Accessible label for the sidebar toggle icon button. Required when `onToggle` is provided. */
  closeAriaLabel?: string;
}

/** Props accepted by `ConversationPanel`. */
export interface ConversationPanelProps {
  /** Ordered list of conversations to display. */
  conversations: ConversationItem[];
  /** When true, renders skeleton rows instead of the conversation list. */
  isLoading?: boolean;
  /** Whether the panel is currently expanded. */
  isOpen: boolean;
  /** Called with the conversation `id` when a row is clicked. */
  onSelectConversation: (id: string) => void;
  /** `id` of the currently viewed conversation; that row gets `aria-current="page"`. */
  activeConversationId?: string;
  /** Localised labels and text content for the panel. */
  labels: ConversationPanelLabels;
  /** Called when the New chat button is clicked. */
  onNewChat: () => void;
  /** Color and typography overrides applied as CSS custom properties. */
  styles?: ConversationPanelStyles;
  /** Extra class name(s) merged onto the panel root element. */
  className?: string;
  /**
   * Renders the panel as a drawer that slides over the content instead of
   * collapsing its width beside it. Set it when `className` positions the panel
   * over the page. Defaults to `false`.
   */
  isOverlay?: boolean;
  /** Builds dropdown actions for a row. When absent or empty, no action trigger is rendered. */
  getActions?: (item: ConversationItem) => DropdownItem[];
  /** Called when a row action menu opens; receives the trigger button. */
  onActionMenuOpen?: (
    item: ConversationItem,
    trigger: HTMLButtonElement,
  ) => void;
  /** Called when the panel header toggle button is clicked. When provided, the toggle is visible on mobile. */
  onToggle?: () => void;
  /** Extra content rendered in the panel header action area. */
  headerActions?: ReactNode;
  /**
   * Called when the user completes a drag-and-drop move.
   * See `ConversationMove` for the payload shape.
   */
  onMoveConversation?: (move: ConversationMove) => void;
  /** Programmatically sets the active filter tab. Pass `undefined` to leave the tab unchanged. */
  activeFilter?: FilterTab;
  /** Called when the active filter tab changes. */
  onActiveFilterChange?: (tab: FilterTab) => void;
  /**
   * When `true`, the filter tabs are not rendered and the list stays on
   * whichever tab is active — `FilterTab.All` unless `activeFilter` says
   * otherwise. Defaults to `false`.
   */
  isFilterTabsHidden?: boolean;
  /**
   * Sources to exclude entirely. A conversation whose `source` is listed here
   * is dropped before filtering/grouping, so it never appears under any tab
   * (including `All`) or in a group heading, and its tab pill is not rendered
   * in `FilterTabs`. Use this to fully gate a source (e.g. `Organization`)
   * behind a deployment/config toggle, as opposed to `isFilterTabsHidden`,
   * which only hides the tab row while leaving every source's conversations
   * visible under `All`.
   */
  hiddenSources?: FilterTab[];
}

/** Describes a completed drag-and-drop move in the conversation panel. */
export interface ConversationMove {
  /** Id of the conversation that was dragged. */
  draggedId: string;
  /** The group the item was dropped into. */
  targetGroupKey: FilterTab;
  /** Item to insert after; `null` means top of the target group. */
  afterId: string | null;
}
