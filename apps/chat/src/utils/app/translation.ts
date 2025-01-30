import { i18n } from 'next-i18next';

import { TranslationOptions } from '@/src/types/translation';

export const translate = (text: string, options?: TranslationOptions) =>
  i18n
    ? options
      ? i18n.t(text, options)
      : (i18n.t(text) as unknown as string)
    : text;
