const { join } = require('path');
const fileManagerContent = join(
  __dirname,
  '../../node_modules/@epam/ai-dial-react-file-manager/dist/**/*.{js,ts,jsx,tsx}',
).replace(/\\/g, '/');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('../../tailwind.config.js')],
  content: [join(__dirname, 'src/**/*.{ts,tsx}'), fileManagerContent],
};
