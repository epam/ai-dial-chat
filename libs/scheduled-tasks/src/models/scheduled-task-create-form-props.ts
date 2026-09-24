import type { EditorThemes } from '@epam/ai-dial-ui-kit';
import type { ReactNode } from 'react';
import type { ScheduledTaskRepeat } from '../types/scheduled-task-schedule';

/** A single option rendered in the Repeat dropdown. */
export interface ScheduledTaskRepeatOption {
  /** Stable identifier for this option, passed back via `onFieldChange('repeat', key)`. */
  key: ScheduledTaskRepeat;
  /** Localized display label for this repeat option. */
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
  /** Prompt text; may be empty when a skill is selected. */
  prompt: string;
  /** Optional selected skill reference, independent of its display metadata. */
  skillUrl?: string;
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
  /** Error shown under the skill field, or at form level when the slot is hidden. */
  skillUrl?: string;
}

/** Localized labels used by the {@link ScheduledTaskCreateForm} component. */
export interface ScheduledTaskCreateFormLabels {
  /** Refinement copy. Defaults to 'Refine with AI'. */
  refineWithAiLabel?: string;
  /** Refinement copy. Defaults to 'Undo'. */
  refineUndoLabel?: string;
  /** Refinement copy. Defaults to 'Could not refine this text. Please try again.'. */
  refineErrorLabel?: string;
  /** Refinement copy. Defaults to 'Refining text'. */
  refinePendingAriaLabel?: string;
  /** Refinement copy. Defaults to 'Text refined. Undo is available.'. */
  refineSuccessAriaLabel?: string;
  /** Refinement copy. Defaults to 'Original text restored.'. */
  refineUndoAriaLabel?: string;
  /** Refinement copy. Defaults to 'No changes were needed.'. */
  refineUnchangedAriaLabel?: string;
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
  /** Time-of-day field label (shown when `repeat` is "daily", "weekly", or "monthly"). */
  timeLabel: string;
  /** Validation message shown under the time field when its visible draft is not a complete `HH:mm` value. */
  timeInvalidLabel: string;
  /** Accessible label for the Repeat dropdown. */
  repeatLabel: string;
  /** Options rendered in the Repeat dropdown. */
  repeatOptions: ScheduledTaskRepeatOption[];
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
  /** Label for the Model or Agent field, rendered above `modelSelector`. */
  modelOrAgentLabel: string;
  /** Description textarea label. */
  descriptionLabel: string;
  /** Accessible label for the Instructions markdown editor. */
  instructionsLabel: string;
  /** Optional label above the host-composed skill selector. */
  skillLabel?: string;
  /** Optional placeholder forwarded to the Instructions editor. */
  instructionsPlaceholder?: string;
  /** Label for the Cancel action. */
  cancelButtonLabel: string;
  /** Label for the Save action (submits the create form). */
  createButtonLabel: string;
  /** Accessible name for the Save action's busy indicator, announced while `isSubmitting` is `true`. Defaults to `'Saving'`. */
  submittingLabel?: string;
}

/**
 * Color overrides for the {@link ScheduledTaskCreateForm} component, applied
 * as CSS custom properties with app theme fallbacks.
 */
export interface ScheduledTaskCreateFormColors {
  /** Refine/Undo and status text color. Defaults to --text-primary. */
  refineActionText?: string;
  /** Refinement error color. Defaults to --text-error. */
  refineErrorText?: string;
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
  /** Refine/Undo typography. Defaults to 'dial-small-text'. */
  refineActionClassName?: string;
  /** Refinement feedback typography. Defaults to 'dial-small-text'. */
  refineFeedbackClassName?: string;
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
  /** Layout values scoped to this form instance. */
  layout?: { detailsWidth?: string; columnGap?: string };
}

/** Props for the {@link ScheduledTaskCreateForm} component. */
export interface ScheduledTaskCreateFormProps {
  /** Optional Description rewrite callback; omission hides its action. */
  onRefineDescription?: (value: string, signal: AbortSignal) => Promise<string>;
  /** Optional Instructions rewrite callback; omission hides its action. */
  onRefineInstructions?: (
    value: string,
    signal: AbortSignal,
  ) => Promise<string>;
  /** Localized labels. */
  labels: ScheduledTaskCreateFormLabels;
  /** Current field values. */
  values: ScheduledTaskCreateFormValues;
  /** Current per-field validation errors. */
  errors: ScheduledTaskCreateFormErrors;
  /**
   * Fully-composed deployment-selector control rendered in the Model or
   * Agent field, in place of a lib-owned control. Opaque to the lib — it is
   * rendered verbatim, wrapped by the lib's own required-label/error markup.
   */
  modelSelector: ReactNode;
  /**
   * Id applied to the Model or Agent field's `Label` element. The host
   * generates this (e.g. via React `useId()`) and must pass the same value
   * as `modelSelector`'s own `aria-labelledby` target, so the two stay
   * linked without a literal id that could collide across form instances.
   */
  modelLabelId: string;
  /** Optional host-composed skill control, rendered above Instructions. */
  skillSelector?: ReactNode;
  /** ID of the skill label; also pass to the control's aria-labelledby. */
  skillLabelId?: string;
  /** ID of the skill error; also pass to the control's aria-describedby. */
  skillErrorId?: string;
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
  /** Color theme applied to the Instructions markdown editor. Defaults to the editor's own default (`EditorThemes.light`). */
  markdownEditorTheme?: EditorThemes;
  /** Optional replacement for the default back icon. */
  backIcon?: ReactNode;
  /** Additional class name on the form root. */
  className?: string;
  /** Style overrides. */
  styles?: ScheduledTaskCreateFormStyles;
}
