export interface InputColors {
  background?: string;
  text?: string;
  border?: string;
  borderFocus?: string;
  placeholder?: string;
  sendBackground?: string;
  sendText?: string;
}

export interface InputTypography {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string | number;
  lineHeight?: string;
}

export interface InputProps {
  initialMessage?: string;
  onChange?: (message: string) => void;
  onSend?: (message: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  colors?: InputColors;
  typography?: InputTypography;
  className?: string;
}
