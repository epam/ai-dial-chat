import i18n from 'i18next';

/*
 * The active UI language for `X-Lang` completion forwarding. `i18n.language`
 * is the app's current locale — the language the user chose for the UI and the
 * best predictor of the language they expect documents and names in. It may
 * be a code without a registered translation bundle (e.g. a detected `uk`
 * falling back to English rendering), which still must be forwarded instead
 * of collapsing to `resolvedLanguage`'s `en`. Resolved per request by the
 * stream transport; never cached here.
 */
export const getUiLanguage = (): string | undefined => {
  const lang = i18n.language;
  return typeof lang === 'string' && lang.length > 0 ? lang : undefined;
};
