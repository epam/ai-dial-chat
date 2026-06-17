const path = require('path');
const fs = require('fs');

const localesPath = path.resolve('./public/locales');

const defaultLocale = 'en';

const localesFromEnv = process.env.AVAILABLE_LOCALES
  ? process.env.AVAILABLE_LOCALES
      .replace(/[\[\]'"]/g, '')
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean)
  : null;

const locales = (() => {
  const result =
    localesFromEnv ??
    (typeof window === 'undefined' && fs.existsSync(localesPath)
      ? fs.readdirSync(localesPath).filter((dir) => {
          return fs.statSync(path.join(localesPath, dir)).isDirectory();
        })
      : [defaultLocale]);
  return result.includes(defaultLocale) ? result : [defaultLocale, ...result];
})();


module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales,
  },
  localePath:
    typeof window === 'undefined' ? localesPath : '/public/locales',
};
