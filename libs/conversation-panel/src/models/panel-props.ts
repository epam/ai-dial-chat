import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import type { ReactNode } from 'react';
import { FilterTab } from '../types/conversation-classification';

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
}

/** Font overrides for the header title in `ConversationPanel`. */
export interface ConversationPanelTypography {
  /** A single utility class (e.g. `'dial-body-semi-text'`) applied to the title span. */
  fontClassName?: string;
  /** Typography class applied to collapsible group header buttons. Defaults to `'dial-tiny-semi-text uppercase'`. */
  groupHeaderClassName?: string;
  /** Typography class applied to conversation title text in each row. Defaults to `'dial-small-text'`. */
  itemTitleClassName?: string;
  /** Typography class applied to the New chat button label. Defaults to `'dial-small-semi-text'`. */
  newChatLabelClassName?: string;
  /** Class applied to each filter tab. Defaults to `'dial-tiny-semi-text'` (an additional `'flex-1'` class is always applied). */
  tabClassName?: string;
}

/** CSS custom-property overrides for the New chat button. */
export interface NewChatButtonColors {
  /** Default background. */
  background?: string;
  /** Hover background. */
  hoverBackground?: string;
  /** Active/pressed background. */
  activeBackground?: string;
  /** Label and icon color. */
  text?: string;
  /** Blue shadow in the default state. */
  shadowBlue?: string;
  /** Blue shadow on hover. */
  shadowBlueHover?: string;
  /** Blue shadow while active/pressed. */
  shadowBlueActive?: string;
  /** Purple shadow in the default state. */
  shadowPurple?: string;
  /** Purple shadow on hover. */
  shadowPurpleHover?: string;
  /** Purple shadow while active/pressed. */
  shadowPurpleActive?: string;
}

/** CSS custom-property overrides for `ConversationPanel`. */
export interface ConversationColors {
  /** Panel background color. */
  background?: string;
  /** Inner-edge divider border color. */
  border?: string;
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
}

/** Localised labels and text content for `ConversationPanel`. */
export interface ConversationPanelLabels {
  /** Panel heading text (e.g. `"Chats"`). */
  title: string;
  /** Message shown when `conversations` is empty. */
  emptyLabel: string;
  /** Message shown when conversations exist but none match the active filter. */
  noResultsLabel: string;
  /** Status message announced to assistive tech while conversations are loading. Defaults to `'Loading conversations'`. */
  loadingLabel?: string;
  /** Label for the New chat button (e.g. `"New chat"`). */
  newChatLabel: string;
  /** Placeholder text for the search input (e.g. `"Search chat…"`). */
  searchPlaceholder: string;
  /** Accessible label for the search input clear button. */
  searchClearLabel: string;
  /** Labels for the four filter tabs. */
  filterLabels: FilterLabels;
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
