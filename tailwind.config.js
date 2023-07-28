// Do not use palette directly, only through semantic colors
const colorPalette = {
  green: 'var(--green, #37BABC)',
  'green-bg': 'var(--green-bg, #37BABC26)',
  blue: 'var(--blue, #5A8CE9)',
  'blue-bg': 'var(--blue-bg, #598BE833)',
  violet: 'var(--violet, #9459F1)',
  'violet-bg': 'var(--violet-bg, #945BF12B)',
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
  'blackout-300': 'var(--blackout-300, #090D134C)',
  'blackout-700': 'var(--blackout-700, #090D13B2)',
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
    extend: {
      colors: {
        ...colorPalette,
        'dropdowns-hints': {
          DEFAULT: `var(--dropdowns-hints, ${colorPalette['gray-100']})`,
          dark: `var(--dropdowns-hints-dark, ${colorPalette['black']})`,
        },
        'l1-divider': {
          DEFAULT: `var(--l1-divider, ${colorPalette['gray-300']})`,
          dark: `var(--l1-divider-dark, ${colorPalette['gray-900']})`,
        },
        l2: {
          DEFAULT: `var(--l2, ${colorPalette['gray-200']})`,
          dark: `var(--l2-dark, ${colorPalette['gray-800']})`,
        },
        l3: {
          DEFAULT: `var(--l3, ${colorPalette['gray-100']})`,
          dark: `var(--l3-dark, ${colorPalette['gray-700']})`,
        },
        'l4-stroke': {
          DEFAULT: `var(--l4-stroke, ${colorPalette['gray-400']})`,
          dark: `var(--l4-stroke-dark, ${colorPalette['gray-600']})`,
        },
        'icons-secondaryText': {
          DEFAULT: `var(--icons-secondaryText, ${colorPalette['gray-500']})`,
          dark: `var(--icons-secondaryText-dark, ${colorPalette['gray-500']})`,
        },
        text: {
          DEFAULT: `var(--text, ${colorPalette['gray-800']})`,
          dark: `var(--text-dark, ${colorPalette['gray-200']})`,
        },
        'errorText-errorStroke': {
          DEFAULT: `var(--errorText-errorStroke, ${colorPalette['red-800']})`,
          dark: `var(--errorText-errorStroke-dark, ${colorPalette['red-400']})`,
        },
        'error-bg': {
          DEFAULT: `var(--error-bg, ${colorPalette['red-200']})`,
          dark: `var(--error-bg-dark, ${colorPalette['red-900']})`,
        },
        'accent-main': {
          DEFAULT: `var(--accent-main, ${colorPalette['blue']}`,
          dark: `var(--accent-main, ${colorPalette['blue']}`,
        },
        'accent-bg-main': {
          DEFAULT: `var(--accent-bg-main, ${colorPalette['blue-bg']}`,
          dark: `var(--accent-bg-main, ${colorPalette['blue-bg']}`,
        },
        'accent-left-panel': {
          DEFAULT: `var(--accent-left-panel, ${colorPalette['green']}`,
          dark: `var(--accent-left-panel, ${colorPalette['green']}`,
        },
        'accent-bg-left-panel': {
          DEFAULT: `var(--accent-bg-left-panel, ${colorPalette['green-bg']}`,
          dark: `var(--accent-bg-left-panel, ${colorPalette['green-bg']}`,
        },
        'accent-right-panel': {
          DEFAULT: `var(--accent-right-panel, ${colorPalette['violet']}`,
          dark: `var(--accent-right-panel, ${colorPalette['violet']}`,
        },
        'accent-bg-right-panel': {
          DEFAULT: `var(--accent-bg-right-panel, ${colorPalette['violet-bg']}`,
          dark: `var(--accent-bg-right-panel, ${colorPalette['violet-bg']}`,
        },
        'divider-chat': {
          DEFAULT: `var(--divider-chat, ${colorPalette['gray-400']}`,
          dark: `var(--divider-chat, ${colorPalette['gray-700']}`,
        },
        blackout: {
          DEFAULT: `var(--blackout, ${colorPalette['blackout-300']}`,
          dark: `var(--blackout, ${colorPalette['blackout-700']}`,
        },
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
