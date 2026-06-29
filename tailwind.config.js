// Default color palette is black when no themes presented

const backgroundsColors = {
  transparent: 'transparent',
  'layer-0': 'var(--bg-layer-0, #000000)',
  'layer-1': 'var(--bg-layer-1, #0C101D)',
  'layer-2': 'var(--bg-layer-2, #161B2D)',
  'layer-3': 'var(--bg-layer-3, #1D2439)',
  'layer-4': 'var(--bg-layer-4, #242C42)',
  blackout: 'var(--bg-blackout, #0C101DB3)',
  error: 'var(--bg-error, #402027)',
  warning: 'var(--bg-warning, #3F3D25)',
  info: 'var(--bg-info, #1C2C47)',
  success: 'var(--bg-success, #1D3841)',
  neutral: 'var(--bg-neutral, #1D2439)',
  inverted: 'var(--bg-inverted, #EEF1F7)',
  'model-icon': 'var(--bg-model-icon, #FFFFFF00)',
  'accent-primary-alpha': 'var(--bg-accent-primary-alpha, #7DA4FF26)',
  'accent-secondary-alpha': 'var(--bg-accent-secondary-alpha, #37BABC2E)',
  'accent-tertiary-alpha': 'var(--bg-accent-tertiary-alpha, #A972FF2E)',
};

const controlsBgColors = {
  'controls-accent-primary': 'var(--controls-bg-accent-primary, #3664E2)',
  'controls-accent-primary-hover':
    'var(--controls-bg-accent-primary-hover, #2656D9)',
  'controls-accent-primary-active':
    'var(--controls-bg-accent-primary-active, #124ACE)',
  'controls-accent-primary-alpha-active':
    'var(--controls-bg-accent-primary-alpha-active, #7DA4FF4D)',

  'controls-accent-secondary-alpha-active':
    'var(--controls-bg-accent-secondary-alpha-active, #37BABC5C)',

  'controls-accent-tertiary-alpha-active':
    'var(--controls-bg-accent-tertiary-alpha-active, #A972FF5C)',

  'controls-error': 'var(--controls-bg-error, #CC4545)',
  'controls-error-hover': 'var(--controls-bg-error-hover, #BF3939)',
  'controls-error-active': 'var(--controls-bg-error-active, #AE2F2F)',
  'controls-error-alpha-hover': 'var(--controls-bg-alpha-hover, #F764642E)',
  'controls-error-alpha-active':
    'var(--controls-bg-error-alpha-active, #F764645C)',

  'controls-disable-accent': 'var(--controls-bg-disable-accent, #696E7C)',
  'controls-disable': 'var(--controls-bg-disable, #242C42)',

  'controls-neutral-hover': 'var(--controls-bg-neutral-hover, #242C42)',
  'controls-neutral-active': 'var(--controls-bg-neutral-active, #575F73)',

  'controls-accent-success-alpha-hover':
    'var(--controls-bg-accent-success-alpha-hover, #37BABC2E)',
  'controls-accent-success-alpha-active':
    'var(--controls-bg-accent-success-alpha-active, #37BABC5C)',
};

const borderColors = {
  transparent: 'transparent',
  primary: 'var(--stroke-primary, #696E7C)',
  secondary: 'var(--stroke-secondary, #242C42)',
  tertiary: 'var(--stroke-tertiary, #0C101D)',
  focus: 'var(--stroke-focus, #EEF1F7)',
  error: 'var(--stroke-error, #F76464)',
  warning: 'var(--stroke-warning, #EEC840)',
  info: 'var(--stroke-info, #7DA4FF)',
  success: 'var(--stroke-success, #37BABC)',
  'accent-primary': 'var(--stroke-accent-primary, #7DA4FF)',
  'accent-secondary': 'var(--stroke-accent-secondary, #37BABC)',
  'accent-tertiary': 'var(--stroke-accent-tertiary, #A972FF)',
};

const textColors = {
  transparent: 'transparent',
  primary: 'var(--text-primary, #EEF1F7)',
  secondary: 'var(--text-secondary, #9FA6BD)',
  error: 'var(--text-error, #F76464)',
  warning: 'var(--text-warning, #EEC840)',
  'warning-icon': 'var(--text-warning-icon, #EEC840)',
  info: 'var(--text-info, #7DA4FF)',
  success: 'var(--text-success, #37BABC)',
  'accent-primary': 'var(--text-accent-primary, #7DA4FF)',
  'accent-secondary': 'var(--text-accent-secondary, #37BABC)',
  'accent-tertiary': 'var(--text-accent-tertiary, #A972FF)',
  white: 'var(--text-white, #FFFFFF)',
};

const placeholderColor = {
  primary: 'var(--text-primary, #EEF1F7)',
};

const controlsTextColors = {
  'controls-permanent': 'var(--controls-text-permanent, #FCFCFC)',

  'controls-accent-disable': 'var(--controls-text-accent-disable, #242C42)',
  'controls-primary-disable': 'var(--controls-text-primary-disable, #7C8293)',
  'controls-secondary-disable':
    'var(--controls-text-secondary-disable, #575F73)',

  'controls-neutral': 'var(--controls-text-neutral, #FCFCFC)',

  'controls-accent-primary-hover':
    'var(--controls-text-accent-primary-hover, #3664E2)',
  'controls-accent-primary-active':
    'var(--controls-text-accent-primary-active, #124ACE)',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  blocklist: ['[-:=]'],
  content: [
    './apps/chat/src/**/*.{html,js,ts,tsx,yaml}',
    './node_modules/@epam/ai-dial-ui-kit/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    backgroundColor: { ...backgroundsColors, ...controlsBgColors },
    borderColor: borderColors,
    stroke: borderColors,
    divideColor: borderColors,
    placeholderColor: placeholderColor,
    textColor: { ...textColors, ...controlsTextColors },
    gradientColorStops: backgroundsColors,

    extend: {
      screens: {
        mobile: { max: '768px' },
        desktop: { min: '769px' },
      },
      boxShadow: {
        DEFAULT: '0 0 4px 0 var(--shadow-default, rgba(0, 0, 0, 0.30))',
      },
      borderRadius: {
        DEFAULT: '3px',
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
            color: 'var(--text-primary, #EEF1F7)',
            a: {
              color: 'var(--text-accent-primary, #7DA4FF)',
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
