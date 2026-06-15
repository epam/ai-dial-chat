import { PromptBarI18nKeys } from '@/src/constants/i18n';

import { TranslationOptions } from '@/src/types/translation';

type TranslateFn = (key: string, options?: TranslationOptions) => string;

export function translatePromptContentPlaceholder(
  _locale: string | undefined,
  t: TranslateFn,
): string {
  return t(PromptBarI18nKeys.ContentUseVariables);
}
