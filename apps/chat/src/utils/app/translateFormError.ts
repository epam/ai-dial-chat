import { notAllowedSymbols } from '@/src/utils/app/file';
import { translate } from '@/src/utils/app/translation';

import { Translation, TranslationOptions } from '@/src/types/translation';

import { MIN_ENTITY_LENGTH } from '@/src/constants/default-ui-settings';

export function translateFormError(
  error: string,
  options?: Omit<TranslationOptions, 'ns'>,
): string {
  const translated = translate(error, {
    ns: Translation.Errors,
    name: 'Name',
    minLength: MIN_ENTITY_LENGTH,
    notAllowedSymbols,
    ...options,
  });

  if (translated !== error) {
    return translated;
  }

  const chatTranslated = translate(error, {
    ns: Translation.Chat,
    ...options,
  });

  if (chatTranslated !== error) {
    return chatTranslated;
  }

  // i18n not yet initialized — manually substitute known interpolation vars from options
  if (options) {
    return Object.entries(options).reduce(
      (result, [key, value]) =>
        result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value)),
      error,
    );
  }

  return error;
}
