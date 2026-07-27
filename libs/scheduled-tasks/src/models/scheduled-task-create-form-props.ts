/** Whether a scheduled task runs once at a specific time or repeats on a cadence. */
export type ScheduledTaskScheduleType = 'once' | 'recurring';

/** Recurrence cadence for a `'recurring'` schedule type. */
export type ScheduledTaskFrequency = 'daily' | 'weekly' | 'monthly';

/** A single option rendered in the frequency dropdown. */
export interface ScheduledTaskFrequencyOption {
  /** Stable identifier for this option, passed back via `onFieldChange('frequency', key)`. */
  key: ScheduledTaskFrequency;
  /** Localized display label for this frequency option. */
  label: string;
}

/** A single model option rendered in the model dropdown. */
export interface ScheduledTaskCreateFormModelOption {
  /** Deployment id sent to the BFF as `model`. */
  id: string;
  /** Localized display label shown in the dropdown. */
  label: string;
}

/** Current form field values for the {@link ScheduledTaskCreateForm} component. */
export interface ScheduledTaskCreateFormValues {
  /** The scheduled task's display name (required). */
  displayName: string;
  /** Whether the task runs once or repeats. */
  scheduleType: ScheduledTaskScheduleType;
  /** Local datetime-local input value used when `scheduleType` is `'once'`. */
  runAt?: string;
  /** Recurrence cadence used when `scheduleType` is `'recurring'`. */
  frequency?: ScheduledTaskFrequency;
  /** `HH:mm` time-of-day used when `scheduleType` is `'recurring'`. */
  time: string;
  /** Day of week (`'0'`-`'6'`) used when `frequency` is `'weekly'`. */
  dayOfWeek?: string;
  /** Day of month (`'1'`-`'31'`) used when `frequency` is `'monthly'`. */
  dayOfMonth?: string;
  /** Selected deployment id sent to the BFF as `model` (required). */
  modelId: string;
  /** Optional human-readable summary sent to the BFF as `description` (max 500 characters). */
  description?: string;
  /** Prompt text sent to the BFF as `prompt` (required). */
  prompt: string;
  /** Whether the scheduled chat completion streams its response. */
  stream: boolean;
}

/** Validation error messages keyed by {@link ScheduledTaskCreateFormValues} field. */
export interface ScheduledTaskCreateFormErrors {
  /** Error shown under the display name field. */
  displayName?: string;
  /** Error shown under the run-at field. */
  runAt?: string;
  /** Error shown under the time field. */
  time?: string;
  /** Error shown under the day-of-week field. */
  dayOfWeek?: string;
  /** Error shown under the day-of-month field. */
  dayOfMonth?: string;
  /** Error shown under the model field. */
  modelId?: string;
  /** Error shown under the description field. */
  description?: string;
  /** Error shown under the prompt field. */
  prompt?: string;
}

/** Localized labels used by the {@link ScheduledTaskCreateForm} component. */
export interface ScheduledTaskCreateFormLabels {
  /** Page/header title, e.g. "New scheduled task". */
  pageTitle: string;
  /** Display name field label. */
  displayNameLabel: string;
  /** Display name required-field validation message. */
  displayNameRequired: string;
  /** Label for the schedule section. */
  scheduleSectionLabel: string;
  /** Label for the "once" schedule type option. */
  scheduleTypeOnceLabel: string;
  /** Label for the "recurring" schedule type option. */
  scheduleTypeRecurringLabel: string;
  /** Accessible label for the schedule type control. */
  scheduleTypeAriaLabel: string;
  /** Run-at field label (shown when schedule type is "once"). */
  runAtLabel: string;
  /** Accessible label for the frequency dropdown. */
  frequencyLabel: string;
  /** Options rendered in the frequency dropdown. */
  frequencyOptions: ScheduledTaskFrequencyOption[];
  /** Time field label (shown when schedule type is "recurring"). */
  timeLabel: string;
  /** Day-of-week field label (shown when frequency is "weekly"). */
  dayOfWeekLabel: string;
  /** Day-of-month field label (shown when frequency is "monthly"). */
  dayOfMonthLabel: string;
  /** Accessible label for the model dropdown. */
  modelLabel: string;
  /** Placeholder shown in the model dropdown trigger when no model is selected. */
  modelPlaceholder: string;
  /** Description textarea label. */
  descriptionLabel: string;
  /** Prompt textarea label. */
  promptLabel: string;
  /** Stream toggle label. */
  streamLabel: string;
  /** Label for the Cancel action. */
  cancelButtonLabel: string;
  /** Label for the Create action. */
  createButtonLabel: string;
}

/** Style overrides for the {@link ScheduledTaskCreateForm} component. */
export interface ScheduledTaskCreateFormStyles {
  /** CSS class applied to the root container's background. Defaults to `'bg-layer-5'`. */
  containerClassName?: string;
  /** CSS class applied to the title. Defaults to `'dial-h1-text'`. */
  titleClassName?: string;
  /** CSS class applied to the schedule section's legend. Defaults to `'dial-body-semi-text mb-1'`. */
  scheduleSectionLabelClassName?: string;
}

/** Props for the {@link ScheduledTaskCreateForm} component. */
export interface ScheduledTaskCreateFormProps {
  /** Localized labels. */
  labels: ScheduledTaskCreateFormLabels;
  /** Current field values. */
  values: ScheduledTaskCreateFormValues;
  /** Current per-field validation errors. */
  errors: ScheduledTaskCreateFormErrors;
  /** Deployment options rendered in the model dropdown. */
  modelOptions: ScheduledTaskCreateFormModelOption[];
  /** Called with the changed field key and its new value whenever any field is edited. */
  onFieldChange: <K extends keyof ScheduledTaskCreateFormValues>(
    field: K,
    value: ScheduledTaskCreateFormValues[K],
  ) => void;
  /** Called when the user activates the Cancel action. */
  onCancel: () => void;
  /** Called when the user activates the Create action. */
  onSubmit: () => void;
  /** When `true`, the Create action is disabled and shows a busy affordance. Defaults to `false`. */
  isSubmitting?: boolean;
  /** Style overrides. */
  styles?: ScheduledTaskCreateFormStyles;
}
