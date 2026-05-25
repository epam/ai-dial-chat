// Well-known RTL language codes per IANA/Unicode CLDR
export const RTL_LANGUAGES = [
  'ar', // Arabic
  'he', // Hebrew
  'fa', // Persian/Farsi
  'ur', // Urdu
  'yi', // Yiddish
  'ku', // Kurdish (Sorani)
  'ckb', // Central Kurdish
  'dv', // Divehi/Maldivian
  'ps', // Pashto
  'sd', // Sindhi
  'ug', // Uyghur
  'pnb', // Western Punjabi (Shahmukhi)
  'mzn', // Mazanderani
  'lrc', // Northern Luri
];

export const isRtlLocale = (locale: string): boolean => {
  const language = new Intl.Locale(locale).language;
  const localeWithTextInfo = new Intl.Locale(locale) as Intl.Locale & {
    getTextInfo?: () => { direction: string };
  };
  return (
    localeWithTextInfo.getTextInfo?.().direction === 'rtl' ||
    RTL_LANGUAGES.includes(language)
  );
};
