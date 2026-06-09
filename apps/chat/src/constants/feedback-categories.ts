export const FEEDBACK_CATEGORIES = [
  'Ui bug',
  'Overactive refusal',
  'Incomplete response',
  'Should have triggered thinking',
  'Should have search the web',
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
