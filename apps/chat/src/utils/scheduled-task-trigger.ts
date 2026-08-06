import {
  ScheduledTaskCreateFormValues,
  ScheduledTaskFrequency,
  ScheduledTaskScheduleType,
} from '@epam/ai-dial-scheduled-tasks';
import type {
  CreateScheduledTaskBodyDto,
  ScheduleTriggerDto,
} from '@epam/chat-api-client';
import { apSchedulerDayToJsDay, jsDayToApSchedulerDay } from './cron-weekday';

/** Which boundary of a cron activity window is being computed. */
enum CronWindowEdge {
  Start = 'start',
  End = 'end',
}

/**
 * Converts the locally-entered `hour`/`minute` (and, for weekly/monthly
 * recurrence, the locally-selected `dayOfWeek`/`dayOfMonth`) to their UTC
 * equivalents, since DIAL Scheduler executes `cron.fields` in UTC with no
 * per-schedule timezone field. Uses a single reference `Date` and reads its
 * UTC getters back, so the browser's own timezone/DST handling does the
 * conversion instead of manual offset arithmetic.
 */
const buildCronFields = (
  values: ScheduledTaskCreateFormValues,
): Record<string, string> => {
  const [hourStr, minuteStr] = values.time.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  const reference = new Date();
  reference.setHours(hour, minute, 0, 0);

  const hasDayOfWeek =
    values.frequency === ScheduledTaskFrequency.Weekly && !!values.dayOfWeek;
  const hasDayOfMonth =
    values.frequency === ScheduledTaskFrequency.Monthly && !!values.dayOfMonth;

  if (hasDayOfWeek) {
    const targetLocalDay = apSchedulerDayToJsDay(Number(values.dayOfWeek));
    const diff = (targetLocalDay - reference.getDay() + 7) % 7;
    reference.setDate(reference.getDate() + diff);
  } else if (hasDayOfMonth) {
    reference.setDate(Number(values.dayOfMonth));
  }

  const fields: Record<string, string> = {
    hour: String(reference.getUTCHours()),
    minute: String(reference.getUTCMinutes()),
  };

  if (hasDayOfWeek) {
    fields.day_of_week = String(jsDayToApSchedulerDay(reference.getUTCDay()));
  }
  if (hasDayOfMonth) {
    fields.day = String(reference.getUTCDate());
  }

  return fields;
};

/*
 * Converts a `YYYY-MM-DD` local calendar date (`values.startDate`/`endDate`)
 * to the UTC ISO instant at the start or end of that local day, using the
 * same reference-`Date`-plus-getters technique as `buildCronFields` above:
 * the browser's own timezone/DST handling does the conversion, rather than
 * manual offset arithmetic. `end` resolves to `23:59:59.999` local, not
 * midnight of the next day, so the last local day the user picked stays
 * fully inside the window.
 */
const buildCronWindowBoundary = (
  dateValue: string,
  edge: CronWindowEdge,
): string => {
  const [year, month, day] = dateValue.split('-').map(Number);
  const reference = new Date(year, month - 1, day);
  if (edge === CronWindowEdge.Start) {
    reference.setHours(0, 0, 0, 0);
  } else {
    reference.setHours(23, 59, 59, 999);
  }
  return reference.toISOString();
};

/**
 * Maps validated create-form values to the `POST /api/v1/scheduled-tasks`
 * request body, building `trigger.date` for a one-shot schedule or
 * `trigger.cron.fields` for a recurring one. Assumes the caller has already
 * validated required fields (name, model, prompt, and the active schedule
 * section's fields) — this function does not re-validate.
 */
export const mapFormValuesToCreateBody = (
  values: ScheduledTaskCreateFormValues,
): CreateScheduledTaskBodyDto => {
  const trigger: ScheduleTriggerDto =
    values.scheduleType === ScheduledTaskScheduleType.Once
      ? { date: new Date(values.runAt ?? '').toISOString() }
      : {
          cron: {
            fields: buildCronFields(values),
            ...(values.startDate
              ? {
                  startDate: buildCronWindowBoundary(
                    values.startDate,
                    CronWindowEdge.Start,
                  ),
                }
              : {}),
            ...(values.endDate
              ? {
                  endDate: buildCronWindowBoundary(
                    values.endDate,
                    CronWindowEdge.End,
                  ),
                }
              : {}),
          },
        };

  const trimmedDescription = values.description?.trim();

  return {
    displayName: values.displayName.trim(),
    trigger,
    model: values.modelId,
    prompt: values.prompt.trim(),
    ...(trimmedDescription ? { description: trimmedDescription } : {}),
  };
};
