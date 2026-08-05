/**
 * Color overrides for the {@link ScheduledTaskCardSkeleton} component.
 * `DialSkeleton`'s own default color token (`bg-layer-raised`) has no visible
 * contrast against the card background in apps that don't override it, so
 * this component requires an explicit color rather than relying on that
 * default — callers can still override it via this prop.
 */
export interface ScheduledTaskCardSkeletonColors {
  /** Background color of each skeleton bar. Fallback: `--bg-layer-4`. */
  skeletonColor?: string;
}

/** Style overrides for the {@link ScheduledTaskCardSkeleton} component. */
export interface ScheduledTaskCardSkeletonStyles {
  /** Color overrides. */
  colors?: ScheduledTaskCardSkeletonColors;
}

/** Props for the {@link ScheduledTaskCardSkeleton} component. */
export interface ScheduledTaskCardSkeletonProps {
  /** Style overrides. */
  styles?: ScheduledTaskCardSkeletonStyles;
}
