import i18n from 'i18next';

/*
 * The active UI language for `X-Lang` completion forwarding. `resolvedLanguage`
 * describes the language actually rendered (the detected `language` can be an
 * untranslated code falling back to English), which is the language the user
 * expects document names and agent answers in. Resolved per request by the
 * stream transport; never cached here.
 */
export const getUiLanguage = (): string | undefined => {
  try {
    const lang = i18n.resolvedLanguage ?? i18n.language;
    return typeof lang === 'string' && lang.length > 0 ? lang : undefined;
  } catch {
    return undefined;
  }
};
