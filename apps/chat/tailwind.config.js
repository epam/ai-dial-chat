const { join } = require('path');
const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('../../tailwind.config.js')],
  content: [
    join(
      __dirname,
      '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}',
    ),
    ...createGlobPatternsForDependencies(__dirname),
    join(__dirname, '../../node_modules/@epam/ai-dial-ui-kit/**/*.{js,jsx}'),
    join(
      __dirname,
      '../../node_modules/@epam/ai-dial-react-file-manager/**/*.{js,jsx}',
    ),
  ],
  theme: {
    extend: {
      backgroundColor: {
        'avatar-bg': '#60D239',
      },
      textColor: {
        'avatar-initials': '#000000',
      },
      keyframes: {
        spin: {
          to: { transform: 'rotate(1turn)' },
        },
      },
      animation: {
        'spin-steps': 'spin 0.75s steps(8) infinite',
      },
    },
  },
  plugins: [],
};
