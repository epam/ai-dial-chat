import type { ScheduledTaskCreateFormValues } from '../models/scheduled-task-create-form-props';
import { ScheduledTaskRepeat } from '../types/scheduled-task-schedule';

/** Maximum allowed length, in characters, of {@link ScheduledTaskCreateFormValues.description}. */
export const DESCRIPTION_MAX_LENGTH = 500;

/** Values a new-task form starts with: a daily run at 09:00, every other field empty. */
export const SCHEDULED_TASK_CREATE_DEFAULT_VALUES: Readonly<ScheduledTaskCreateFormValues> =
  {
    displayName: '',
    repeat: ScheduledTaskRepeat.Daily,
    time: '09:00',
    minute: '0',
    everyWeeks: '1',
    startDate: undefined,
    endDate: undefined,
    modelId: '',
    prompt: '',
  };
