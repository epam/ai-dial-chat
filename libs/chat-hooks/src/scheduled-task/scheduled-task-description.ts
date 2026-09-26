import type { ScheduleTriggerDto } from '@epam/ai-dial-chat-api-client';

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

export interface ScheduledTaskTriggerDescription {
  kind: ScheduledTaskTriggerDescriptionKind;
  time?: string;
  dayOfWeek?: string;
  dayOfMonth?: string;
  intervalMinutes?: number;
  date?: Date;
  expression?: string;
  sourceTimezone: 'utc';
}

export interface ScheduledTaskTriggerDescriptionOptions {
  /** Display timezone; defaults to UTC for backwards compatibility. */
  timeZone?: string;
  /** Date whose timezone offset is used. Defaults to now (the existing UTC-storage policy). */
  referenceDate?: Date;
}

/**
 * Describes the complete trigger without requiring unrelated task metadata.
 * Unsupported constraints remain Custom, with the full source expression.
 * Calendar-month shifts crossing month boundaries or days 29–31 remain
 * Custom because a shifted monthly day is not equivalent around short months.
 */
export const describeScheduledTaskTrigger = (
  trigger: ScheduleTriggerDto,
  {
    timeZone = 'UTC',
    referenceDate = new Date(),
  }: ScheduledTaskTriggerDescriptionOptions = {},
): ScheduledTaskTriggerDescription => {
  const result = (
    kind: ScheduledTaskTriggerDescriptionKind,
    extra: Partial<ScheduledTaskTriggerDescription> = {},
  ): ScheduledTaskTriggerDescription => ({
    kind,
    sourceTimezone: 'utc',
    ...extra,
  });
  if (trigger.date && trigger.cron)
    return result(ScheduledTaskTriggerDescriptionKind.Invalid);
  if (trigger.date) {
    const date = new Date(trigger.date);
    return Number.isNaN(date.getTime())
      ? result(ScheduledTaskTriggerDescriptionKind.Invalid)
      : result(ScheduledTaskTriggerDescriptionKind.OneTime, { date });
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
  const namedWeekday = rawWeekday
    ? weekdayNames.findIndex(
        (name) =>
          name === rawWeekday.toLowerCase() ||
          name.slice(0, 3) === rawWeekday.toLowerCase(),
      )
    : -1;
  const weekday = namedWeekday >= 0 ? String(namedWeekday) : rawWeekday;
  if (
    (day && weekday) ||
    (day && !/^\d+$/.test(day)) ||
    (weekday && !/^\d+$/.test(weekday))
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

  const reference = new Date(referenceDate);
  if (Number.isNaN(reference.getTime()))
    return result(ScheduledTaskTriggerDescriptionKind.Invalid);
  reference.setUTCHours(everyHour ? 0 : Number(hour), Number(minute), 0, 0);
  if (weekday) {
    const targetDay = (Number(weekday) + 1) % 7;
    reference.setUTCDate(
      reference.getUTCDate() + ((targetDay - reference.getUTCDay() + 7) % 7),
    );
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(reference);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  const localDate = new Date(
    Date.UTC(
      Number(part('year')),
      Number(part('month')) - 1,
      Number(part('day')),
    ),
  );
  const utcDay = Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth(),
    reference.getUTCDate(),
  );
  const dayShift = Math.round((localDate.getTime() - utcDay) / 86400000);
  const time = part('hour') + ':' + part('minute');
  if (everyHour)
    return result(ScheduledTaskTriggerDescriptionKind.Hourly, {
      time: part('minute'),
    });
  if (weekday)
    return result(ScheduledTaskTriggerDescriptionKind.Weekly, {
      time,
      dayOfWeek: String((Number(weekday) + dayShift + 7) % 7),
    });
  if (day)
    return dayShift === 0 ||
      (Number(day) <= 28 &&
        Number(day) + dayShift >= 1 &&
        Number(day) + dayShift <= 28)
      ? result(ScheduledTaskTriggerDescriptionKind.Monthly, {
          time,
          dayOfMonth: String(Number(day) + dayShift),
        })
      : custom();
  return result(ScheduledTaskTriggerDescriptionKind.Daily, { time });
};
