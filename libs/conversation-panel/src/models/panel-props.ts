import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import type { ReactNode } from 'react';
import { FilterTab } from '../types/conversation-classification';

/** Labels for each filter tab — provided as props so the app supplies i18n strings. */
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
  /** Human-readable title — typically the first user message. */
  title: string;
  /** When true the item is shown in the Pinned section. */
  isPinned?: boolean;
  /** Ownership/share source — used to filter by tab. */
  source?: FilterTab;
  /** URL of the model or conversation icon. When absent a default icon is shown. */
  iconUrl?: string;
  /** Tooltip text shown on the deployment icon. Typically the agent or model display name. */
  iconTooltip?: string;
  /** When `true`, a skeleton placeholder is shown instead of the deployment icon. */
  isIconLoading?: boolean;
  /**
   * Browser-navigable URL for the conversation (e.g. `/conversations/<id>`).
   * When provided, a middle mouse button click on the row opens this URL in a new tab,
   * matching standard browser link behaviour.
   */
  href?: string;
}

/** Font overrides for the header title in `ConversationPanel`. */
export interface ConversationPanelTypography {
  /** A single utility class (e.g. `'dial-body-semi-text'`) applied to the title span. */
  fontClassName?: string;
  /** Typography class applied to collapsible group header buttons. Defaults to `'text-xs font-semibold'`. */
  groupHeaderClassName?: string;
  /** Typography class applied to conversation title text in each row. Defaults to `'text-sm'`. */
  itemTitleClassName?: string;
  /** Typography class applied to the New chat button label. Defaults to `'dial-small-text'`. */
  newChatLabelClassName?: string;
  /** Class applied to each filter tab. Defaults to `'flex-1 dial-tiny-semi-text'`. */
  tabClassName?: string;
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
  /** Hover background of the New chat button. */
  newChatHoverBackground?: string;
  /** Active/pressed background of the New chat button. */
  newChatActiveBackground?: string;
  /** Background of the New chat button. */
  newChatBackground?: string;
  /** Label/icon text color of the New chat button. */
  newChatText?: string;
  /** Blue shadow color of the New chat button in the default state. */
  newChatShadowBlue?: string;
  /** Blue shadow color of the New chat button on hover. */
  newChatShadowBlueHover?: string;
  /** Blue shadow color of the New chat button while active/pressed. */
  newChatShadowBlueActive?: string;
  /** Purple shadow color of the New chat button in the default state. */
  newChatShadowPurple?: string;
  /** Purple shadow color of the New chat button on hover. */
  newChatShadowPurpleHover?: string;
  /** Purple shadow color of the New chat button while active/pressed. */
  newChatShadowPurpleActive?: string;
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
  /** Typography overrides for the panel and its children. */
  typography?: ConversationPanelTypography;
  /** Text color class applied to each filter tab label. Defaults to `'text-primary'`. */
  tabColorClassName?: string;
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
  /**
   * Builds the dropdown menu items for a conversation row.
   * Receives the full item so actions can reflect per-item state (e.g. `isPinned` toggle).
   * When omitted or returns an empty array, no actions trigger is rendered on rows.
   */
  getActions?: (item: ConversationItem) => DropdownItem[];
  /** Called when a row action menu opens, exposing its trigger for host-owned focus restoration. */
  onActionMenuOpen?: (item: ConversationItem, trigger: HTMLButtonElement) => void;
  /**
   * Called when the mobile sidebar toggle icon in the panel header is clicked.
   * When provided, the toggle button becomes visible on mobile screens.
   * The parent is responsible for managing `isOpen` state in response to this callback.
   */
  onToggle?: () => void;
  /**
   * Content rendered in the end action group of the panel header bar.
   * The app supplies any ReactNode — the library does not prescribe its content.
   */
  headerActions?: ReactNode;
  /**
   * Called when the user completes a valid drag-and-drop move.
   * `draggedId` is the conversation that was moved.
   * `targetGroupKey` is the group it was dropped into.
   * `afterId` is the id of the item the dragged conversation should be placed after,
   * or `null` when dropped at the top of the target group.
   *
   * The app derives the action type from `targetGroupKey`:
   * - dropping into `Pinned` → pin the conversation
   * - dragging from `Pinned` into another group → unpin
   * - same-group drop → reorder
   */
  onMoveConversation?: (move: ConversationMove) => void;
  /**
   * Imperatively sets the active filter tab. When provided the panel switches
   * to this tab; the user can still change it afterwards. Pass `undefined` to
   * leave the current tab unchanged.
   */
  activeFilter?: FilterTab;
  /**
   * Called whenever the active filter tab changes — either because the user
   * clicked a tab or because `activeFilter` drove a programmatic switch.
   */
  onActiveFilterChange?: (tab: FilterTab) => void;
}

/** Describes a completed drag-and-drop move in the conversation panel. */
export interface ConversationMove {
  /** Id of the conversation that was dragged. */
  draggedId: string;
  /** The group the item was dropped into. */
  targetGroupKey: FilterTab;
  /**
   * Id of the item the dragged conversation should be placed after.
   * `null` means the item was dropped at the top of the target group.
   */
  afterId: string | null;
}
