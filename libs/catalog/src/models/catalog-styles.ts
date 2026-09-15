import type { CSSProperties } from 'react';

/**
 * Color overrides for the Catalog component.
 * All values are applied as CSS custom properties with app theme fallbacks.
 */
export interface CatalogColors {
  /** Root container background color. Fallback: `--bg-layer-base`. */
  background?: string;
  /** Heading title text color. Fallback: `--text-primary`. */
  headingTitleText?: string;
  /**
   * Featured chip style override, applied to every "Featured" chip in the
   * catalog (both the browse-grid cards and the item details header)
   * regardless of entity type, merged over the chip's default per-entity-type
   * colors, e.g. `{ backgroundColor, color, border }`.
   */
  featuredChipStyle?: CSSProperties;
}

/** Typography overrides for the Catalog component. */
export interface CatalogTypography {
  /** A single utility class applied to the page heading. Defaults to `'dial-display2-text'`. */
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
