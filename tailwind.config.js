// Do not use palette directly, only through semantic colors
const colorPalette = {
  green: 'rgb(var(--green, 55 186 188) / <alpha-value>)',
  blue: 'rgb(var(--blue, 90 140 233) / <alpha-value>)',
  violet: 'rgb(var(--violet, 148 89 241) / <alpha-value>)',
  'gray-100': 'rgb(var(--gray-100, 252 252 252) / <alpha-value>)',
  'gray-200': 'rgb(var(--gray-200, 243 244 246) / <alpha-value>)',
  'gray-300': 'rgb(var(--gray-300, 234 237 240) / <alpha-value>)',
  'gray-400': 'rgb(var(--gray-400, 221 225 230) / <alpha-value>)',
  'gray-500': 'rgb(var(--gray-500, 127 135 146) / <alpha-value>)',
  'gray-600': 'rgb(var(--gray-600, 51 57 66) / <alpha-value>)',
  'gray-700': 'rgb(var(--gray-700, 34 41 50) / <alpha-value>)',
  'gray-800': 'rgb(var(--gray-800, 20 26 35) / <alpha-value>)',
  'gray-900': 'rgb(var(--gray-900, 9 13 19) / <alpha-value>)',
  black: 'rgb(var(--black, 0 0 0) / <alpha-value>)',
  'red-200': 'rgb(var(--red-200, 243 214 216) / <alpha-value>)',
  'red-400': 'rgb(var(--red-400, 247 100 100) / <alpha-value>)',
  'red-800': 'rgb(var(--red-800, 174 47 47) / <alpha-value>)',
  'red-900': 'rgb(var(--red-900, 64 32 39) / <alpha-value>)',
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
        l1: {
          DEFAULT: `var(--l1, ${colorPalette['gray-300']})`,
          dark: `var(--l1-dark, ${colorPalette['gray-900']})`,
        },
        l2: {
          DEFAULT: `var(--l2, ${colorPalette['gray-200']})`,
          dark: `var(--l2-dark, ${colorPalette['gray-800']})`,
        },
        l3: {
          DEFAULT: `var(--l3, ${colorPalette['gray-100']})`,
          dark: `var(--l3-dark, ${colorPalette['gray-700']})`,
        },
        l4: {
          DEFAULT: `var(--l4, ${colorPalette['gray-400']})`,
          dark: `var(--l4-dark, ${colorPalette['gray-600']})`,
        },
        'icons-secondaryText': {
          DEFAULT: `var(--icons-secondaryText, ${colorPalette['gray-500']})`,
          dark: `var(--icons-secondaryText-dark, ${colorPalette['gray-500']})`,
        },
        text: {
          DEFAULT: `var(--text, ${colorPalette['gray-800']})`,
          dark: `var(--text-dark, ${colorPalette['gray-200']})`,
        },
        'error-text': {
          DEFAULT: `var(--error-text, ${colorPalette['red-800']})`,
          dark: `var(--error-text-dark, ${colorPalette['red-400']})`,
        },
        'error-bg': {
          DEFAULT: `var(--error-bg, ${colorPalette['red-200']})`,
          dark: `var(--error-bg-dark, ${colorPalette['red-900']})`,
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
