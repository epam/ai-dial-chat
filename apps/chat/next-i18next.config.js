const defaultLocale = process.env.DEFAULT_LOCALE || 'en';

module.exports = {
  i18n: {
    defaultLocale,
    locales: ['en', 'ar'],
  },
  localePath:
    typeof window === 'undefined'
      ? require('path').resolve('./public/locales')
      : '/public/locales',
};
