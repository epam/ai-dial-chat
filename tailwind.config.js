// Do not use palette directly, only through semantic colors
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    backgroundColor: {
      transparent: 'transparent',
      'layer-0': 'var(--bg-layer-0, #000000)',
      'layer-1': 'var(--bg-layer-1, #090D13)',
      'layer-2': 'var(--bg-layer-2, #141A23)',
      'layer-3': 'var(--bg-layer-3, #222932)',
      'layer-4': 'var(--bg-layer-4, #333942)',
      blackout: 'var(--bg-blackout, #090D13B3)',
      error: 'var(--bg-error, #402027)',
      'accent-primary': 'var(--bg-accent-primary, #5C8DEA2B)',
      'accent-secondary': 'var(--bg-accent-secondary, #37BABC26)',
      'accent-tertiary': 'var(--bg-accent-tertiary, #A972FF2B)',
      'controls-accent': 'var(--controls-bg-accent, #5C8DEA)',
      'controls-accent-hover': 'var(--controls-bg-accent-hover, #4878D2)',
      'controls-disable': 'var(--controls-bg-disable, #7F8792)',
    },
    borderColor: {
      transparent: 'transparent',
      primary: 'var(--stroke-primary, #333942)',
      secondary: 'var(--stroke-secondary, #222932)',
      'divider-primary': 'var(--divider-primary, #090D13)',
      'divider-secondary': 'var(--divider-secondary, #222932)',
      error: 'var(--stroke-error, #F76464)',
      'controls-hover': 'var(--controls-stroke-hover, #141A23)',
      'controls-accent': 'var(--controls-stroke-accent, #2764D9)',
      'accent-primary': 'var(--stroke-accent-primary, #5C8DEA)',
      'accent-secondary': 'var(--stroke-accent-secondary, #37BABC)',
      'accent-tertiary': 'var(--stroke-accent-tertiary, #A972FF)',
    },
    stroke: {
      transparent: 'transparent',
      primary: 'var(--stroke-primary, #333942)',
      secondary: 'var(--stroke-secondary, #222932)',
      'divider-primary': 'var(--divider-primary, #090D13)',
      'divider-secondary': 'var(--divider-secondary, #222932)',
      error: 'var(--stroke-error, #F76464)',
      'controls-hover': 'var(--controls-stroke-hover, #141A23)',
      'controls-accent': 'var(--controls-stroke-accent, #2764D9)',
      'accent-primary': 'var(--stroke-accent-primary, #5C8DEA)',
      'accent-secondary': 'var(--stroke-accent-secondary, #37BABC)',
      'accent-tertiary': 'var(--stroke-accent-tertiary, #A972FF)',
    },
    divideColor: {
      transparent: 'transparent',
      primary: 'var(--divider-primary, #090D13)',
      secondary: 'var(--divider-secondary, #222932)',
    },
    textColor: {
      transparent: 'transparent',
      primary: 'var(--text-primary, #F3F4F6)',
      secondary: 'var(--text-secondary, #7F8792)',
      error: 'var(--text-error, #F76464)',
      'accent-primary': 'var(--text-accent-primary, #5C8DEA)',
      'accent-secondary': 'var(--text-accent-secondary, #37BABC)',
      'accent-tertiary': 'var(--text-accent-tertiary, #A972FF)',
      'controls-permanent': 'var(--controls-text-permanent, #FCFCFC)',
      'controls-disable': 'var(--controls-text-disable, #333942)',
    },
    gradientColorStops: {
      transparent: 'transparent',
      'layer-0': 'var(--bg-layer-0, #000000)',
      'layer-1': 'var(--bg-layer-1, #090D13)',
      'layer-2': 'var(--bg-layer-2, #141A23)',
      'layer-3': 'var(--bg-layer-3, #222932)',
      'layer-4': 'var(--bg-layer-4, #333942)',
      'accent-primary': 'var(--text-accent-primary, #5C8DEA)',
      'accent-secondary': 'var(--text-accent-secondary, #37BABC)',
      'accent-tertiary': 'var(--text-accent-tertiary, #A972FF)',
    },
    /////////
    extend: {
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
      },
      typography: {
        DEFAULT: {
          css: {
            color: 'var(--text-primary, #F3F4F6)',
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
