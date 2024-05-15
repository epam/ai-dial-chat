// Default color palette is black when no themes presented
const commonBgColors = {
  transparent: 'transparent',
  'layer-0': 'var(--bg-layer-0, #000000)',
  'layer-1': 'var(--bg-layer-1, #090D13)',
  'layer-2': 'var(--bg-layer-2, #141A23)',
  'layer-3': 'var(--bg-layer-3, #222932)',
  'layer-4': 'var(--bg-layer-4, #333942)',
  'layer-5': 'var(--bg-layer-4, #333942)',
  blackout: 'var(--bg-blackout, #090D13B3)',
  error: 'var(--bg-error, #402027)',
  'accent-primary': 'var(--bg-accent-primary, #5C8DEA)',
  'accent-secondary': 'var(--bg-accent-secondary, #37BABC)',
  'accent-tertiary': 'var(--bg-accent-tertiary, #A972FF)',
  'accent-quaternary': 'var(--bg-accent-quaternary, #5B8CC3)',
  'accent-primary-alpha': 'var(--bg-accent-primary-alpha, #5C8DEA2B)',
  'accent-secondary-alpha': 'var(--bg-accent-secondary-alpha, #37BABC26)',
  'accent-tertiary-alpha': 'var(--bg-accent-tertiary-alpha, #A972FF2B)',
};

const commonBorderColors = {
  transparent: 'transparent',
  primary: 'var(--stroke-primary, #333942)',
  secondary: 'var(--stroke-secondary, #222932)',
  tertiary: 'var(--stroke-tertiary, #090D13)',
  quaternary: 'var(--stroke-quaternary, #FFFFFF)',
  error: 'var(--stroke-error, #F76464)',
  hover: 'var(--stroke-hover, #F3F4F6)',
  'accent-primary': 'var(--stroke-accent-primary, #5C8DEA)',
  'accent-secondary': 'var(--stroke-accent-secondary, #37BABC)',
  'accent-tertiary': 'var(--stroke-accent-tertiary, #A972FF)',
};

// Do not use palette directly, only through semantic colors
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    backgroundColor: {
      ...commonBgColors,
      'controls-accent': 'var(--controls-bg-accent, #5C8DEA)',
      'controls-permanent': 'var(--controls-text-permanent, #FCFCFC)',
      'controls-accent-hover': 'var(--controls-bg-accent-hover, #4878D2)',
      'controls-disable': 'var(--controls-bg-disable, #7F8792)',
    },
    borderColor: commonBorderColors,
    stroke: commonBorderColors,
    divideColor: commonBorderColors,
    textColor: {
      transparent: 'transparent',
      'primary-bg-dark': 'var(--text-primary-bg-dark, #F3F4F6)',
      'secondary-bg-dark': 'var(--text-secondary-bg-dark, #7F8792)',
      'primary-bg-light': 'var(--text-primary-bg-light, #023465)',
      'secondary-bg-light': 'var(--text-secondary-bg-light, #7F8792)',
      'tertiary-bg-light': 'var(--text-tertiary-bg-light, #7F8792)',
      error: 'var(--text-error, #F76464)',
      'accent-primary': 'var(--text-accent-primary, #5C8DEA)',
      'accent-secondary': 'var(--text-accent-secondary, #37BABC)',
      'accent-tertiary': 'var(--text-accent-tertiary, #A972FF)',
      'controls-permanent': 'var(--controls-text-permanent, #FCFCFC)',
      'controls-disable': 'var(--controls-text-disable, #333942)',
    },
    gradientColorStops: commonBgColors,
    /////////
    extend: {
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
      },
      opacity: {
        15: '15%',
      },
      boxShadow: {
        DEFAULT: '0 0 4px 0 var(--bg-blackout, #090D13B3)',
      },
      fontFamily: {
        DEFAULT: ['var(--font-inter)'],
      },
      fontSize: {
        xxs: '10px',
        xs: '12px',
        s: '14px',
        xl: '22px',
      },
      typography: {
        DEFAULT: {
          css: {
            color: 'var(--text-primary-bg-light, #F3F4F6)',
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
