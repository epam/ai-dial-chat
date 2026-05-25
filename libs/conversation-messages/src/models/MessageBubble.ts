import type { DisplayAttachment, MessageRole } from '@epam/ai-dial-chat-shared';
import type { BubblePosition } from '../types/bubble-position.js';
import type { MessageActionsProps } from './MessageActions.js';

/** CSS custom-property overrides for message bubble components. */
export interface MessageBubbleColors {
  /** Background color of the user message bubble. */
  userBackground?: string;
  /** Text color applied to all message bubbles. */
  text?: string;
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
export type AssistantMessageBubbleProps = BaseMessageBubbleProps;

/** Props accepted by the `MessageBubble` role-switching wrapper. */
export interface MessageBubbleProps extends BaseMessageBubbleProps {
  /** Whether the message was authored by the user or the assistant. */
  role: MessageRole;
  /** Position within a message group — controls which corner is rounded (user messages only). Defaults to `BubblePosition.Bottom`. */
  position?: BubblePosition;
}
