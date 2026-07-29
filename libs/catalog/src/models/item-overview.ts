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

/** Structured data powering the Overview tab of `DetailsPanel`. */
export interface CatalogItemOverview {
  /** Ordered list of spec sections shown in the Overview tab. */
  sections: OverviewSection[];
}
