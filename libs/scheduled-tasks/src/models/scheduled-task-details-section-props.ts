/** Localized field labels used by the {@link ScheduledTaskDetailsSection} component. */
export interface ScheduledTaskDetailsSectionLabels {
  /** Label for the description field. */
  descriptionLabel: string;
  /** Label for the model/agent field. */
  modelLabel: string;
  /** Label for the recurrence field, e.g. "Repeats". */
  repeatsLabel: string;
  /** Label for the activity-window field, e.g. "Active". */
  activeWindowLabel: string;
}

/** Props for the {@link ScheduledTaskDetailsSection} component. */
export interface ScheduledTaskDetailsSectionProps {
  /** Localized field labels. */
  labels: ScheduledTaskDetailsSectionLabels;
  /** Task description. Omit to hide the field. */
  description?: string;
  /** Resolved "Model or Agent" display value (display name, or the raw id as a fallback). Omit to hide the field. */
  modelLabel?: string;
  /** Pre-formatted recurrence label, e.g. "Every Monday 12:00". Omit to hide the field. */
  repeatsLabel?: string;
  /** Pre-formatted activity-window label, e.g. "Aug 1, 2026 – Dec 31, 2026". Omit to hide the field (unbounded or one-shot schedule). */
  activeWindowLabel?: string;
  /** CSS class applied to each field label. Defaults to `'dial-tiny-text'`. */
  fieldLabelClassName?: string;
  /** CSS class applied to each field value. Defaults to `'dial-small-text'`. */
  fieldValueClassName?: string;
}
