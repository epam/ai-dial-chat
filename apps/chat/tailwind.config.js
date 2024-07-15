// Default color palette is black when no themes presented
const commonPRColors = {
  'pr-primary-500': 'var(--pr-primary-500, #184487)',
  'pr-primary-550': 'var(--pr-primary-550, #023465)',
  'pr-primary-650': 'var(--pr-primary-650, #02274D)',
  'pr-primary-700': 'var(--pr-primary-700, #082A5E)',
  'pr-primary-800': 'var(--pr-primary-800, #002957)',
  'pr-primary-500-alpha': 'var(--pr-primary-500-alpha, #18448766)',
  'pr-primary-550-alpha': 'var(--pr-primary-550-alpha, #02346566)',

  'pr-secondary-500': 'var(--pr-secondary-500, #6296E2)',
  'pr-secondary-550': 'var(--pr-secondary-550, #7FA5D0)',
  'pr-secondary-650': 'var(--pr-secondary-650, #5B8CC4)',
  'pr-secondary-700': 'var(--pr-secondary-500, #336BBD)',
  'pr-secondary-500-alpha': 'var(--pr-secondary-500, #6296E266)',
  'pr-secondary-550-alpha': 'var(--pr-secondary-550, #7FA5D066)',

  'pr-grey-white': 'var(--pr-grey-white, #FFFFFF)',
  'pr-grey-100': 'var(--pr-grey-100, #F4F8FB)',
  'pr-grey-200': 'var(--pr-grey-200, #E9EDF0)',
  'pr-grey-300': 'var(--pr-grey-300, #C9CED8)',
  'pr-grey-400': 'var(--pr-grey-400, #9AA5B8)',

  'pr-tertiary-500': 'var(--pr-tertiary-500, #FFD440)',

  'pr-alert-500': 'var(--pr-alert-500, #D14343)',
};

const commonBgColors = {
  transparent: 'transparent',
  'layer-0': 'var(--bg-layer-0, #000A32)',
  'layer-1': 'var(--bg-layer-1, #F4F8FB)',
  'layer-2': 'var(--bg-layer-2, #FFFFFF)',
  'layer-3': 'var(--bg-layer-3, #023465)',
  'layer-4': 'var(--bg-layer-4, #5B8CC3)',
  'layer-5': 'var(--bg-layer-5, #7FA5D0)',
  'layer-6': 'var(--bg-layer-6, #184487)',
  'layer-7': 'var(--bg-layer-7, #ECEEF4)',
  'layer-8': 'var(--bg-layer-8, #C0DDF2)',
  'layer-9': 'var(--bg-layer-9, #F3E8CE)',
  'layer-10': 'var(--bg-layer-10, #E9EDF0)',
  blackout: 'var(--bg-blackout, #090F2599)',
  'blackout-1': 'var(--bg-blackout-1, #1844870D)',
  'blackout-2': 'var(--bg-blackout-2, #023465CC)',
  error: 'var(--bg-error, #402027)',
  'accent-primary': 'var(--bg-accent-primary, #7FA5D0)',
  'accent-secondary': 'var(--bg-accent-secondary, #7092B8)',
  'accent-tertiary': 'var(--bg-accent-tertiary, #FFFFFF)',
  'accent-quaternary': 'var(--bg-accent-quaternary, #5B8CC3)',
  'accent-primary-alpha': 'var(--bg-accent-primary-alpha, #5C8DEA2B)',
  'accent-secondary-alpha': 'var(--bg-accent-secondary-alpha, #7FA5D040)',
  'accent-tertiary-alpha': 'var(--bg-accent-tertiary-alpha, #6300FF2B)',
};

const commonBorderColors = {
  transparent: 'transparent',
  primary: 'var(--stroke-primary, #7092B8)',
  secondary: 'var(--stroke-secondary, #E9EDF0)',
  tertiary: 'var(--stroke-tertiary, #082A5E)',
  quaternary: 'var(--stroke-quaternary, #FFFFFF)',
  quinary: 'var(--bg-layer-3, #023465)',
  error: 'var(--stroke-accent-primary, #FFD440)',
  hover: 'var(--stroke-hover, #7092B8)',
  'accent-primary': 'var(--stroke-accent-primary, #FF9166)',
  'accent-secondary': 'var(--stroke-accent-secondary, #5B8CC3)',
  'accent-tertiary': 'var(--stroke-accent-tertiary, #6300FF)',
  'accent-quaternary': 'var(--stroke-accent-quaternary, #7FA5D0)',
};

// Do not use palette directly, only through semantic colors
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    backgroundColor: {
      ...commonBgColors,
      ...commonPRColors,
      'controls-accent': 'var(--controls-bg-accent, #7FA5D0)',
      'controls-permanent': 'var(--controls-text-permanent, #FFFFFF)',
      'controls-accent-hover': 'var(--controls-bg-accent-hover, #7092B8)',
      'controls-disable': 'var(--controls-bg-disable, #333942)',
    },
    borderColor: {
      ...commonBorderColors,
      ...commonPRColors,
    },
    stroke: {
      ...commonBorderColors,
      ...commonPRColors,
      'controls-disable': 'var(--controls-bg-disable, #333942)',
    },
    divideColor: {
      ...commonBorderColors,
      ...commonPRColors,
    },
    textColor: {
      transparent: 'transparent',
      'primary-bg-dark': 'var(--text-primary-bg-dark, #FFFFFF)',
      'secondary-bg-dark': 'var(--text-secondary-bg-dark, #7FA5D0)',
      'primary-bg-light': 'var(--text-primary-bg-light, #212429)',
      'secondary-bg-light': 'var(--text-secondary-bg-light, #184487)',
      'tertiary-bg-light': 'var(--text-tertiary-bg-light, #9AA5B8)',
      'quaternary-bg-light': 'var(--text-quaternary-bg-light, #6A7585)',
      'quinary-bg-light': 'var(--text-quinary-bg-light, #082A5E)',
      error: 'var(--text-error, #F76464)',
      'accent-primary': 'var(--text-accent-primary, #FFD440)',
      'accent-secondary': 'var(--text-accent-secondary, #FF9166)',
      'accent-tertiary': 'var(--text-accent-tertiary, #000000)',
      'controls-permanent': 'var(--controls-text-permanent, #FFFFFF)',
      'controls-disable': 'var(--controls-text-disable, #333942)',
      'temperature-primary': 'var(--text-temperature-primary, #80A6D1)',
      'temperature-secondary': 'var(--text-temperature-secondary, #426E9C)',
      'temperature-tertiary': 'var(--text-temperature-tertiary, #043667)',
      'pr-primary-700': 'var(--text-pr-primary-700, #023465)',
      ...commonPRColors,
    },
    gradientColorStops: commonBgColors,
    /////////
    extend: {
      backgroundImage: {
        'conic-gradient':
          'conic-gradient( #FFE280 , #D8E5F8, #8FB1E3, #FFE280)',
      },
      animation: {
        'spin-steps': 'spin 0.75s steps(8, end) infinite',
      },
      colors: {
        transparent: 'transparent',
      },
      screens: {
        sm: '560px',
      },
      borderRadius: {
        DEFAULT: '3px',
        primary: '6px',
        secondary: '10px',
      },
      opacity: {
        15: '15%',
      },
      boxShadow: {
        DEFAULT: '0 0 4px 0 var(--bg-blackout, #090D13B3)',
        primary: '0 5px 10px 0 var(--bg-blackout-1, #1844870D)',
        secondary: '0 10px 15px 0 var(--bg-blackout-1, #1844870D)',
      },
      fontFamily: {
        DEFAULT: ['var(--theme-font, var(--font-inter))'],
        weave: ['var(--font-weave)'],
      },
      fontSize: {
        xxs: '10px',
        xs: '12px',
        s: '14px',
      },
      typography: {
        invert: {
          css: {
            color: 'var(--text-primary-bg-dark, #FFFFFF)',
          },
        },
        DEFAULT: {
          css: {
            color: 'var(--text-primary-bg-light, #212429)',
            a: {
              color: 'var(--text-accent-primary, #5C8DEA)',
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
  variants: {
    extend: {
      visibility: ['group-hover'],
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
