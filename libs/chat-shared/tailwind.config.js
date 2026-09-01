const { join } = require('path');

const uiKitContent = join(
  __dirname,
  '../../node_modules/@epam/ai-dial-ui-kit/**/*.{js,jsx}',
).replace(/\\/g, '/');

const fileManagerContent = join(
  __dirname,
  '../../node_modules/@epam/ai-dial-react-file-manager/**/*.{js,jsx}',
).replace(/\\/g, '/');

module.exports = {
  presets: [require('../../tailwind.config.js')],
  content: [
    join(__dirname, 'src/**/*.{ts,tsx}').replace(/\\/g, '/'),
    uiKitContent,
    fileManagerContent,
  ],
};
