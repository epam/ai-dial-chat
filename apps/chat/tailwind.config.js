const defaultTheme = require('tailwindcss/defaultTheme');
const typographyStyles = require('@tailwindcss/typography/src/styles');
const COMPACT_RHYTHM_SCALE = 0.5;

const BASE_RHYTHM_OVERRIDES = {
  hr: { marginTop: '2em', marginBottom: '2em' },
};

const scaleEmValue = (value) => {
  const match = /^(-?[\d.]+)em$/.exec(String(value));

  if (!match) {
    return value;
  }

  const scaled = +(parseFloat(match[1]) * COMPACT_RHYTHM_SCALE).toFixed(4);

  return scaled === 0 ? '0' : `${scaled}em`;
};

const buildCompactTypographyCss = () => {
  const base = typographyStyles.default
    ? typographyStyles.default.base
    : typographyStyles.base;
  const pluginDeclarations = Array.isArray(base.css)
    ? Object.assign({}, ...base.css)
    : base.css;
  const declarations = { ...pluginDeclarations };

  Object.entries(BASE_RHYTHM_OVERRIDES).forEach(([selector, rules]) => {
    declarations[selector] = { ...declarations[selector], ...rules };
  });

  return Object.entries(declarations).reduce((acc, [selector, rules]) => {
    if (
      !rules ||
      typeof rules !== 'object' ||
      (rules.marginTop === undefined && rules.marginBottom === undefined)
    ) {
      return acc;
    }

    const scaled = {};

    if (rules.marginTop !== undefined) {
      scaled.marginTop = scaleEmValue(rules.marginTop);
    }
    if (rules.marginBottom !== undefined) {
      scaled.marginBottom = scaleEmValue(rules.marginBottom);
    }

    acc[selector] = scaled;

    return acc;
  }, {});
};

// Default color palette is black when no themes presented
const commonBgColors = {
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
  'accent-primary': 'var(--bg-accent-primary, #5C8DEA)',
  'accent-secondary': 'var(--bg-accent-secondary, #37BABC)',
  'accent-tertiary': 'var(--bg-accent-tertiary, #A972FF)',
  'accent-primary-alpha': 'var(--bg-accent-primary-alpha, #7DA4FF26)',
  'accent-secondary-alpha': 'var(--bg-accent-secondary-alpha, #37BABC26)',
  'accent-tertiary-alpha': 'var(--bg-accent-tertiary-alpha, #A972FF2B)',
  overlay: 'var(--bg-overlay, #0C101DB3)',
  'auth-layer-0': 'var(--bg-auth-layer-0, var(--bg-layer-1, #0C101D))',
  'auth-layer-1': 'var(--bg-auth-layer-1, var(--bg-layer-3, #1D2439))',
  'controls-disable-accent': 'var(--controls-bg-disable-accent, #696E7C)',
};

const commonBorderColors = {
  transparent: 'transparent',
  current: 'currentColor',
  primary: 'var(--stroke-primary, #696E7C)',
  secondary: 'var(--stroke-secondary, #1D2439)',
  tertiary: 'var(--stroke-tertiary, #0C101D)',
  error: 'var(--stroke-error, #F76464)',
  warning: 'var(--stroke-warning, #EEC840)',
  info: 'var(--stroke-info, #7DA4FF)',
  success: 'var(--stroke-success, #37BABC)',
  hover: 'var(--stroke-hover, #EEF1F7)',
  'accent-primary': 'var(--stroke-accent-primary, #7DA4FF)',
  'accent-secondary': 'var(--stroke-accent-secondary, #37BABC)',
  'accent-tertiary': 'var(--stroke-accent-tertiary, #A972FF)',
};

const sidebarOverlayBreakpoint = defaultTheme.screens.xl;
const sidebarOverlayMdBreakpoint = defaultTheme.screens.md;

// Do not use palette directly, only through semantic colors
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './../../node_modules/@epam/ai-dial-ui-kit/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    backgroundColor: {
      ...commonBgColors,
      'controls-accent': 'var(--controls-bg-accent, #5C8DEA)',
      'controls-permanent': 'var(--controls-text-permanent, #FCFCFC)',
      'controls-accent-hover': 'var(--controls-bg-accent-hover, #4878D2)',
      'controls-disable': 'var(--controls-bg-disable, #242C42)',
      'model-icon': 'var(--bg-model-icon, #FFFFFF00)',
      'icon-accent-primary': 'var(--text-accent-primary, #7DA4FF)',
      'controls-enable-primary': 'var(--controls-enable-primary, #FCFCFC)',
      'text-secondary': 'var(--text-secondary, #9FA6BD)',
    },
    borderColor: commonBorderColors,
    stroke: commonBorderColors,
    divideColor: commonBorderColors,
    textColor: {
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
      'controls-permanent': 'var(--controls-text-permanent, #FCFCFC)',
      'controls-disable': 'var(--controls-text-disable, #575F73)',
      'layer-0': 'var(--bg-layer-0, #000000)',
      'layer-3': 'var(--bg-layer-3, #1D2439)',
      'controls-primary-disable':
        'var(--controls-text-primary-disable, #7C8293)',
      'controls-accent-disable': 'var(--controls-text-accent-disable, #242C42)',
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
        '3xl': '1770px',
        '4xl': '2120px',
        '5xl': '2560px',
        'sidebar-overlay': sidebarOverlayBreakpoint,
        'sidebar-overlay-md': sidebarOverlayMdBreakpoint,
      },
      borderRadius: {
        DEFAULT: 'var(--border-radius, 3px)',
      },
      opacity: {
        15: '15%',
      },
      boxShadow: {
        DEFAULT: '0 0 4px 0 var(--bg-blackout, #0C101DB3)',
        card: '0px 0.41px 2.94px 0px #0C101D04, 0px 1.13px 8.14px 0px #0C101D05, 0px 2.71px 19.6px 0px #0C101D07, 0px 9px 65px 0px #0C101D0A',
      },
      fontFamily: {
        DEFAULT: ['var(--theme-font, var(--font-inter))'],
        theme: ['var(--theme-font, var(--font-inter))'],
        codeblock: ['var(--codeblock-font, var(--theme-font))'],
      },
      fontSize: {
        xxs: '10px',
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
            ...BASE_RHYTHM_OVERRIDES,
          },
        },
        compact: {
          css: buildCompactTypographyCss(),
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
  future: {
    hoverOnlyWhenSupported: true,
  },
};
