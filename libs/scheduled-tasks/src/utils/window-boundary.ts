import { ScheduledTaskRepeat } from '../types/scheduled-task-schedule';

/*
 * Every cadence that renders boundary pickers writes the same date-only
 * `YYYY-MM-DD` shape, so a switch between them keeps both boundaries. A
 * switch into or out of custom clears them: custom renders no boundary
 * pickers, so a carried-over value would be invisible yet remain live in
 * form state.
 */
/** Returns the boundary value to keep after a repeat switch: the value itself unless either cadence is custom (no boundary fields), in which case `undefined`. */
export const keepWindowBoundaryOnRepeatSwitch = (
  value: string | undefined,
  currentRepeat: ScheduledTaskRepeat,
  nextRepeat: ScheduledTaskRepeat,
): string | undefined =>
  currentRepeat === ScheduledTaskRepeat.Custom ||
  nextRepeat === ScheduledTaskRepeat.Custom
    ? undefined
    : value;
