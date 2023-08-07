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
      screens: {
        sm: '560px',
      },
      colors: {
        green: 'rgb(var(--green, 55 186 188) / <alpha-value)', // #37BABC
        blue: {
          500: 'rgb(var(--blue-500, 90 140 233) / <alpha-value>)', // #5A8CE9,
          700: 'rgb(var(--blue-700, 72, 120, 210) / <alpha-value>)', // #4878D2
        },
        violet: 'rgb(var(--violet, 148 89 241) / <alpha-value>)', // #9459F1
        gray: {
          100: 'rgb(var(--gray-100, 252 252 252) / <alpha-value>)', // #FCFCFC
          200: 'rgb(var(--gray-200, 243 244 246) / <alpha-value>)', // #F3F4F6
          300: 'rgb(var(--gray-300, 234 237 240) / <alpha-value>)', // #EAEDF0
          400: 'rgb(var(--gray-400, 221 225 230) / <alpha-value>)', // #DDE1E6, L4 (white)
          500: 'rgb(var(--gray-500, 127 135 146) / <alpha-value>)', // #7F8792, icons, sec text
          600: 'rgb(var(--gray-600, 51 57 66) / <alpha-value>)', // #333942, L4 (dark)
          700: 'rgb(var(--gray-700, 34 41 50) / <alpha-value>)', // #222932
          800: 'rgb(var(--gray-800, 20 26 35) / <alpha-value>)', // #141A23
          900: 'rgb(var(--gray-900, 9 13 19) / <alpha-value>)', // #090D13
        },
        black: 'rgb(var(--black, 0 0 0) / <alpha-value>)', // #000000
        red: {
          200: 'rgb(var(--red-200, 243 214 216) / <alpha-value>)', // #F3D6D8
          400: 'rgb(var(--red-400, 247 100 100) / <alpha-value>)', // #F76464
          800: 'rgb(var(--red-800, 174 47 47) / <alpha-value>)', // #AE2F2F
          900: 'rgb(var(--red-900, 64 32 39) / <alpha-value>)', // #402027
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
