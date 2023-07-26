// Do not use palette directly, only through semantic colors
const colorPalette = {
  green: 'var(--green, #37BABC)',
  blue: 'var(--blue, #5A8CE9)',
  violet: 'var(--violet, #9459F1)',
  'gray-100': 'var(--gray-100, #FCFCFC)',
  'gray-200': 'var(--gray-200, #F3F4F6)',
  'gray-300': 'var(--gray-300, #EAEDF0)',
  'gray-400': 'var(--gray-400, #DDE1E6)',
  'gray-500': 'var(--gray-500, #7F8792)',
  'gray-600': 'var(--gray-600, #333942)',
  'gray-700': 'var(--gray-700, #222932)',
  'gray-800': 'var(--gray-800, #141A23)',
  'gray-900': 'var(--gray-900, #090D13)',
  black: 'var(--black, #000000)',
  'red-200': 'var(--red-200, #F3D6D8)',
  'red-400': 'var(--red-400, #F76464)',
  'red-800': 'var(--red-800, #AE2F2F)',
  'red-900': 'var(--red-900, #402027)',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    colors: {
      ...colorPalette,
      'dropdowns-hints': {
        DEFAULT: `var(--dropdowns-hints, ${colorPalette['gray-100']})`,
        dark: `var(--dropdowns-hints, ${colorPalette['black']})`,
      },
      l1: {
        DEFAULT: `var(--l1, ${colorPalette['gray-300']})`,
        dark: `var(--l1, ${colorPalette['gray-900']})`,
      },
      l2: {
        DEFAULT: `var(--l2, ${colorPalette['gray-200']})`,
        dark: `var(--l2, ${colorPalette['gray-800']})`,
      },
      l3: {
        DEFAULT: `var(--l3, ${colorPalette['gray-100']})`,
        dark: `var(--l3, ${colorPalette['gray-700']})`,
      },
      l4: {
        DEFAULT: `var(--l4, ${colorPalette['gray-400']})`,
        dark: `var(--l4, ${colorPalette['gray-600']})`,
      },
      'icons-secondaryText': {
        DEFAULT: `var(--icons-secondaryText, ${colorPalette['gray-500']})`,
        dark: `var(--icons-secondaryText, ${colorPalette['gray-500']})`,
      },
      text: {
        DEFAULT: `var(--text, ${colorPalette['gray-800']})`,
        dark: `var(--text, ${colorPalette['gray-200']})`,
      },
      'error-text': {
        DEFAULT: `var(--error-text, ${colorPalette['red-800']})`,
        dark: `var(--error-text, ${colorPalette['red-400']})`,
      },
      'error-bg': {
        DEFAULT: `var(--error-bg, ${colorPalette['red-200']})`,
        dark: `var(--error-bg, ${colorPalette['red-900']})`,
      },
    },
  },
  variants: {
    extend: {
      visibility: ['group-hover'],
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
