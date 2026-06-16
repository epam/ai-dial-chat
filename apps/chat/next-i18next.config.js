const path = require('path');
const fs = require('fs');

const localesPath = path.resolve('./public/locales');

const locales =
  typeof window === 'undefined' && fs.existsSync(localesPath)
    ? fs.readdirSync(localesPath).filter((dir) => {
        return fs.statSync(path.join(localesPath, dir)).isDirectory();
      })
    : ['en'];


module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales,
  },
  localePath:
    typeof window === 'undefined' ? localesPath : '/public/locales',
};
