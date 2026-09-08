import type { ReactNode } from 'react';

/** CSS custom property overrides for `EditorSection`. */
export interface EditorSectionColors {
  /** Border color of the section card. Defaults to `--stroke-tertiary`. */
  borderColor?: string;
  /** Color of the section title heading. Defaults to `--text-primary`. */
  titleColor?: string;
}

/** Style overrides for `EditorSection`. */
export interface EditorSectionStyles {
  /** Color token overrides. */
  colors?: EditorSectionColors;
}

/** Props for `EditorSection`. */
export interface EditorSectionProps {
  /** Optional heading rendered above the section body. */
  title?: string;
  /** Section body content. */
  children?: ReactNode;
  /** Optional style overrides applied via CSS custom properties. */
  styles?: EditorSectionStyles;
  /** Additional CSS class applied to the root element. */
  className?: string;
}
