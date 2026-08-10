import type { ScheduledTaskRepeat } from '../types/scheduled-task-schedule';

/** A single option rendered in the Repeat dropdown. */
export interface ScheduledTaskRepeatOption {
  /** Stable identifier for this option, passed back via `onFieldChange('repeat', key)`. */
  key: ScheduledTaskRepeat;
  /** Localized display label for this repeat option. */
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
  /** How often the task repeats. */
  repeat: ScheduledTaskRepeat;
  /** Local datetime-local input value used when `repeat` is `'oneTime'`. */
  runAt?: string;
  /** `HH:mm` time-of-day used when `repeat` is `'daily'`, `'weekly'`, or `'monthly'`. */
  time: string;
  /** Day of week (`'0'`-`'6'`) used when `repeat` is `'weekly'`. */
  dayOfWeek?: string;
  /** Day of month (`'1'`-`'31'`) used when `repeat` is `'monthly'`. */
  dayOfMonth?: string;
  /** Minute of the hour (`'0'`-`'59'`) used when `repeat` is `'hourly'`. */
  minute?: string;
  /** Date-only value bounding the start of a recurring schedule's activity window. Ignored when `repeat` is `'oneTime'`. */
  startDate?: string;
  /** Date-only value bounding the end of a recurring schedule's activity window. Ignored when `repeat` is `'oneTime'`. */
  endDate?: string;
  /** Selected deployment id sent to the BFF as `model` (required). */
  modelId: string;
  /** Optional human-readable summary sent to the BFF as `description` (max 500 characters). */
  description?: string;
  /** Prompt text sent to the BFF as `prompt` (required). */
  prompt: string;
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
  /** Error shown under the minute field. */
  minute?: string;
  /** Error shown under the start-date field. */
  startDate?: string;
  /** Error shown under the end-date field. */
  endDate?: string;
  /** Error shown under the model field. */
  modelId?: string;
  /** Error shown under the description field. */
  description?: string;
  /** Error shown under the prompt field. */
  prompt?: string;
}

/** Localized labels used by the {@link ScheduledTaskCreateForm} component. */
export interface ScheduledTaskCreateFormLabels {
  /** Page/header title, e.g. "New task". */
  pageTitle: string;
  /** Accessible label for the header's back control. */
  backButtonLabel: string;
  /** Section heading for the Details column. */
  detailsSectionTitle: string;
  /** Section subtitle for the Details column. */
  detailsSectionSubtitle: string;
  /** Section heading for the Configuration column. */
  configurationSectionTitle: string;
  /** Section subtitle for the Configuration column. */
  configurationSectionSubtitle: string;
  /** Display name field label. */
  displayNameLabel: string;
  /** Display name required-field validation message. */
  displayNameRequired: string;
  /** Run-at field label (shown when `repeat` is "oneTime"). */
  runAtLabel: string;
  /** Accessible label for the Repeat dropdown. */
  repeatLabel: string;
  /** Options rendered in the Repeat dropdown. */
  repeatOptions: ScheduledTaskRepeatOption[];
  /** Time field label (shown when `repeat` is "daily", "weekly", or "monthly"). */
  timeLabel: string;
  /** Day-of-week field label (shown when `repeat` is "weekly"). */
  dayOfWeekLabel: string;
  /** Day-of-month field label (shown when `repeat` is "monthly"). */
  dayOfMonthLabel: string;
  /** Minute field label (shown when `repeat` is "hourly"). */
  minuteLabel: string;
  /** Start-date field label (shown when `repeat` is not "oneTime"; the field itself is optional, so this label carries no required marker). */
  startDateLabel: string;
  /** Placeholder shown in the start-date picker when unset. */
  startDatePlaceholder: string;
  /** End-date field label (shown when `repeat` is not "oneTime"; the field itself is optional, so this label carries no required marker). */
  endDateLabel: string;
  /** Placeholder shown in the end-date picker when unset. */
  endDatePlaceholder: string;
  /** Accessible label for the model dropdown. */
  modelOrAgentLabel: string;
  /** Placeholder shown in the model dropdown trigger when no model is selected. */
  modelPlaceholder: string;
  /** Description textarea label. */
  descriptionLabel: string;
  /** Accessible label for the Instructions markdown editor. */
  instructionsLabel: string;
  /** Label for the Cancel action. */
  cancelButtonLabel: string;
  /** Label for the Save action (submits the create form). */
  createButtonLabel: string;
}

/**
 * Color overrides for the {@link ScheduledTaskCreateForm} component, applied
 * as CSS custom properties with app theme fallbacks.
 */
export interface ScheduledTaskCreateFormColors {
  /** Root container background. Fallback: `--bg-layer-base`. */
  background?: string;
  /** Header row's bottom border color. Fallback: `--stroke-tertiary`. */
  headerBorder?: string;
  /** Details column's end-edge divider color. Fallback: `--stroke-tertiary`. */
  detailsColumnBorder?: string;
  /** Section subtitle text color. Fallback: `--text-secondary`. */
  sectionSubtitleText?: string;
  /** Instructions editor's validation error text color. Fallback: `--text-error`. */
  instructionsErrorText?: string;
}

/** Typography overrides for the {@link ScheduledTaskCreateForm} component. */
export interface ScheduledTaskCreateFormTypography {
  /** CSS class applied to the title. Defaults to `'dial-h1-text'`. */
  titleClassName?: string;
  /** CSS class applied to a section heading. Defaults to `'dial-body-semi-text'`. */
  sectionTitleClassName?: string;
  /** CSS class applied to a section subtitle. Defaults to `'dial-tiny-text'`. */
  sectionSubtitleClassName?: string;
  /** CSS class applied to the Instructions label. Defaults to `'dial-body-semi-text mb-1'`. */
  instructionsLabelClassName?: string;
  /** CSS class applied to the Instructions editor's validation error text. Defaults to `'dial-small-text'`. */
  instructionsErrorClassName?: string;
}

/** Style overrides for the {@link ScheduledTaskCreateForm} component. */
export interface ScheduledTaskCreateFormStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ScheduledTaskCreateFormColors;
  /** Typography class overrides. */
  typography?: ScheduledTaskCreateFormTypography;
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
  /** Called when the user activates the header's back control. */
  onBack: () => void;
  /** Called when the user activates the Cancel action. */
  onCancel: () => void;
  /** Called when the user activates the Save action. */
  onSubmit: () => void;
  /** When `true`, the Save action is disabled and shows a busy affordance. Defaults to `false`. */
  isSubmitting?: boolean;
  /** Color theme applied to the Instructions markdown editor. Defaults to the editor's own default (`'dark'`). */
  markdownEditorTheme?: 'light' | 'dark';
  /** Style overrides. */
  styles?: ScheduledTaskCreateFormStyles;
}
