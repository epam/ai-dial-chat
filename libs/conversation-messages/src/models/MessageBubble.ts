import type {
  DisplayAttachment,
  MessageRole,
  StarterOption,
} from '@epam/ai-dial-chat-shared';
import type { ReactNode } from 'react';
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

/** Combined style overrides (colors and typography) for message bubble components. */
export interface MessageBubbleStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: MessageBubbleColors;
  /** Typography overrides applied via CSS custom properties. */
  typography?: MessageBubbleTypography;
}

/** Shared props for user and assistant message bubble components. */
interface BaseMessageBubbleProps {
  /** Plain-text (or Markdown) content of the message. */
  text: string;
  /** Extra class name(s) merged onto the outer row wrapper. */
  className?: string;
  /** Extra class name(s) merged onto the bubble element itself. */
  bubbleClassName?: string;
  /** Color and typography overrides applied as CSS custom properties. */
  styles?: MessageBubbleStyles;
  /** Props forwarded to the `MessageActions` bar rendered below the bubble. */
  actions?: MessageActionsProps;
  /** When `true`, the actions bar is always visible instead of appearing only on group hover. */
  hasAlwaysVisibleActions?: boolean;
  /** When `true`, assistant markdown text reveals newly appended content smoothly. */
  isStreaming?: boolean;
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
  /** Content rendered between the message body and the actions bar (e.g. a stages panel). */
  afterContent?: ReactNode;
  /**
   * Resolved URL for the deployment icon shown in the message header.
   * When absent (e.g. legacy messages without a stored `deploymentId`), no icon is rendered.
   */
  deploymentIconUrl?: string;
  /** Human-readable deployment name shown as the icon's accessible label. */
  deploymentDisplayName?: string;
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
  /** Content rendered between the message body and the actions bar. Forwarded to `AssistantMessageBubble`; ignored for user messages. */
  afterContent?: ReactNode;
  /**
   * Resolved deployment icon URL. Forwarded to `AssistantMessageBubble` when role is `Assistant`;
   * used to render the `StatusMessageBubble` icon when role is `Status`.
   * Omitted for legacy messages that pre-date this feature.
   */
  deploymentIconUrl?: string;
  /** Human-readable deployment name. Forwarded to `AssistantMessageBubble`; used in status message text when role is `Status`. */
  deploymentDisplayName?: string;
  /**
   * Bold prefix text for the status message banner.
   * Only used when `role === MessageRole.Status`. Defaults to `"Model switched."`.
   */
  statusTitleText?: string;
  /**
   * Full description text for the status message banner, e.g. "The model has been switched from GPT to Imagen."
   * Required when `role === MessageRole.Status`.
   */
  statusBodyText?: string;
}
