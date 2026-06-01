/** A single conversation entry shown in the history panel. */
export interface ConversationHistoryItem {
  /** Unique conversation identifier (path or UUID). */
  id: string;
  /** Human-readable title — typically the first user message. */
  title: string;
  /** ISO-8601 timestamp of the last update. */
  updatedAt: string;
}

/** Font overrides for the header title in `ConversationPanel`. */
export interface ConversationHistoryTypography {
  /** Font family applied to the panel title. */
  fontFamily?: string;
  /** Font size applied to the panel title. */
  fontSize?: string;
  /** Font weight applied to the panel title. */
  fontWeight?: string | number;
  /** Line height applied to the panel title. */
  lineHeight?: string;
  /**
   * A single utility class (e.g. `'dial-body-semi-bold-text'`) applied to the title span.
   * When provided, individual font CSS vars are ignored in favour of this class.
   */
  fontClassName?: string;
}

/** CSS custom-property overrides for `ConversationPanel`. */
export interface ConversationHistoryColors {
  /** Panel background color. */
  background?: string;
  /** Inner-edge divider border color. */
  border?: string;
  /** Header bar bottom-border color. */
  headerBorder?: string;
  /** Hover background for a conversation row. */
  itemHover?: string;
  /** Active/selected background for a conversation row. */
  itemActive?: string;
  /** Primary text color. */
  text?: string;
  /** Secondary text color (dates, metadata). */
  textSecondary?: string;
}

/** Props accepted by `ConversationPanel`. */
export interface ConversationPanelProps {
  /** Ordered list of conversations to display. */
  conversations: ConversationHistoryItem[];
  /** Whether the panel is currently expanded. */
  isOpen: boolean;
  /** Called with the conversation `id` when a row is clicked. */
  onSelectConversation: (id: string) => void;
  /** `id` of the currently viewed conversation; that row gets `aria-current="page"`. */
  activeConversationId?: string;
  /** Panel heading text (e.g. `"Conversations"`). */
  title: string;
  /** Message shown when `conversations` is empty. */
  emptyLabel: string;
  /**
   * Formats a raw ISO-8601 `updatedAt` string into the display string shown on each row.
   * Called by the lib; formatting locale/logic is the caller's responsibility.
   */
  formatDate: (isoDate: string) => string;
  /** CSS custom-property overrides for theming. */
  colors?: ConversationHistoryColors;
  /** Font overrides for the panel header title. */
  typography?: ConversationHistoryTypography;
  /** Extra class name(s) merged onto the panel root element. */
  className?: string;
  /**
   * When provided and `isOpen` is `true`, a backdrop overlay is rendered behind the panel.
   * Clicking the backdrop calls this callback (used for mobile drawer close).
   */
  onBackdropClick?: () => void;
}
