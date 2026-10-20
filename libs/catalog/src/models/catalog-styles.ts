import type { CSSProperties } from 'react';

/** Color overrides for the Create menu's section rows, applied as CSS custom properties with app theme fallbacks. */
export interface CreateMenuColors {
  /** Line between the menu's sections in the mobile sheet. Fallback: `--stroke-tertiary`. */
  divider?: string;
  /** Text color of a section header in the mobile sheet. Fallback: `--text-secondary`. */
  sectionHeaderText?: string;
}

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
  /** Colors of the Create menu's section rows in the mobile sheet. */
  createMenu?: CreateMenuColors;
}

/** Typography overrides for the Catalog component. */
export interface CatalogTypography {
  /** A single utility class applied to the page heading. Defaults to `'dial-display2-text'`. */
  pageHeadingFontClassName?: string;
  /** Typography class applied to tab text. Defaults to `'dial-body-text'`. */
  tabClassName?: string;
  /** Typography class of a Create menu section header in the mobile sheet. Defaults to `'dial-caption-text'`. */
  createMenuSectionHeaderClassName?: string;
}

/** Combined style overrides (colors and typography) for the Catalog component. */
export interface CatalogStyles {
  /** Color customizations applied as CSS custom properties. */
  colors?: CatalogColors;
  /** Typography customizations and class overrides. */
  typography?: CatalogTypography;
  /** Height and vertical padding classes of the page heading row. Replaces the default `'h-[64px]'`. */
  headingRowClassName?: string;
}
