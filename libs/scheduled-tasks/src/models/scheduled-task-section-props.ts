import type { ReactNode } from 'react';

/** Style overrides for the {@link ScheduledTaskSection} component. */
export interface ScheduledTaskSectionStyles {
  /** CSS class applied to the section title. Defaults to `'dial-small-semi-text'`. */
  titleClassName?: string;
  /** CSS class applied to the count badge. Defaults to `'bg-layer-3 text-secondary'`. */
  countBadgeClassName?: string;
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
