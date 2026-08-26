// Default color palette is light when no themes presented

const backgroundsColors = {
  transparent: 'transparent',
  'layer-sunken': 'var(--bg-layer-sunken, #EEF1F7)', // grey-150
  'layer-base': 'var(--bg-layer-base, #F5F7FA)', // grey-100
  'layer-raised': 'var(--bg-layer-raised, #FCFCFC)', // grey-50
  error: 'var(--bg-error, #F3D6D8)', // red-100
  warning: 'var(--bg-warning, #FAF0CF)', // yellow-100
  info: 'var(--bg-info, #E1EAF9)', // blue-100
  success: 'var(--bg-success, #DBF1EB)', // green-100
  backdrop: 'var(--bg-backdrop, #161B2D4D)', // grey-1000 alpha-30
};

const shadowColors = {
  'xs-sm-1': 'var(--shadow-xs-sm-1, #2764D933)', // blue-500 alpha-20
  'xs-sm-2': 'var(--shadow-xs-sm-2, #161B2D08)', // grey-1000 alpha-3
  md: 'var(--shadow-md, #2764D90A)', // blue-500 alpha-4
  lg: 'var(--shadow-lg, #2764D914)', // blue-500 alpha-8
};

const controlsBgColors = {
  /*
   * Accent gradient stops, numbered by position instead of being named after
   * one gradient that uses them. The pre-0.14 ui-kit variable names stay in the
   * fallback chain for themes that still set them.
   */
  'gradient-1': 'var(--bg-gradient-1, #1D4ED8)', // blue-500
  'gradient-1-hover': 'var(--bg-gradient-1-hover, #6785FB)', // blue-200
  'gradient-1-active': 'var(--bg-gradient-1-active, #1D4ED8)', // blue-500
  'gradient-2': 'var(--bg-gradient-2, #885DF2)', // violet-300
  'gradient-2-hover': 'var(--bg-gradient-2-hover, #885DF2)', // violet-300
  'gradient-2-active': 'var(--bg-gradient-2-active, #7C3AED)', // violet-500

  'control-accent-alpha': 'var(--bg-control-accent-alpha, #2764D90F)', // blue-500 alpha-6
  'control-accent-alpha-hover':
    'var(--bg-control-accent-alpha-hover, #2764D924)', // blue-500 alpha-14
  'control-accent-alpha-active':
    'var(--bg-control-accent-alpha-active, #2764D933)', // blue-500 alpha-20

  'control-accent': 'var(--bg-control-accent, #1D4ED8)', // blue-500
  'control-accent-hover': 'var(--bg-control-accent-hover, #5976E9)', // blue-300

  'control-neutral': 'var(--bg-control-neutral, #FCFCFC)', // grey-50
  'control-neutral-hover-muted':
    'var(--bg-control-neutral-hover-muted, var(--bg-control-neutral-hover, #E0E6F0))', // grey-250
  'control-neutral-hover-strong':
    'var(--bg-control-neutral-hover-strong, #848E9C)', // grey-600
  'control-neutral-active': 'var(--bg-control-neutral-active, #D1DBEA)', // grey-350
  'control-neutral-default': 'var(--bg-control-neutral-default, #ACB3C3)', // grey-450
  'control-inverted': 'var(--bg-control-inverted, #57647A)', // grey-800

  'control-error': 'var(--bg-control-error, #AE2F2F)', // red-800
  'control-error-hover': 'var(--bg-control-error-hover, #BF3939)', // red-700
  'control-error-active': 'var(--bg-control-error-active, #CC4545)', // red-600
  'control-error-alpha-hover': 'var(--bg-control-error-alpha-hover, #F764641A)', // red-800 alpha-10
  'control-error-alpha-active':
    'var(--bg-control-error-alpha-active, #F7646433)', // red-800 alpha-20

  'control-disable-primary':
    'var(--bg-control-disable-primary, var(--bg-control-disable, #DCE0E8))', // grey-300
  'control-disable-secondary': 'var(--bg-control-disable-secondary, #ACB3C3)', // grey-450
};

const visualBgColors = {
  blue: 'var(--bg-visual-blue, #D6EDF9)', // blue-50
  'green-1': 'var(--bg-visual-green-1, #CDE8E5)', // green-200
  'green-2': 'var(--bg-visual-green-2, #D1F0DC)', // green-300
  brown: 'var(--bg-visual-brown, #FDE8D8)', // brown-300
  red: 'var(--bg-visual-red, #FCE7F3)', // red-200
  'violet-1': 'var(--bg-visual-violet-1, #DDE3F9)', // violet-100
  'violet-2': 'var(--bg-visual-violet-2, #F1E9FF)', // violet-150
};

const visualTextColors = {
  blue: 'var(--text-visual-blue, #1189C8)', // blue-250
  'green-1': 'var(--text-visual-green-1, #059669)', // green-500
  'green-2': 'var(--text-visual-green-2, #0D6E72)', // green-600
  'green-3': 'var(--text-visual-green-3, #065F46)', // green-900
  'brown-1': 'var(--text-visual-brown-1, #D36817)', // brown-400
  'brown-2': 'var(--text-visual-brown-2, #B45309)', // brown-500
  red: 'var(--text-visual-red, #9D174D)', // red-900
  'violet-1': 'var(--text-visual-violet-1, #7C3AED)', // violet-500
  'violet-2': 'var(--text-visual-violet-2, #3730B7)', // violet-800
};

const borderColors = {
  transparent: 'transparent',
  primary: 'var(--stroke-primary, #57647A)', // grey-800
  secondary: 'var(--stroke-secondary, #D1DBEA)', // grey-350
  tertiary: 'var(--stroke-tertiary, #E0E6F0)', // grey-250
  error: 'var(--stroke-error, #AE2F2F)', // red-800
  warning: 'var(--stroke-warning, #EEC840)', // yellow-500
  info: 'var(--stroke-info, #1D4ED8)', // blue-500
  accent: 'var(--stroke-accent, #1D4ED8)', // blue-500
  success: 'var(--stroke-success, #007274)', // green-800
  'accent-primary': 'var(--stroke-accent-primary, var(--stroke-info, #1D4ED8))',

  // controls
  default: 'var(--stroke-default, #B2C2DD)', // grey-400
  'accent-alpha': 'var(--stroke-accent-alpha, #2764D933)', // blue-500 alpha-20
  'gradient-1': 'var(--stroke-gradient-1, #5976E9)', // blue-300
  'gradient-2': 'var(--stroke-gradient-2, #885DF2)', // violet-300
  focus: 'var(--stroke-focus-black, var(--stroke-focus, #161B2D))', // grey-1000
  'accent-focus':
    'var(--stroke-accent-focus, var(--stroke-focus-blue, #6785FB))', // blue-200
  'error-alpha': 'var(--stroke-error-alpha, #AE2F2F73)', // red-800 alpha-45
  'control-disable-primary':
    'var(--stroke-control-disable-primary, var(--text-control-disable-primary, var(--text-control-disable-alpha, #848E9C)))', // grey-600
};

const textColors = {
  transparent: 'transparent',
  primary: 'var(--text-primary, #161B2D)', // grey-1000
  secondary: 'var(--text-secondary, #57647a)', // grey-800
  tertiary: 'var(--text-tertiary, #848e9c)', // grey-600
  accent: 'var(--text-accent, #1D4ED8)', // blue-500
  error: 'var(--text-error, #AE2F2F)', // red-500
  warning: 'var(--text-warning, #7F6300)', // yellow-800
  'warning-icon': 'var(--text-warning-icon, #EEC840)', // yellow-500
  info: 'var(--text-info, #1D4ED8)', // blue-500
  success: 'var(--text-success, #007274)', // green-800
};

const placeholderColor = {
  primary: 'var(--text-primary, #161B2D)', // grey-1000
};

const controlsTextColors = {
  'control-permanent': 'var(--text-control-permanent, #FCFCFC)', // grey-50
  'control-inverted': 'var(--text-control-inverted, #FCFCFC)', // grey-50
  'control-disable-primary':
    'var(--text-control-disable-primary, var(--text-control-disable-alpha, #848E9C))', // grey-600
  'control-disable-secondary':
    'var(--text-control-disable-secondary, var(--text-control-disable-beta, #DCE0E8))', // grey-300
  'control-accent-hover':
    'var(--text-control-accent-hover, var(--text-control-blue-hover, #5976E9))', // blue-300
  'control-accent-active':
    'var(--text-control-accent-active, var(--text-control-blue-active, #6785FB))', // blue-200
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  blocklist: ['[-:=]'],
  content: [
    './apps/chat/src/**/*.{html,js,ts,tsx,yaml}',
    './node_modules/@epam/ai-dial-ui-kit/**/*.{js,ts,jsx,tsx}',
    './node_modules/@epam/ai-dial-react-file-manager/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    backgroundColor: {
      ...backgroundsColors,
      ...controlsBgColors,
      ...visualBgColors,
    },
    borderColor: borderColors,
    stroke: borderColors,
    divideColor: borderColors,
    placeholderColor: placeholderColor,
    textColor: {
      ...textColors,
      ...controlsTextColors,
      ...visualTextColors,
    },
    gradientColorStops: backgroundsColors,

    extend: {
      screens: {
        mobile: { max: '768px' },
        desktop: { min: '769px' },
      },
      /*
       * `outline` emits a 1px solid ring and `outline-focus` paints it with the
       * focus token — see the focus-visible states in buttons.scss. Kept in
       * `extend` so the numeric widths (`outline-1`, still used in libs/*) stay.
       */
      outlineWidth: { DEFAULT: '1px' },
      outlineColor: borderColors,
      /*
       * SVG fills paint surfaces (a tooltip arrow, a chart area), so the fill
       * scale follows the background tokens the way `stroke` follows the border
       * ones. Extended rather than replaced, so `fill-none` / `fill-current` stay.
       */
      fill: {
        ...backgroundsColors,
        ...controlsBgColors,
        ...visualBgColors,
      },
      boxShadow: {
        // xs — Button-Pressed; sm — Button-Default, Side Panel
        xs: `0 1px 4px 0 ${shadowColors['xs-sm-1']}, 0 1px 2px 0 ${shadowColors['xs-sm-2']}`,
        sm: `0 2px 12px 0 ${shadowColors['xs-sm-1']}, 0 2px 6px 0 ${shadowColors['xs-sm-2']}`,
        /*
         * md — Button-Hover, Card-Default, Input; lg — Card-Hover. Both are a
         * single wide blue layer: the grey layer would only muddy it at this
         * size.
         */
        md: `0 8px 24px 0 ${shadowColors.md}`,
        lg: `0 8px 44px 0 ${shadowColors.lg}`,
      },
      borderRadius: {
        DEFAULT: '4px',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 100ms ease-in',
      },
    },
  },
  plugins: [],
};
