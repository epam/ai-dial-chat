import type { ScheduleTriggerDto } from '@epam/ai-dial-chat-api-client';

/** Renderable trigger categories, intentionally independent of task editability. */
export enum ScheduledTaskTriggerDescriptionKind {
  OneTime = 'oneTime',
  Hourly = 'hourly',
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
  date?: Date;
  expression?: string;
  sourceTimezone: 'utc';
}

const isIntegerInRange = (
  value: string | undefined,
  minimum: number,
  maximum: number,
) =>
  value !== undefined &&
  /^\d+$/.test(value) &&
  Number(value) >= minimum &&
  Number(value) <= maximum;

/**
 * Describes a scheduler trigger without requiring model, prompt, or any other
 * task metadata. Unknown but structurally valid cron expressions stay visible
 * as Custom; malformed inputs are explicitly Invalid.
 */
export const describeScheduledTaskTrigger = (
  trigger: ScheduleTriggerDto,
): ScheduledTaskTriggerDescription => {
  if (trigger.date) {
    const date = new Date(trigger.date);
    return Number.isNaN(date.getTime())
      ? {
          kind: ScheduledTaskTriggerDescriptionKind.Invalid,
          sourceTimezone: 'utc',
        }
      : {
          kind: ScheduledTaskTriggerDescriptionKind.OneTime,
          date,
          sourceTimezone: 'utc',
        };
  }
  const fields = trigger.cron?.fields as
    Record<string, string | null | undefined> | undefined;
  if (!fields)
    return {
      kind: ScheduledTaskTriggerDescriptionKind.Invalid,
      sourceTimezone: 'utc',
    };
  const hour = fields.hour ?? undefined;
  const minute = fields.minute ?? undefined;
  if (hour === '*' && isIntegerInRange(minute, 0, 59)) {
    return {
      kind: ScheduledTaskTriggerDescriptionKind.Hourly,
      time: minute,
      sourceTimezone: 'utc',
    };
  }
  if (!isIntegerInRange(hour, 0, 23) || !isIntegerInRange(minute, 0, 59)) {
    return {
      kind: ScheduledTaskTriggerDescriptionKind.Custom,
      expression: JSON.stringify(fields),
      sourceTimezone: 'utc',
    };
  }
  const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  if (fields.day_of_week != null) {
    return isIntegerInRange(fields.day_of_week, 0, 6)
      ? {
          kind: ScheduledTaskTriggerDescriptionKind.Weekly,
          time,
          dayOfWeek: fields.day_of_week,
          sourceTimezone: 'utc',
        }
      : {
          kind: ScheduledTaskTriggerDescriptionKind.Invalid,
          sourceTimezone: 'utc',
        };
  }
  if (fields.day != null) {
    return isIntegerInRange(fields.day, 1, 31)
      ? {
          kind: ScheduledTaskTriggerDescriptionKind.Monthly,
          time,
          dayOfMonth: fields.day,
          sourceTimezone: 'utc',
        }
      : {
          kind: ScheduledTaskTriggerDescriptionKind.Invalid,
          sourceTimezone: 'utc',
        };
  }
  return {
    kind: ScheduledTaskTriggerDescriptionKind.Daily,
    time,
    sourceTimezone: 'utc',
  };
};
