/**
 * Color overrides for the Catalog component.
 * All values are applied as CSS custom properties with app theme fallbacks.
 */
export interface CatalogColors {
  /** Root container background color. Fallback: `--bg-layer-1`. */
  background?: string;
  /** Heading title text color. Fallback: `--text-primary`. */
  headingTitleText?: string;
  /** "Create" dropdown menu surface color. Fallback: `--bg-layer-raised`. */
  createMenuBackground?: string;
  /** "Create" menu item background on hover/focus. Fallback: `--bg-layer-raised`. */
  createItemHoverBackground?: string;
  /** "Create" menu item focus-visible outline color. Fallback: `--text-accent`. */
  createItemFocusOutline?: string;
  /** "Create" menu item label color. Fallback: `--text-primary`. */
  createItemLabelText?: string;
  /** "Create" menu item description color. Fallback: `--text-secondary`. */
  createItemDescriptionText?: string;
}

/** Typography overrides for the Catalog component. */
export interface CatalogTypography {
  /** A single utility class (e.g. `'dial-h2-text'`) applied to the page heading. */
  pageHeadingFontClassName?: string;
  /** Typography class applied to tab text. Defaults to `'dial-body-text'`. */
  tabClassName?: string;
}

/** Combined style overrides (colors and typography) for the Catalog component. */
export interface CatalogStyles {
  /** Color customizations applied as CSS custom properties. */
  colors?: CatalogColors;
  /** Typography customizations and class overrides. */
  typography?: CatalogTypography;
}
