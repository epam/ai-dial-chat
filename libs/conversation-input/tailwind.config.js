const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('../../tailwind.config.js')],
  content: [join(__dirname, 'src/**/*.{ts,tsx}')],
};
