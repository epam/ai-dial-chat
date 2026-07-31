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
      : { cron: { fields: buildCronFields(values) } };

  const trimmedDescription = values.description?.trim();

  return {
    displayName: values.displayName.trim(),
    trigger,
    model: values.modelId,
    prompt: values.prompt.trim(),
    ...(trimmedDescription ? { description: trimmedDescription } : {}),
    stream: values.stream,
  };
};
