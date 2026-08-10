/** Localized labels used by the {@link BuilderFormHeader} component. */
export interface BuilderFormHeaderLabels {
  /** Title shown next to the back control. */
  title: string;
  /** Accessible label for the back control. */
  backButtonLabel: string;
  /** Label for the cancel action. */
  cancelButtonLabel: string;
  /** Label for the submit action. */
  submitButtonLabel: string;
}

/**
 * Color overrides for the {@link BuilderFormHeader} component, applied as CSS
 * custom properties with app theme fallbacks.
 */
export interface BuilderFormHeaderColors {
  /** Header's bottom border color. Fallback: `--stroke-tertiary`. */
  borderColor?: string;
}

/** Typography overrides for the {@link BuilderFormHeader} component. */
export interface BuilderFormHeaderTypography {
  /** CSS class applied to the title. Defaults to `'dial-h1-text'`. */
  fontClassName?: string;
  /** Font family applied to the title. Ignored when `fontClassName` is set. */
  fontFamily?: string;
}

/** Style overrides for the {@link BuilderFormHeader} component. */
export interface BuilderFormHeaderStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: BuilderFormHeaderColors;
  /** Typography overrides applied to the title. */
  typography?: BuilderFormHeaderTypography;
}

/** Props for the {@link BuilderFormHeader} component. */
export interface BuilderFormHeaderProps {
  /** Localized labels. */
  labels: BuilderFormHeaderLabels;
  /** Called when the user activates the back control. */
  onBack: () => void;
  /** Called when the user activates the cancel action. */
  onCancel: () => void;
  /** Called when the user activates the submit action. */
  onSubmit: () => void;
  /** When `true`, the cancel action is disabled. Defaults to `false`. */
  isCancelDisabled?: boolean;
  /** When `true`, the submit action is disabled. Defaults to `false`. */
  isSubmitDisabled?: boolean;
  /** Style overrides. */
  styles?: BuilderFormHeaderStyles;
}
