import type {
  CreateScheduledTaskBodyDto,
  UpdateScheduledTaskBodyDto,
} from '@epam/ai-dial-chat-api-client';
import type { ScheduledTaskCreateFormValues } from '@epam/ai-dial-scheduled-tasks';
import {
  validateScheduledTaskFormValues,
  type ScheduledTaskValidationErrors,
  type ScheduledTaskValidationOptions,
} from '@epam/ai-dial-scheduled-tasks/validation';
import {
  mapFormValuesToCreateBody,
  mapFormValuesToUpdateBody,
} from './scheduled-task-trigger';

/** A checked request preparation result that never serializes invalid values. */
export type ScheduledTaskPreparationResult<TBody> =
  | { ok: true; body: TBody }
  | { ok: false; errors: ScheduledTaskValidationErrors };

/**
 * Validates form values before creating a request body. Hosts translate the
 * returned field codes and must not issue a write when `ok` is false.
 */
export const prepareScheduledTaskCreateBody = (
  values: ScheduledTaskCreateFormValues,
  options: ScheduledTaskValidationOptions,
): ScheduledTaskPreparationResult<CreateScheduledTaskBodyDto> => {
  const errors = validateScheduledTaskFormValues(values, options);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return { ok: true, body: mapFormValuesToCreateBody(values) };
};

/** Validates form values before preparing an update request body. */
export const prepareScheduledTaskUpdateBody = (
  values: ScheduledTaskCreateFormValues,
  options: ScheduledTaskValidationOptions,
): ScheduledTaskPreparationResult<UpdateScheduledTaskBodyDto> => {
  const errors = validateScheduledTaskFormValues(values, options);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return { ok: true, body: mapFormValuesToUpdateBody(values) };
};
