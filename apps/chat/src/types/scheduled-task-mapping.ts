import type { ScheduledTaskCreateFormValues } from '@epam/ai-dial-scheduled-tasks';

/** Why a {@link ScheduledTaskDto} could not be mapped back to editable form values. */
export enum UnsupportedTriggerReason {
  /** `trigger.cron.fields` uses a shape (extra keys, or both `day_of_week` and `day`) the editor's schedule controls cannot represent. */
  UnsupportedCronShape = 'unsupportedCronShape',
  /** Neither or both of `trigger.date`/`trigger.cron` are set, so the schedule type cannot be determined. */
  UnsupportedTriggerType = 'unsupportedTriggerType',
  /** The task is missing `model` or `prompt`, so it cannot be represented as a valid update payload. */
  MissingRequiredFields = 'missingRequiredFields',
}

/** Result of mapping a {@link ScheduledTaskDto} back to editable form values. */
export type ScheduledTaskDtoMappingResult =
  | { ok: true; values: ScheduledTaskCreateFormValues }
  | { ok: false; reason: UnsupportedTriggerReason };
