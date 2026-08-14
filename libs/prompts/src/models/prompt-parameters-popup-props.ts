/** Localizable string labels for the prompt-parameters popup component. */
export interface PromptParametersPopupLabels {
  /** Dialog title. Defaults to `'Prompt parameters'`. */
  title?: string;
  /** Accessible label for the close button. Defaults to `'Close'`. */
  closeLabel?: string;
  /** Accessible label for the back chevron, shown only when `onBack` is provided. Defaults to `'Back'`. */
  backLabel?: string;
  /** Heading for the parameters column. Defaults to `'Parameters'`. */
  parametersLabel?: string;
  /** Heading for the details column. Defaults to `'Details'`. */
  detailsLabel?: string;
  /** Placeholder shown in each empty parameter field. Defaults to `'Enter value'`. */
  enterValuePlaceholder?: string;
  /** Label for the footer Cancel button. Defaults to `'Cancel'`. */
  cancelLabel?: string;
  /** Label for the footer Submit button. Defaults to `'Confirm'`. */
  submitLabel?: string;
}

/** CSS custom-property overrides for the prompt-parameters popup component. */
export interface PromptParametersPopupColors {
  /** Background color of the prompt summary card. Defaults to `--bg-layer-sunken`. */
  cardBackground?: string;
  /** Border color of the prompt summary card. Defaults to `--stroke-tertiary`. */
  cardBorder?: string;
}

/** Props for the prompt-parameters popup component. */
export interface PromptParametersPopupProps {
  /** Whether the popup is open. */
  open: boolean;
  /** The selected prompt's display name, shown in the summary card. */
  promptName: string;
  /** The selected prompt's full content, including `{{param}}` tokens — rendered read-only in the Details column. */
  content: string;
  /** Short summary shown above the divider in the Details column. Omitted when empty. */
  description?: string;
  /**
   * Distinct `{{param}}` names found in `content`, in first-occurrence order.
   * One required field is rendered per entry.
   */
  parameters: string[];
  /**
   * Called to return to the previous screen (the browse modal). When omitted,
   * no back chevron is rendered — the popup was opened directly from a favorite.
   */
  onBack?: () => void;
  /** Called when the popup is dismissed via the close button. */
  onClose: () => void;
  /** Called with the entered values, keyed by parameter name, when Submit is clicked. */
  onSubmit: (values: Record<string, string>) => void;
  /** Called when the Cancel button is clicked. */
  onCancel: () => void;
  /** Localizable string overrides. */
  labels?: PromptParametersPopupLabels;
  /** Color overrides applied as CSS custom properties. */
  colors?: PromptParametersPopupColors;
  /** CSS class applied to the popup title. Defaults to `'dial-h2-text'`. */
  titleClassName?: string;
  /** CSS class applied to the "Parameters" column heading. Defaults to `'dial-h2-text'`. */
  parametersLabelClassName?: string;
  /** CSS class applied to the "Details" column heading. Defaults to `'dial-h2-text'`. */
  detailsLabelClassName?: string;
}
