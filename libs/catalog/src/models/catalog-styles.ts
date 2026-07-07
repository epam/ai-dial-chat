/**
 * Color overrides for the Catalog component.
 * All values are applied as CSS custom properties with app theme fallbacks.
 */
export interface CatalogColors {
  /** Root container background color. Fallback: `--bg-layer-1`. */
  background?: string;
  /** Primary text color. Fallback: `--text-primary`. */
  text?: string;
  /** Secondary text color (dates, metadata). Fallback: `--text-secondary`. */
  textSecondary?: string;
  /** Heading container border color. Fallback: `--stroke-secondary`. */
  headingBorder?: string;
  /** Heading container background color. Fallback: `--bg-layer-1`. */
  headingBackground?: string;
  /** Heading title text color. Fallback: `--text-primary`. */
  headingTitleText?: string;
  /** Content container background color. Fallback: `--bg-layer-1`. */
  contentBackground?: string;
  /** Section heading text color (Browse, Favorites titles). Fallback: `--text-primary`. */
  sectionHeadingText?: string;
  /** "No results" title text color. Fallback: `--text-primary`. */
  noResultsTitleText?: string;
  /** "No results" description text color. Fallback: `--text-secondary`. */
  noResultsDescriptionText?: string;
  /** Tab result-count text color. Fallback: `--text-secondary`. */
  tabCountText?: string;
}

/**
 * Typography overrides for the Catalog component.
 * Pass single Tailwind utility classes (e.g. `'dial-h2-text'`, `'dial-body-semi-text'`).
 * When a `fontClassName` is provided, individual font properties are ignored.
 */
export interface CatalogTypography {
  /** Font family applied to the page heading. */
  pageHeadingFontFamily?: string;
  /** Font size applied to the page heading. */
  pageHeadingFontSize?: string;
  /** Font weight applied to the page heading. */
  pageHeadingFontWeight?: string | number;
  /** Line height applied to the page heading. */
  pageHeadingLineHeight?: string;
  /**
   * A single utility class (e.g. `'dial-h2-text'`) applied to the page heading.
   * When provided, individual font CSS vars are ignored in favour of this class.
   */
  pageHeadingFontClassName?: string;
  /** Typography class applied to tab text. Defaults to `'dial-body-text'`. */
  tabClassName?: string;
}

/**
 * Combined style overrides (colors and typography) for the Catalog component.
 * Lib applies these as CSS custom properties via inline styles, allowing the consuming
 * app to customize colors and typography while maintaining layout consistency.
 */
export interface CatalogStyles {
  /** Color customizations applied as CSS custom properties. */
  colors?: CatalogColors;
  /** Typography customizations and class overrides. */
  typography?: CatalogTypography;
}
