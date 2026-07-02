// Default color palette is light when no themes presented

const backgroundsColors = {
  transparent: 'transparent',
  'layer-0': 'var(--bg-layer-0, #FCFCFC)',
  'layer-1': 'var(--bg-layer-1, #E0E6F0)',
  'layer-2': 'var(--bg-layer-2, #EEF1F7)',
  'layer-3': 'var(--bg-layer-3, #FCFCFC)',
  'layer-4': 'var(--bg-layer-4, #D1DBEA)',
  'layer-5': 'var(--bg-layer-5, #F5F7FA)',
  'layer-6': 'var(--bg-layer-6, #F8FAFC)',
  'layer-7': 'var(--bg-layer-7, #00000006)',
  'layer-8': 'var(--bg-layer-8, #f0f2f5)',
  blackout: 'var(--bg-blackout, #0C101D4D)',
  error: 'var(--bg-error, #F3D6D8)',
  warning: 'var(--bg-warning, #FAF0CF)',
  info: 'var(--bg-info, #D6E2F9)',
  success: 'var(--bg-success, #D9F0F1)',
  neutral: 'var(--bg-neutral, #FCFCFC)',
  inverted: 'var(--bg-inverted, #161B2D)',
  'accent-primary-alpha': 'var(--bg-accent-primary-alpha, #7DA4FF2E)',
  // Catalog tab bar — override via CSS custom properties for dark-theme support
  'catalog-badge-active': 'var(--cat-badge-active-bg, #EEF2FF)',
  'catalog-badge-inactive': 'var(--cat-badge-inactive-bg, #F3F4F6)',
  'accent-secondary-alpha': 'var(--bg-accent-secondary-alpha, #37BABC2E)',
  'accent-tertiary-alpha': 'var(--bg-accent-tertiary-alpha, #A972FF2E)',
};

const controlsBgColors = {
  'controls-accent-primary': 'var(--controls-bg-accent-primary, #124ACE)',
  'controls-accent-primary-hover':
    'var(--controls-bg-accent-primary-hover, #2656D9)',
  'controls-accent-primary-active':
    'var(--controls-bg-accent-primary-active, #3664E2)',
  'controls-accent-primary-alpha-active':
    'var(--controls-bg-accent-primary-alpha-active, #7DA4FF5C)',

  'controls-accent-secondary-alpha-active':
    'var(--controls-bg-accent-secondary-alpha-active, #37BABC5C)',

  'controls-accent-tertiary-alpha-active':
    'var(--controls-bg-accent-tertiary-alpha-active, #A972FF5C)',

  'controls-error': 'var(--controls-bg-error, #AE2F2F)',
  'controls-error-hover': 'var(--controls-bg-error-hover, #BF3939)',
  'controls-error-active': 'var(--controls-bg-error-active, #CC4545)',
  'controls-error-alpha-hover': 'var(--controls-bg-alpha-hover, #F764642E)',
  'controls-error-alpha-active':
    'var(--controls-bg-error-alpha-active, #F764645C)',

  'controls-disable-accent': 'var(--controls-bg-disable-accent, #7C8293)',
  'controls-disable': 'var(--controls-bg-disable, #D1DBEA)',

  'controls-neutral-hover': 'var(--controls-bg-neutral-hover, #D1DBEA)',
  'controls-neutral-active': 'var(--controls-bg-neutral-active, #9FA6BD)',

  'controls-accent-success-alpha-hover':
    'var(--controls-bg-accent-success-alpha-hover, #37BABC2E)',
  'controls-accent-success-alpha-active':
    'var(--controls-bg-accent-success-alpha-active, #37BABC5C)',
};

const borderColors = {
  transparent: 'transparent',
  primary: 'var(--stroke-primary, #7C8293)',
  secondary: 'var(--stroke-secondary, #D1DBEA)',
  tertiary: 'var(--stroke-tertiary, #E0E6F0)',
  focus: 'var(--stroke-focus, #161B2D)',
  error: 'var(--stroke-error, #AE2F2F)',
  warning: 'var(--stroke-warning, #EEC840)',
  info: 'var(--stroke-info, #124ACE)',
  success: 'var(--stroke-success, #007274)',
  'accent-primary': 'var(--stroke-accent-primary, #124ACE)',
  'accent-secondary': 'var(--stroke-accent-secondary, #007274)',
  'accent-tertiary': 'var(--stroke-accent-tertiary, #7E39EC)',
};

const textColors = {
  transparent: 'transparent',
  primary: 'var(--text-primary, #161B2D)',
  // Catalog tab bar — override via CSS custom properties for dark-theme support
  'catalog-tab-active': 'var(--cat-tab-active-text, #111827)',
  'catalog-tab-inactive': 'var(--cat-tab-inactive-text, #6B7280)',
  'catalog-tab-hover': 'var(--cat-tab-hover-text, #374151)',
  'catalog-badge-active': 'var(--cat-badge-active-text, #2764D9)',
  'catalog-badge-inactive': 'var(--cat-badge-inactive-text, #9CA3AF)',
  secondary: 'var(--text-secondary, #575F73)',
  tertiary: 'var(--text-tertiary, #808898)',
  error: 'var(--text-error, #AE2F2F)',
  warning: 'var(--text-warning, #7F6300)',
  'warning-icon': 'var(--text-warning-icon, #EEC840)',
  info: 'var(--text-info, #124ACE)',
  success: 'var(--text-success, #007274)',
  'accent-primary': 'var(--text-accent-primary, #124ACE)',
  'accent-secondary': 'var(--text-accent-secondary, #007274)',
  'accent-tertiary': 'var(--text-accent-tertiary, #7E39EC)',
  white: 'var(--text-white, #FFFFFF)',
};

const placeholderColor = {
  primary: 'var(--text-primary, #161B2D)',
};

const controlsTextColors = {
  'controls-permanent': 'var(--controls-text-permanent, #FCFCFC)',

  'controls-accent-disable': 'var(--controls-text-accent-disable, #D1DBEA)',
  'controls-primary-disable': 'var(--controls-text-primary-disable, #696E7C)',
  'controls-secondary-disable':
    'var(--controls-text-secondary-disable, #9FA6BD)',

  'controls-neutral': 'var(--controls-text-neutral, #161B2D)',

  'controls-accent-primary-hover':
    'var(--controls-text-accent-primary-hover, #3664E2)',
  'controls-accent-primary-active':
    'var(--controls-text-accent-primary-active, #7DA4FF)',
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
        'main-inset': 'inset 1px 0 8px rgba(0, 0, 0, 0.04)',
        'main-inset-rtl': 'inset -1px 0 8px rgba(0, 0, 0, 0.04)',
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
            color: 'var(--text-primary, #161B2D)',
            a: {
              color: 'var(--text-accent-primary, #124ACE)',
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
