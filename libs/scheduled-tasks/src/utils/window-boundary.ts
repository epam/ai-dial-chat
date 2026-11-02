import { ScheduledTaskRepeat } from '../types/scheduled-task-schedule';

/*
 * A repeat switch must leave every window boundary in the new cadence's
 * picker shape — date-only `YYYY-MM-DD` for day-based repeats,
 * `YYYY-MM-DDTHH:mm` for hourly. The two shapes mean different things: a
 * day-based boundary is a whole local day, an hourly boundary an exact
 * picked instant. So a value carried across a shape-changing switch would
 * silently change meaning — an end-of-day boundary becoming midnight of
 * that day cuts the window's last day short, a date-only value under
 * hourly stops being an instant — and the switch clears both boundaries
 * instead of reinterpreting them. A switch within the day-based group
 * keeps them: same shape, same meaning. A switch into or out of custom
 * also clears them: custom renders no boundary pickers, so a carried-over
 * value would be invisible yet remain live in form state.
 */
/** Returns the boundary value to keep after a repeat switch: the value itself when both cadences pick whole days (day-based repeats, and one-time whose boundary fields stay hidden), `undefined` when the switch crosses into or out of hourly, or when either cadence is custom (no boundary fields). */
export const keepWindowBoundaryOnRepeatSwitch = (
  value: string | undefined,
  currentRepeat: ScheduledTaskRepeat,
  nextRepeat: ScheduledTaskRepeat,
): string | undefined => {
  const isCustom = (repeat: ScheduledTaskRepeat): boolean =>
    repeat === ScheduledTaskRepeat.Custom;
  const sharesBoundaryShape =
    !isCustom(currentRepeat) &&
    !isCustom(nextRepeat) &&
    (currentRepeat === ScheduledTaskRepeat.Hourly) ===
      (nextRepeat === ScheduledTaskRepeat.Hourly);
  return sharesBoundaryShape ? value : undefined;
};
