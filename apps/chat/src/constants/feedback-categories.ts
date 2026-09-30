import { RateI18nKeys } from './translation-keys';

export const FEEDBACK_CATEGORIES = [
  {
    value: 'UI bug',
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
    value: 'Should have searched the web',
    i18nKey: RateI18nKeys.FeedbackCategoryShouldHaveSearchedTheWeb,
  },
] as const;
