import { translate } from '@/src/utils/app/translation';

import { Translation, TranslationOptions } from '@/src/types/translation';

const ERROR_NAMESPACES = [
  Translation.Common,
  Translation.Chat,
  Translation.Errors,
] as const;

export function translateErrorMessage(
  message: string,
  options?: Omit<TranslationOptions, 'ns'>,
): string {
  for (const ns of ERROR_NAMESPACES) {
    const translated = translate(message, { ...options, ns });
    if (translated !== message) {
      return translated;
    }
  }

  return message;
}
