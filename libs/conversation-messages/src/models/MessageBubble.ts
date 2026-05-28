import type {
  DisplayAttachment,
  MessageRole,
  StarterOption,
} from '@epam/ai-dial-chat-shared';
import type { BubblePosition } from '../types/bubble-position.js';
import type { MessageActionsProps } from './MessageActions.js';

/** CSS custom-property overrides for message bubble components. */
export interface MessageBubbleColors {
  /** Background color of the user message bubble. */
  userBackground?: string;
  /** Text color applied to all message bubbles. */
  text?: string;
  /** Border color of the divider line above quick-reply starter buttons. Falls back to `--color-secondary` when omitted. */
  startersDivider?: string;
}

/** Typography overrides for message bubble components. */
export interface MessageBubbleTypography {
  /** Tailwind (or custom) class applied to message text — takes precedence over the individual font properties below. */
  fontClassName?: string;
  /** Font family of message text (CSS value, e.g. `"'Inter', sans-serif"`). Ignored when `fontClassName` is set. */
  fontFamily?: string;
  /** Font size of message text (CSS value, e.g. `'16px'`). Ignored when `fontClassName` is set. */
  fontSize?: string;
  /** Font weight of message text. Ignored when `fontClassName` is set. */
  fontWeight?: string | number;
  /** Line height of message text (CSS value, e.g. `'1.5'`). Ignored when `fontClassName` is set. */
  lineHeight?: string;
}

/** Shared props for user and assistant message bubble components. */
interface BaseMessageBubbleProps {
  /** Plain-text (or Markdown) content of the message. */
  text: string;
  /** Extra class name(s) merged onto the outer row wrapper. */
  className?: string;
  /** Extra class name(s) merged onto the bubble element itself. */
  bubbleClassName?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: MessageBubbleColors;
  /** Typography overrides applied as CSS custom properties. */
  typography?: MessageBubbleTypography;
  /** Props forwarded to the `MessageActions` bar rendered below the bubble. */
  actions?: MessageActionsProps;
  /** When `true`, the actions bar is always visible instead of appearing only on group hover. */
  alwaysVisibleActions?: boolean;
  /** Display attachments associated with the message. Rendered above text for user messages and below text for assistant messages. */
  attachments?: DisplayAttachment[];
}

/** Props accepted by the `UserMessageBubble` component. */
export interface UserMessageBubbleProps extends BaseMessageBubbleProps {
  /** Position within a message group — controls which corner is rounded. Defaults to `BubblePosition.Bottom`. */
  position?: BubblePosition;
}

/** Props accepted by the `AssistantMessageBubble` component. */
export interface AssistantMessageBubbleProps extends BaseMessageBubbleProps {
  /**
   * Quick-reply buttons derived from the assistant message's `form_schema`.
   * Rendered below the message text when the array is non-empty.
   */
  starters?: StarterOption[];
  /** Called with the selected `StarterOption` when a quick-reply button is clicked. */
  onSelectStarter?: (starter: StarterOption) => void;
  /** Accessible label for the quick-reply buttons list. Defaults to `"Quick reply buttons"`. */
  startersAriaLabel?: string;
}

/** Props accepted by the `MessageBubble` role-switching wrapper. */
export interface MessageBubbleProps extends BaseMessageBubbleProps {
  /** Whether the message was authored by the user or the assistant. */
  role: MessageRole;
  /** Position within a message group — controls which corner is rounded (user messages only). Defaults to `BubblePosition.Bottom`. */
  position?: BubblePosition;
  /**
   * Quick-reply buttons derived from the assistant message's `form_schema`.
   * Forwarded to `AssistantMessageBubble`; ignored for user messages.
   */
  starters?: StarterOption[];
  /** Called with the selected `StarterOption` when a quick-reply button is clicked. Forwarded to `AssistantMessageBubble`. */
  onSelectStarter?: (starter: StarterOption) => void;
  /** Accessible label for the quick-reply buttons list. Forwarded to `AssistantMessageBubble`; ignored for user messages. */
  startersAriaLabel?: string;
}
