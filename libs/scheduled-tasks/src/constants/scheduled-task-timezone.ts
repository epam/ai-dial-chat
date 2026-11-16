import type {
  ScheduledTaskTimezoneClassNames,
  ScheduledTaskTimezoneLabels,
} from '../models/scheduled-task-timezone-props';

/** English wording of the time zone picker, used for every label the host leaves out. */
export const DEFAULT_TIMEZONE_LABELS: Required<ScheduledTaskTimezoneLabels> = {
  changeLabel: 'Change timezone',
  dialogAriaLabel: 'Time zone',
  searchPlaceholder: 'Search city, timezone or offset...',
  searchAriaLabel: 'Search time zones',
  clearSearchAriaLabel: 'Clear search',
  yourZoneHeading: 'Your time zone',
  allZonesHeading: 'All time zones',
  noResultsTitle: 'No time zones found',
  noResultsDescription: 'Try a different city, time zone or offset.',
  resultsCountLabel: (count) =>
    count === 1 ? '1 time zone found' : `${count} time zones found`,
  listAriaLabel: 'Time zones',
  gapHintLabel: (shiftedTime) =>
    `This time does not exist on that day, so the task will run at ${shiftedTime}.`,
};

/** Kit type-scale classes of the time zone picker, used for every class the host leaves out. */
export const DEFAULT_TIMEZONE_CLASS_NAMES: Required<ScheduledTaskTimezoneClassNames> =
  {
    linkClassName: 'dial-small-semi-text',
    headingClassName: 'dial-tiny-lead-semi-text',
    rowClassName: 'dial-small-text',
    hintClassName: 'dial-tiny-text',
  };
