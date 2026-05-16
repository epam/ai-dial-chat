import type { InputColors, InputTypography } from './Input.js';

export interface ConversationInputColors {
  background?: string;
  welcomeText?: string;
  input?: InputColors;
}

export interface ConversationInputTypography {
  welcomeClassName?: string;
  welcomeFontSize?: string;
  welcomeFontWeight?: string | number;
  welcomeLineHeight?: string | number;
  input?: InputTypography;
}

export interface ConversationInputProps {
  placeholder?: string;
  initialMessage?: string;
  welcomeText?: string;
  onSend?: (message: string) => void;
  colors?: ConversationInputColors;
  typography?: ConversationInputTypography;
  className?: string;
}
