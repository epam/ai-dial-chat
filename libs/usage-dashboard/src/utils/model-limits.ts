import {
  ModelLimitsLabels,
  ModelLimitStatus,
} from '../models/model-limits-props';

/** Returns the badge class from `classes` for a status that renders a badge, or `undefined` for `NoLimit`/`Unavailable`. */
export const getBadgeClassName = (
  status: ModelLimitStatus,
  classes: Readonly<Record<string, string>>,
): string | undefined => {
  switch (status) {
    case ModelLimitStatus.WithinLimits:
      return classes.defaultBadge;
    case ModelLimitStatus.RunningLow:
      return classes.warningBadge;
    case ModelLimitStatus.LimitReached:
      return classes.errorBadge;
    case ModelLimitStatus.NoLimit:
    case ModelLimitStatus.Unavailable:
      return undefined;
  }
};

/** Returns the host-supplied Status text for `status`. */
export const getBadgeLabel = (
  status: ModelLimitStatus,
  labels: ModelLimitsLabels,
): string => {
  switch (status) {
    case ModelLimitStatus.WithinLimits:
      return labels.withinLimitsBadgeLabel;
    case ModelLimitStatus.RunningLow:
      return labels.runningLowBadgeLabel;
    case ModelLimitStatus.LimitReached:
      return labels.limitReachedBadgeLabel;
    case ModelLimitStatus.NoLimit:
      return labels.noLimitBadgeLabel;
    case ModelLimitStatus.Unavailable:
      return labels.unavailableBadgeLabel;
  }
};
