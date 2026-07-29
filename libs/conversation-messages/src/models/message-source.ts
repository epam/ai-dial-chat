/** CSS custom-property overrides for `MessageSource`. */
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

/** Typography overrides for `MessageSource`. */
export interface MessageSourceTypography {
  /** Tailwind (or custom) class applied to the button. */
  fontClassName?: string;
}

/** Color and typography overrides for `MessageSource`. */
export interface MessageSourceStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: MessageSourceColors;
  /** Typography overrides applied via CSS custom properties. */
  typography?: MessageSourceTypography;
  /** Extra class(es) on the button. */
  className?: string;
}

/** Localised strings for `MessageSource`. */
export interface MessageSourceLabels {
  /** Button label text. */
  label: string;
}

/** Props for the `MessageSource` component. */
export interface MessageSourceProps {
  /** User-visible strings. */
  labels: MessageSourceLabels;
  /** Fires on click. */
  onClick?: () => void;
  /** Color and typography overrides applied as CSS custom properties. */
  styles?: MessageSourceStyles;
}
