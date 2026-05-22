import type { Attachment } from '@epam/ai-dial-chat-shared';
import type { InputColors, InputTypography } from './Input.js';

/** CSS custom-property overrides for the `ConversationInput` component. */
export interface ConversationInputColors {
  /** Root container background color. */
  background?: string;
  /** Welcome heading text color. */
  welcomeText?: string;
  /** Color overrides forwarded to the inner `Input` component. */
  input?: InputColors;
}

/** Typography overrides for the `ConversationInput` component. */
export interface ConversationInputTypography {
  /** Tailwind (or custom) class applied to the welcome heading — takes precedence over the individual font properties below. */
  welcomeClassName?: string;
  /** Font family of the welcome heading (CSS value, e.g. `"'Inter', sans-serif"`). Ignored when `welcomeClassName` is set. */
  welcomeFontFamily?: string;
  /** Font size of the welcome heading (CSS value, e.g. `'24px'`). Ignored when `welcomeClassName` is set. */
  welcomeFontSize?: string;
  /** Font weight of the welcome heading. Ignored when `welcomeClassName` is set. */
  welcomeFontWeight?: string | number;
  /** Line height of the welcome heading. Ignored when `welcomeClassName` is set. */
  welcomeLineHeight?: string | number;
  /** Typography overrides forwarded to the inner `Input` component. */
  input?: InputTypography;
}

/** Props accepted by the `ConversationInput` component. */
export interface ConversationInputProps {
  /** Placeholder text shown inside the textarea when empty. */
  placeholder?: string;
  /** Pre-filled message shown when the component mounts. */
  initialMessage?: string;
  /** Optional welcome heading rendered above the input. */
  welcomeText?: string;
  /** Called when the user submits a message (Enter or send button). */
  onSend?: (message: string) => void;
  /** Called when the user clicks the stop button during streaming. */
  onStop?: () => void;
  /** When `true`, shows a stop button instead of the send button and blocks Enter. */
  isStreaming?: boolean;
  /** Called whenever the attachment list changes. */
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  /** Color overrides applied as CSS custom properties. */
  colors?: ConversationInputColors;
  /** Typography overrides for the welcome heading and input. */
  typography?: ConversationInputTypography;
  /** Extra class name(s) merged onto the root wrapper element. */
  className?: string;
}
