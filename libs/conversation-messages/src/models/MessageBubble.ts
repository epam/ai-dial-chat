import type { MessageRole } from '@epam/ai-dial-chat-shared';
import type { BubblePosition } from '../types/bubble-position.js';

/** CSS custom-property overrides for the `MessageBubble` component. */
export interface MessageBubbleColors {
  /** Background color of the user message bubble. */
  userBackground?: string;
  /** Text color applied to all message bubbles. */
  text?: string;
}

/** Typography overrides for the `MessageBubble` component. */
export interface MessageBubbleTypography {
  /** Tailwind (or custom) class applied to message text — takes precedence over the individual font properties below. */
  fontClassName?: string;
  /** Font size of message text (CSS value, e.g. `'16px'`). Ignored when `fontClassName` is set. */
  fontSize?: string;
  /** Font weight of message text. Ignored when `fontClassName` is set. */
  fontWeight?: string | number;
  /** Line height of message text (CSS value, e.g. `'1.5'`). Ignored when `fontClassName` is set. */
  lineHeight?: string;
}

/** Props accepted by the `MessageBubble` component. */
export interface MessageBubbleProps {
  /** Plain-text (or Markdown) content of the message. */
  text: string;
  /** Whether the message was authored by the user or the assistant. */
  role: MessageRole;
  /** Position within a message group — controls which corner is rounded. Defaults to `BubblePosition.Bottom`. */
  position?: BubblePosition;
  /** Extra class name(s) merged onto the outer row wrapper. */
  className?: string;
  /** Extra class name(s) merged onto the bubble element itself. */
  bubbleClassName?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: MessageBubbleColors;
  /** Typography overrides applied as CSS custom properties. */
  typography?: MessageBubbleTypography;
}
