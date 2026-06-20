/** A single key-value row in the Overview tab. */
export interface OverviewSpec {
  /** Displayed label (left column). */
  label: string;
  /**
   * Displayed value.
   * `true` → check icon + "Yes" (primary, semibold).
   * `false` → "No" (secondary, regular).
   * `string` → plain text (primary, regular).
   */
  value: string | boolean;
}

/** A named group of spec rows in the Overview tab. */
export interface OverviewSection {
  /** Section heading, e.g. "Capabilities" or "Specification". */
  title: string;
  /** Ordered spec rows. */
  specs: OverviewSpec[];
}

/**
 * Structured data powering the Overview tab of `CatalogItemDetails`.
 *
 * Recommended source format: a TypeScript file per entity type (or per provider)
 * exporting a `Record<string, CatalogItemOverview>` keyed by item id.
 * Example: `export const MODEL_OVERVIEWS: Record<string, CatalogItemOverview> = { 'gpt-4o': { sections: [...] } }`.
 */
export interface CatalogItemOverview {
  /** Ordered list of spec sections shown in the Overview tab. */
  sections: OverviewSection[];
}
