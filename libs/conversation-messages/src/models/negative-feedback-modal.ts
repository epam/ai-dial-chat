import type { NegativeFeedbackCategory } from '../types/negative-feedback-category';

/** User-visible strings of `NegativeFeedbackModal`. */
export interface NegativeFeedbackModalLabels {
  /** Popup header. Defaults to `'Send negative feedback'`. */
  title?: string;
  /** Label of the required category select. Defaults to `'What type of feedback you want to give?'`. */
  feedbackTypeLabel?: string;
  /** Placeholder of the category select. Defaults to `'Select'`. */
  selectPlaceholder?: string;
  /** Placeholder of the optional comment field. Defaults to `'Type an optional comment to your feedback'`. */
  commentPlaceholder?: string;
  /** Label of the submit button. Defaults to `'Send'`. */
  sendLabel?: string;
  /** Display label of each category. A missing entry shows the category's own value. */
  categoryLabels?: Partial<Record<NegativeFeedbackCategory, string>>;
}

/** Props of `NegativeFeedbackModal`. */
export interface NegativeFeedbackModalProps {
  /** Called when the user dismisses the popup without sending. */
  onClose: () => void;
  /** Called with the rating comment: the category value, followed by `: <comment>` when a comment was typed. */
  onSubmit: (comment: string) => void;
  /** Whether the optional free-text comment field is shown. Defaults to `true`. */
  isCommentEnabled?: boolean;
  /** User-visible strings. */
  labels?: NegativeFeedbackModalLabels;
}
