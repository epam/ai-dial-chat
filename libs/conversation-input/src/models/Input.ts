/** CSS custom-property overrides for the `Input` component. */
export interface InputColors {
  /** Input area background color. */
  background?: string;
  /** Typed text color. */
  text?: string;
  /** Border color in the default (unfocused) state. */
  border?: string;
  /** Border color when the input is focused. */
  borderFocus?: string;
  /** Placeholder text color. */
  placeholder?: string;
  /** Background color of the send button. */
  sendBackground?: string;
  /** Icon/text color of the send button. */
  sendText?: string;
}

/** Typography overrides for the `Input` component. */
export interface InputTypography {
  /** Font family applied to the textarea. */
  fontFamily?: string;
  /** Font size applied to the textarea (CSS value, e.g. `'14px'`). */
  fontSize?: string;
  /** Font weight applied to the textarea. */
  fontWeight?: string | number;
  /** Line height applied to the textarea (CSS value, e.g. `'1.5'`). */
  lineHeight?: string;
}

/** Props accepted by the `Input` component. */
export interface InputProps {
  /** Pre-filled message shown when the component mounts. */
  initialMessage?: string;
  /** Called on every keystroke with the current textarea value. */
  onChange?: (message: string) => void;
  /** Called when the user submits a message (Enter or send button). */
  onSend?: (message: string) => void;
  /** Placeholder text shown when the textarea is empty. */
  placeholder?: string;
  /** `aria-label` applied to the textarea for screen readers. */
  ariaLabel?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: InputColors;
  /** Typography overrides applied as CSS custom properties. */
  typography?: InputTypography;
  /** Extra class name(s) merged onto the root wrapper element. */
  className?: string;
}
