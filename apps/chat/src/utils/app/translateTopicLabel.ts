import { TranslationOptions } from '@/src/types/translation';

import { CommonI18nKeys } from '@/src/constants/i18n';

type TranslateFn = (key: string, options?: TranslationOptions) => string;

const TOPIC_I18N_KEYS: Record<string, CommonI18nKeys> = {
  Business: CommonI18nKeys.TopicBusiness,
  Development: CommonI18nKeys.TopicDevelopment,
  'User Experience': CommonI18nKeys.TopicUserExperience,
  Analysis: CommonI18nKeys.TopicAnalysis,
  SQL: CommonI18nKeys.TopicSQL,
  SDLC: CommonI18nKeys.TopicSDLC,
  'Talk-To-Your-Data': CommonI18nKeys.TopicTalkToYourData,
  RAG: CommonI18nKeys.TopicRAG,
  'Text Generation': CommonI18nKeys.TopicTextGeneration,
  'Image Generation': CommonI18nKeys.TopicImageGeneration,
  'Image Recognition': CommonI18nKeys.TopicImageRecognition,
};

export const TOPIC_I18N_KEY_VALUES = Object.values(TOPIC_I18N_KEYS);

export function translateTopicLabel(topic: string, t: TranslateFn): string {
  const i18nKey = TOPIC_I18N_KEYS[topic];

  if (!i18nKey) {
    return topic;
  }

  const translated = t(i18nKey);

  return translated !== i18nKey ? translated : topic;
}
