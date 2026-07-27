import { ScheduledTaskCreateFormValues } from '@epam/ai-dial-scheduled-tasks';
import type {
  CreateScheduledTaskBodyDto,
  ScheduleTriggerDto,
} from '@epam/chat-api-client';

const buildCronFields = (
  values: ScheduledTaskCreateFormValues,
): Record<string, string> => {
  const [hour, minute] = values.time.split(':');
  const fields: Record<string, string> = {
    hour: String(Number(hour)),
    minute: String(Number(minute)),
  };

  if (values.frequency === 'weekly' && values.dayOfWeek) {
    fields.day_of_week = values.dayOfWeek;
  }
  if (values.frequency === 'monthly' && values.dayOfMonth) {
    fields.day = values.dayOfMonth;
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
    values.scheduleType === 'once'
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
