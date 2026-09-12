/** Localized labels read by the {@link BuilderFormActions} action pair. */
export interface BuilderFormActionsLabels {
  /** Label for the cancel action. */
  cancelButtonLabel: string;
  /** Label for the submit action. */
  submitButtonLabel: string;
}

/** Props for the {@link BuilderFormActions} component. */
export interface BuilderFormActionsProps {
  /** Localized labels for the two actions. */
  labels: BuilderFormActionsLabels;
  /** Called when the user activates the cancel action. */
  onCancel: () => void;
  /** Called when the user activates the submit action. */
  onSubmit: () => void;
  /** When `true`, the cancel action is disabled. Defaults to `false`. */
  isCancelDisabled?: boolean;
  /** When `true`, the submit action is disabled. Defaults to `false`. */
  isSubmitDisabled?: boolean;
  /** When `true`, the submit action shows a spinner and reports `aria-busy`. Defaults to `false`. */
  isSubmitting?: boolean;
  /** CSS class applied to both action buttons (e.g. `flex-1` for an equal-width pair). */
  buttonClassName?: string;
}
