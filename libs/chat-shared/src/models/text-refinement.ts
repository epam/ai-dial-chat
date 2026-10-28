/** Translatable copy for `TextRefinementField`; every key has an English default. */
export interface TextRefinementLabels {
  /** Refinement copy. Defaults to 'Refine with AI'. */
  refineWithAiLabel?: string;
  /** Label of the action while a request is pending. Defaults to 'Refining'. */
  refineRefiningLabel?: string;
  /** Label of the action that refines the original draft again after a result. Defaults to 'Regenerate'. */
  refineRegenerateLabel?: string;
  /** Label of the action that restores the pre-refine draft. Defaults to 'Restore original'. */
  refineUndoLabel?: string;
  /** Refinement copy. Defaults to 'Could not refine this text. Please try again.'. */
  refineErrorLabel?: string;
  /** Refinement copy. Defaults to 'Refining text'. */
  refinePendingAriaLabel?: string;
  /** Refinement copy. Defaults to 'Text refined'. */
  refineSuccessAriaLabel?: string;
  /** Refinement copy. Defaults to 'Original text restored.'. */
  refineUndoAriaLabel?: string;
  /** Refinement copy. Defaults to 'No changes were needed.'. */
  refineUnchangedAriaLabel?: string;
}
