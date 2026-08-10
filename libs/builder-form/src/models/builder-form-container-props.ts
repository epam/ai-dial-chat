import type { CSSProperties, ReactNode } from 'react';
import type {
  BuilderFormHeaderLabels,
  BuilderFormHeaderStyles,
} from './builder-form-header-props';

/**
 * Color overrides for the {@link BuilderFormContainer} component, applied as
 * CSS custom properties with app theme fallbacks.
 */
export interface BuilderFormContainerColors {
  /** Container background. Fallback: `--bg-layer-base`. */
  background?: string;
}

/** Style overrides for the {@link BuilderFormContainer} component. */
export interface BuilderFormContainerStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: BuilderFormContainerColors;
  /** Style overrides forwarded to the header. */
  header?: BuilderFormHeaderStyles;
  /**
   * Arbitrary CSS custom properties applied to the container's root element,
   * so vars read anywhere in the form cascade from a single place. Merged
   * after `colors`, so they can override it.
   */
  cssVars?: CSSProperties;
}

/** Props for the {@link BuilderFormContainer} component. */
export interface BuilderFormContainerProps {
  /** Localized labels for the header. */
  labels: BuilderFormHeaderLabels;
  /** Called when the user activates the header's back control. */
  onBack: () => void;
  /** Called when the user activates the header's cancel action. */
  onCancel: () => void;
  /** Called when the user activates the header's submit action. */
  onSubmit: () => void;
  /** When `true`, the header's cancel action is disabled. Defaults to `false`. */
  isCancelDisabled?: boolean;
  /** When `true`, the header's submit action is disabled. Defaults to `false`. */
  isSubmitDisabled?: boolean;
  /** Body's start-edge column. Full width on mobile, a fixed-width column on desktop. */
  left?: ReactNode;
  /** Body's main column, filling the space left by `left` and `metadata`. */
  children: ReactNode;
  /** Body's end-edge column, matching `left`'s width. When omitted while `left` is set, an empty column of the same width is reserved so the main column stays optically centered. */
  metadata?: ReactNode;
  /** Style overrides. */
  styles?: BuilderFormContainerStyles;
}
