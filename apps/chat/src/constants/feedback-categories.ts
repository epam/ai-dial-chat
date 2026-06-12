import { RateI18nKeys } from './translation-keys';

export const FEEDBACK_CATEGORIES = [
  {
    value: 'Ui bug',
    i18nKey: RateI18nKeys.FeedbackCategoryUiBug,
  },
  {
    value: 'Overactive refusal',
    i18nKey: RateI18nKeys.FeedbackCategoryOveractiveRefusal,
  },
  {
    value: 'Incomplete response',
    i18nKey: RateI18nKeys.FeedbackCategoryIncompleteResponse,
  },
  {
    value: 'Should have triggered thinking',
    i18nKey: RateI18nKeys.FeedbackCategoryShouldHaveTriggeredThinking,
  },
  {
    value: 'Should have search the web',
    i18nKey: RateI18nKeys.FeedbackCategoryShouldHaveSearchedTheWeb,
  },
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]['value'];
