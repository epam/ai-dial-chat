import type { ReactNode } from 'react';
import type { CatalogItemLimits } from '../../../../models/item-details-data';

/** Color overrides for `LimitsTab`, applied as CSS custom properties. */
export interface LimitsTabColors {
  /** Group heading text color. Fallback: `--text-secondary`. */
  sectionHeading?: string;
  /** Row label text color, and the secondary half of a value/note line. Fallback: `--text-secondary`. */
  label?: string;
  /** Emphasized value text color: the used-amount figure of a capped row, and a no-progress row's value. Fallback: `--text-primary`. */
  valuePrimary?: string;
  /** Row divider line color. Fallback: `--stroke-tertiary`. */
  divider?: string;
  /** Progress-bar track color for capped rows. Fallback: `--bg-layer-sunken`. */
  progressTrack?: string;
  /** Progress-bar fill color below 75% usage. Fallback: `--text-control-accent-hover`. */
  progressFillDefault?: string;
  /** Progress-bar fill color once usage reaches 75% of the limit. Fallback: `--text-warning-icon`. */
  progressFillWarning?: string;
  /** Progress-bar fill color once usage reaches (or exceeds) the limit. Fallback: `--bg-control-error-active`. */
  progressFillDanger?: string;
}

/** CSS classes shared by every row a `LimitsTab` group renders. */
export interface LimitRowClassNames {
  /** CSS class for a row's label. */
  labelClassName: string;
  /** CSS class for a row's secondary caption under the label (`row.captionLabel`). */
  captionClassName: string;
  /** CSS class for a capped row's used/total figures. */
  valueClassName: string;
  /** CSS class for a no-progress row's value (e.g. "Unlimited"). */
  noteValueClassName: string;
  /** CSS class for a no-progress row's secondary caption (`row.noteLabel`). */
  noteClassName: string;
}

/** Props for `LimitsTab`. */
export interface LimitsTabProps {
  /** Limits data to render. */
  limits?: CatalogItemLimits;
  /** CSS class for a row's label. Defaults to `'dial-small-semi-text'`. */
  labelClassName?: string;
  /** CSS class for a row's secondary caption under the label (`row.captionLabel`). Defaults to `'dial-caption-text'`. */
  captionClassName?: string;
  /** CSS class for a capped row's used/total figures. Defaults to `'dial-tiny-text'`. */
  valueClassName?: string;
  /** CSS class for a no-progress row's value (e.g. "Unlimited"). Defaults to `'dial-tiny-semi-text'`. */
  noteValueClassName?: string;
  /** CSS class for a no-progress row's secondary caption (`row.noteLabel`). Defaults to `'dial-caption-text'`. */
  noteClassName?: string;
  /** CSS class for each group's heading. Defaults to `'dial-caption-text'`. */
  sectionClassName?: string;
  /** CSS class for `footerNote`'s wrapper. Defaults to `'dial-caption-text'`. */
  footerClassName?: string;
  /**
   * Footer note rendered below the groups, e.g. a link to a full usage-limits
   * page. Omitted (the default) hides the footer entirely.
   */
  footerNote?: ReactNode;
  /** Color overrides applied as CSS custom properties. */
  colors?: LimitsTabColors;
}
