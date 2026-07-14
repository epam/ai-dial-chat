/** CSS custom-property overrides for the `MessageSource` component. */
export interface MessageSourceColors {
  /** Button background color in the default state. */
  background?: string;
  /** Button border color in the default state. */
  border?: string;
  /** Label text color. */
  text?: string;
  /** Button background color on hover and active. */
  backgroundHover?: string;
  /** Button border color on hover and active. */
  borderHover?: string;
}

/** Typography overrides for the `MessageSource` component. */
export interface MessageSourceTypography {
  /** Tailwind (or custom) class applied to the button — takes precedence over the individual font properties below. */
  fontClassName?: string;
  /** Font size of the label (CSS value, e.g. `'10px'`). Ignored when `fontClassName` is set. */
  fontSize?: string;
  /** Font weight of the label. Ignored when `fontClassName` is set. */
  fontWeight?: string | number;
  /** Line height of the label (CSS value, e.g. `'0.75rem'`). Ignored when `fontClassName` is set. */
  lineHeight?: string;
}

/** Combined style overrides (colors and typography) for the `MessageSource` component. */
export interface MessageSourceStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: MessageSourceColors;
  /** Typography overrides applied via CSS custom properties. */
  typography?: MessageSourceTypography;
  /** Extra class name(s) merged onto the button element. */
  className?: string;
}

/** Props accepted by the `MessageSource` component. */
export interface MessageSourceProps {
  /** Text label displayed inside the button. */
  label: string;
  /** Called when the user clicks the source button. */
  onClick?: () => void;
  /** Color and typography overrides applied as CSS custom properties. */
  styles?: MessageSourceStyles;
}
