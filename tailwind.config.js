const colorPalette = {
  green: 'rgb(var(--green, 55 186 188)) / <alpha-value)', // rgb(55, 186, 188)
  blue: 'rgb(var(--blue, 90 140 233)) / <alpha-value>)', // rgb(90, 140, 233)
  violet: 'rgb(var(--violet, 148 89 241)) / <alpha-value>)', // rgb(148, 89, 241)
  gray: {
    100: 'rgb(var(--gray-100, 252 252 252)) / <alpha-value>)', // rgb(252, 252, 252)
    200: 'rgb(var(--gray-200, 243 244 246)) / <alpha-value>)', // rgb(243, 244, 246)
    300: 'rgb(var(--gray-300, 234 237 240)) / <alpha-value>)', // rgb(234, 237, 240)
    400: 'rgb(var(--gray-400, 221 225 230)) / <alpha-value>)', // rgb(221, 225, 230)
    500: 'rgb(var(--gray-500, 127 135 146)) / <alpha-value>)', // rgb(127, 135, 146)
    600: 'rgb(var(--gray-600, 51 57 66)) / <alpha-value>)', // rgb(51, 57, 66)
    700: 'rgb(var(--gray-700, 34 41 50)) / <alpha-value>)', // rgb(34, 41, 50)
    800: 'rgb(var(--gray-800, 20 26 35)) / <alpha-value>)', // rgb(20, 26, 35)
    900: 'rgb(var(--gray-900, 9 13 19)) / <alpha-value>)', // rgb(9, 13, 19)
  },
  black: 'rgb(var(--black, 0 0 0)) / <alpha-value>)', // rgb(0, 0, 0)
  red: {
    200: 'rgb(var(--red-200, 243 214 216)) / <alpha-value>)', // rgb(243, 214, 216)
    400: 'rgb(var(--red-400, 247 100 100)) / <alpha-value>)', // rgb(247, 100, 100)
    800: 'rgb(var(--red-800, 174 47 47)) / <alpha-value>)', // rgb(174, 47, 47)
    900: 'rgb(var(--red-900, 64 32 39)) / <alpha-value>)', // rgb(64, 32, 39)
  },
};

// Do not use palette directly, only through semantic colors
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
        primary: `var(--primary, ${colorPalette.blue})`,
        'secondary-1': `var(--secondary-1, ${colorPalette.violet})`,
        'secondary-2': `var(--secondary-2, ${colorPalette.green})`,
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
