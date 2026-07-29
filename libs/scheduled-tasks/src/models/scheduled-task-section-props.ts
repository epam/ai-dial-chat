import type { ReactNode } from 'react';

/**
 * Color overrides for the {@link ScheduledTaskSection} component, applied as
 * CSS custom properties with app theme fallbacks.
 */
export interface ScheduledTaskSectionColors {
  /** Count badge background. Fallback: `--bg-layer-3`. */
  countBadgeBackground?: string;
  /** Count badge text color. Fallback: `--text-secondary`. */
  countBadgeText?: string;
}

/** Typography overrides for the {@link ScheduledTaskSection} component. */
export interface ScheduledTaskSectionTypography {
  /** CSS class applied to the section title. Defaults to `'dial-small-semi-text'`. */
  titleClassName?: string;
  /** CSS class applied to the count badge text. Defaults to `'dial-tiny-text'`. */
  countBadgeClassName?: string;
}

/** Style overrides for the {@link ScheduledTaskSection} component. */
export interface ScheduledTaskSectionStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ScheduledTaskSectionColors;
  /** Typography class overrides. */
  typography?: ScheduledTaskSectionTypography;
}

/** Props for the {@link ScheduledTaskSection} component. */
export interface ScheduledTaskSectionProps {
  /** Section heading, e.g. "Shared". Omit to render the section without a heading/count row. */
  title?: string;
  /** Number of items in this section, shown as a count badge next to the title. Ignored when `title` is omitted. */
  count: number;
  /** Section content, typically a {@link ScheduledTaskCardGrid}. */
  children: ReactNode;
  /** Style overrides. */
  styles?: ScheduledTaskSectionStyles;
}
