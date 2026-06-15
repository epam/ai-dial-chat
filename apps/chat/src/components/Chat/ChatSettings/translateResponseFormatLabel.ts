import { ChatI18nKeys } from '@/src/constants/i18n';

import { ConversationResponseFormat } from '@epam/ai-dial-shared';

type TranslateFn = (key: string) => string;

export function translateResponseFormatLabel(
  key: string,
  _locale: string | undefined,
  t: TranslateFn,
): string {
  return t(key);
}

export function translateResponseFormatValue(
  format: ConversationResponseFormat,
  locale: string | undefined,
  t: TranslateFn,
): string {
  if (format === ConversationResponseFormat.Markdown) {
    return translateResponseFormatLabel(ChatI18nKeys.Markdown, locale, t);
  }

  if (format === ConversationResponseFormat.PlainText) {
    return translateResponseFormatLabel(ChatI18nKeys.PlainText, locale, t);
  }

  return format;
}
