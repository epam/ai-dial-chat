const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('../../tailwind.config.js')],
  content: [
    join(__dirname, 'index.html'),
    join(__dirname, 'src/**/*.{ts,tsx}'),
    join(__dirname, '../../node_modules/@epam/ai-dial-ui-kit/**/*.{js,jsx}'),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
