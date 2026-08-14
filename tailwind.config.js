// Default color palette is light when no themes presented

const backgroundsColors = {
  transparent: 'transparent',
  'layer-sunken': 'var(--bg-layer-sunken, #EEF1F7)', // grey-300
  'layer-base': 'var(--bg-layer-base, #F5F7FA)', // grey-200
  'layer-raised': 'var(--bg-layer-raised, #FCFCFC)', // grey-100
  error: 'var(--bg-error, #F3D6D8)', // red-100
  warning: 'var(--bg-warning, #FAF0CF)', // yellow-100
  info: 'var(--bg-info, #E1EAF9)', // blue-100
  success: 'var(--bg-success, #DBF1EB)', // green-100
  backdrop: 'var(--bg-backdrop, #161B2D4D)', // grey-1000 with 30% opacity

  // shadow colors
  'shadow-blue': 'var(--shadow-blue-500, #2764D924)',
  'shadow-grey': 'var(--shadow-grey-1000, #161B2D08)',
};

const controlsBgColors = {
  'control-accent-alpha': 'var(--bg-control-accent-alpha, #2764D90F)', // blue-500 alpha-6
  'control-accent-alpha-hover':
    'var(--bg-control-accent-alpha-hover, #2764D924)', // blue-500 alpha-14
  'control-accent-alpha-active':
    'var(--bg-control-accent-alpha-active, #2764D933)', // blue-500 alpha-20

  'control-accent': 'var(--bg-control-accent, #124ACE)', // blue-500

  'control-neutral': 'var(--bg-control-neutral, #FCFCFC)', // grey-100
  'control-neutral-hover': 'var(--bg-control-neutral-hover, #E0E6F0)', // grey-500
  'control-neutral-active': 'var(--bg-control-neutral-active, #D1DBEA)', // grey-600

  'control-error': 'var(--bg-control-error, #AE2F2F)', // red-800
  'control-error-hover': 'var(--bg-control-error-hover, #BF3939)', // red-700
  'control-error-active': 'var(--bg-control-error-active, #CC4545)', // red-600
  'control-error-alpha-hover': 'var(--bg-control-error-alpha-hover, #F764641A)', // red-800 alpha-10
  'control-error-alpha-active':
    'var(--bg-control-error-alpha-active, #F7646433)', // red-800 alpha-20

  'control-disable': 'var(--bg-control-disable, #848E9C)', // grey-700
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
  secondary: 'var(--stroke-secondary, #D1DBEA)', // grey-600
  tertiary: 'var(--stroke-tertiary, #E0E6F0)', // grey-500
  error: 'var(--stroke-error, #AE2F2F)', // red-800
  warning: 'var(--stroke-warning, #EEC840)', // yellow-500
  info: 'var(--stroke-info, #124ACE)', // blue-500
  success: 'var(--stroke-success, #007274)', // green-800
  // `@epam/ai-dial-react-file-manager`'s selected-row indicator renders
  // `border-l-accent-primary`; without this token that class compiled to
  // nothing, so the border fell back to the browser default (currentColor —
  // a black bar) instead of the intended accent color.
  'accent-primary': 'var(--stroke-accent-primary, var(--stroke-info, #124ACE))',

  // controls
  'hover-alpha': 'var(--stroke-hover-alpha, #2764D933)', // blue-500 alpha-20
  'focus-black': 'var(--stroke-focus-black, #161B2D)', // grey-1000
  'focus-blue': 'var(--stroke-focus-blue, #6785FB)', // blue-200
  'accent-alpha': 'var(--stroke-accent-alpha, #2764D933)', // blue-500 alpha-20
  'error-alpha': 'var(--stroke-error-alpha, #AE2F2F73)', // red-800 alpha-45
};

const textColors = {
  transparent: 'transparent',
  primary: 'var(--text-primary, #161B2D)', // grey-1000
  secondary: 'var(--text-secondary, #57647a)', // grey-800
  tertiary: 'var(--text-tertiary, #848e9c)', // grey-700
  accent: 'var(--text-accent, #1D4ED8)', // blue-500
  error: 'var(--text-error, #AE2F2F)', // red-500
  warning: 'var(--text-warning, #7F6300)', // yellow-700
  'warning-icon': 'var(--text-warning-icon, #EEC840)', // yellow-500
  info: 'var(--text-info, #1D4ED8)', // blue-500
  success: 'var(--text-success, #007274)', // green-800
};

const placeholderColor = {
  primary: 'var(--text-primary, #161B2D)', // grey-1000
};

const controlsTextColors = {
  'control-permanent': 'var(--text-control-permanent, #FCFCFC)', // grey-100
  'control-disable-alpha': 'var(--text-control-disable-alpha, #DCE0E8)', // grey-550
  'control-disable-beta': 'var(--text-control-disable-beta, #848E9C)', // grey-700
  'control-blue-hover': 'var(--text-control-blue-hover, #5976E9)', // blue-300
  'control-blue-active': 'var(--text-control-blue-active, #6785FB)', // blue-200
};

// remove
const textColorsToRemove = {
  'accent-secondary': 'var(--text-accent-secondary, #37BABC)',
};

const bgColorsToRemove = {
  'layer-1': 'var(--bg-layer-1, #E0E6F0)',
  'layer-4': 'var(--bg-layer-4, #D1DBEA)',
  'layer-6': 'var(--bg-layer-6, #F8FAFC)',
  'layer-7': 'var(--bg-layer-7, #00000006)',
  overlay: 'var(--bg-overlay, #FCFCFC80)',
  inverted: 'var(--bg-inverted, #161B2D)',
  'accent-primary-alpha': 'var(--bg-accent-primary-alpha, #7DA4FF2E)',
  // Catalog tab bar — override via CSS custom properties for dark-theme support
  'accent-tertiary-alpha': 'var(--bg-accent-tertiary-alpha, #A972FF2E)',
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
      ...bgColorsToRemove,
      ...controlsBgColors,
      ...visualBgColors,
    },
    borderColor: borderColors,
    stroke: borderColors,
    divideColor: borderColors,
    placeholderColor: placeholderColor,
    textColor: {
      ...textColors,
      ...textColorsToRemove,
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
       * `outline` emits a 1px solid ring and `outline-focus-black` paints it with the
       * focus token — see the focus-visible states in buttons.scss. Kept in
       * `extend` so the numeric widths (`outline-1`, still used in libs/*) stay.
       */
      outlineWidth: { DEFAULT: '1px' },
      outlineColor: borderColors,
      boxShadow: {
        DEFAULT: '0 0 4px 0 var(--shadow-default, rgba(0, 0, 0, 0.30))',
        'main-inset': 'inset 1px 0 8px rgba(0, 0, 0, 0.04)',
        xs: '0 1px 4px 0 var(--shadow-grey-1000, #161B2D08), 0 1px 2px 0 var(--bg-control-accent-alpha-hover, #2764D924)',
        sm: '0 2px 12px 0 var(--shadow-grey-1000, #161B2D08), 0 2px 6px 0 var(--bg-control-accent-alpha-hover, #2764D924)',
        md: '0 6px 24px 0 var(--shadow-grey-1000, #161B2D08), 0 6px 16px 0 var(--bg-control-accent-alpha-hover, #2764D924)',
        lg: '0 10px 36px 0 var(--shadow-grey-1000, #161B2D08), 0 10px 24px 0 var(--bg-control-accent-alpha-hover, #2764D924)',
      },
      borderRadius: {
        DEFAULT: '4px',
      },
      opacity: {
        15: '15%',
      },
      colors: {
        transparent: 'transparent',
      },
      fontFamily: {
        DEFAULT: ['var(--theme-font, var(--font-inter))'],
      },
      fontSize: {
        xxs: '10px',
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
      typography: {
        DEFAULT: {
          css: {
            color: 'var(--text-primary, #161B2D)',
            a: {
              color: 'var(--text-accent, #1D4ED8)',
            },
            pre: {
              border: 'none',
              borderRadius: '0',
              backgroundColor: 'transparent',
            },
          },
        },
      },
    },
  },
  plugins: [],
};
