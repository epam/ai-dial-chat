import type { ScheduleTriggerDto } from '@epam/ai-dial-chat-api-client';
import {
  instantToZonedDateTime,
  isAbsoluteInstant,
} from '@epam/ai-dial-scheduled-tasks';
import { padTwoDigits } from '../shared/formatting';

const DATE_TIME_TO_MINUTE_LENGTH = 16;

/** Display categories are independent of task editability. */
export enum ScheduledTaskTriggerDescriptionKind {
  OneTime = 'oneTime',
  Hourly = 'hourly',
  EveryNMinutes = 'everyNMinutes',
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
  Custom = 'custom',
  Invalid = 'invalid',
}

/** What a trigger does, in the wall time of the task's own zone. */
export interface ScheduledTaskTriggerDescription {
  /** Which schedule shape the trigger is. */
  kind: ScheduledTaskTriggerDescriptionKind;
  /** `HH:mm` of a daily, weekly or monthly run, or the two-digit minute of an hourly one. */
  time?: string;
  /** First weekday of a `Weekly` description, `0` (Monday) to `6` (Sunday). */
  dayOfWeek?: string;
  /** Every weekday of a `Weekly` description, Monday first; `dayOfWeek` is its first entry. */
  daysOfWeek?: string[];
  /** Day of the month of a `Monthly` description. */
  dayOfMonth?: string;
  /** Minutes between runs of an `EveryNMinutes` description. */
  intervalMinutes?: number;
  /** Local `YYYY-MM-DDTHH:mm` of a `OneTime` description, in the task's zone. */
  dateTime?: string;
  /** Raw cron fields of a `Custom` description. */
  expression?: string;
  /** IANA zone the times above are wall time in. */
  timezone: string;
}

/** Options of {@link describeScheduledTaskTrigger}. */
export interface ScheduledTaskTriggerDescriptionOptions {
  /** IANA zone the trigger is evaluated in. Defaults to UTC, which is what a task saved without a zone runs in. */
  timezone?: string;
}

/**
 * Describes the complete trigger without requiring unrelated task metadata.
 * Times are the stored wall time in the task's zone; nothing is converted to
 * the viewer's zone. Unsupported constraints remain Custom, with the full
 * source expression.
 */
export const describeScheduledTaskTrigger = (
  trigger: ScheduleTriggerDto,
  { timezone = 'UTC' }: ScheduledTaskTriggerDescriptionOptions = {},
): ScheduledTaskTriggerDescription => {
  const result = (
    kind: ScheduledTaskTriggerDescriptionKind,
    extra: Partial<ScheduledTaskTriggerDescription> = {},
  ): ScheduledTaskTriggerDescription => ({
    kind,
    timezone,
    ...extra,
  });
  if (trigger.date && trigger.cron)
    return result(ScheduledTaskTriggerDescriptionKind.Invalid);
  if (trigger.date) {
    const dateTime = isAbsoluteInstant(trigger.date)
      ? instantToZonedDateTime(trigger.date, timezone)
      : trigger.date.slice(0, DATE_TIME_TO_MINUTE_LENGTH);
    return dateTime && !Number.isNaN(Date.parse(`${dateTime}Z`))
      ? result(ScheduledTaskTriggerDescriptionKind.OneTime, { dateTime })
      : result(ScheduledTaskTriggerDescriptionKind.Invalid);
  }
  const fields = trigger.cron?.fields as
    Record<string, string | null | undefined> | undefined;
  if (!fields || Object.keys(fields).length === 0)
    return result(ScheduledTaskTriggerDescriptionKind.Invalid);
  const custom = () =>
    result(ScheduledTaskTriggerDescriptionKind.Custom, {
      expression: JSON.stringify(fields),
    });
  const ranges: Record<string, [number, number]> = {
    hour: [0, 23],
    minute: [0, 59],
    day: [1, 31],
    day_of_week: [0, 6],
    month: [1, 12],
    second: [0, 59],
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (!value.trim())
      return result(ScheduledTaskTriggerDescriptionKind.Invalid);
    const range = ranges[key];
    if (
      range &&
      /^-?\d+$/.test(value) &&
      (Number(value) < range[0] || Number(value) > range[1])
    )
      return result(ScheduledTaskTriggerDescriptionKind.Invalid);
    /* An explicit wildcard second means every second, not the default zero. */
    if (key === 'second' && value !== '0') return custom();
    if (
      !['hour', 'minute', 'day', 'day_of_week'].includes(key) &&
      value !== '*' &&
      !(key === 'second' && value === '0')
    )
      return custom();
  }
  const hour = fields.hour;
  const minute = fields.minute;
  const day = fields.day === '*' ? undefined : fields.day;
  const rawWeekday =
    fields.day_of_week === '*' ? undefined : fields.day_of_week;
  const weekdayNames = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];
  /* A comma list of weekdays (the Custom repeat) is described like Weekly,
   * one entry per day; ranges and steps keep the raw-expression kind. */
  const weekdays = (rawWeekday?.split(',') ?? []).map((entry) => {
    const namedWeekday = weekdayNames.findIndex(
      (name) =>
        name === entry.toLowerCase() ||
        name.slice(0, 3) === entry.toLowerCase(),
    );
    return namedWeekday >= 0 ? String(namedWeekday) : entry;
  });
  const weekday = weekdays[0];
  if (
    (day && weekday) ||
    (day && !/^\d+$/.test(day)) ||
    weekdays.some((entry) => !/^[0-6]$/.test(entry)) ||
    new Set(weekdays).size !== weekdays.length
  )
    return custom();
  const everyHour = hour == null || hour === '*';
  const interval = minute?.match(/^\*\/(\d+)$/);
  if (everyHour && interval && !day && !weekday) {
    const count = Number(interval[1]);
    return count > 0 && count <= 59
      ? result(ScheduledTaskTriggerDescriptionKind.EveryNMinutes, {
          intervalMinutes: count,
        })
      : result(ScheduledTaskTriggerDescriptionKind.Invalid);
  }
  if (!minute || !/^\d+$/.test(minute) || (!everyHour && !/^\d+$/.test(hour)))
    return custom();
  if (everyHour && (day || weekday)) return custom();

  if (everyHour)
    return result(ScheduledTaskTriggerDescriptionKind.Hourly, {
      time: padTwoDigits(Number(minute)),
    });
  const time = `${padTwoDigits(Number(hour))}:${padTwoDigits(Number(minute))}`;
  if (weekday) {
    const daysOfWeek = [...weekdays].sort((a, b) => Number(a) - Number(b));
    return result(ScheduledTaskTriggerDescriptionKind.Weekly, {
      time,
      dayOfWeek: daysOfWeek[0],
      daysOfWeek,
    });
  }
  if (day)
    return result(ScheduledTaskTriggerDescriptionKind.Monthly, {
      time,
      dayOfMonth: String(Number(day)),
    });
  return result(ScheduledTaskTriggerDescriptionKind.Daily, { time });
};
