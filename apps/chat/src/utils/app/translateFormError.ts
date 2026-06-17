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

  return chatTranslated !== error ? chatTranslated : error;
}
