import type { EntityTag } from '../types/entity-tag';

/** Daily usage limit data shown as a progress bar in the entity details header. */
export interface DailyLimit {
  /** Number of tokens or requests consumed today. */
  used: number;
  /** Total daily allowance. */
  total: number;
  /** Human-readable reset cadence label, e.g. "Resets Fri 12:00 AM". */
  resetLabel?: string;
}

/**
 * Header-level metadata rendered above the tab strip in the entity details panel.
 * All fields are optional; omitting the entire `summary` field hides this section.
 */
export interface CatalogItemSummary {
  /** Lifecycle or access-tier tag; renders a colored badge next to the entity type. */
  tag?: EntityTag; // TODO: not support from API side
  /** Daily usage limit; when present renders a labeled progress bar. */
  dailyLimit?: DailyLimit;
}
