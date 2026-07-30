// Default color palette is light when no themes presented

const backgroundsColors = {
  transparent: 'transparent',
  // COLORS 2.0
  'layer-sunken': 'var(--bg-layer-sunken, #EEF1F7)', // grey-300
  'layer-base': 'var(--bg-layer-base, #F5F7FA)', // grey-200
  'layer-raised': 'var(--bg-layer-raised, #FCFCFC)', // grey-100
  error: 'var(--bg-error, #F3D6D8)', // red-100
  warning: 'var(--bg-warning, #FAF0CF)', // yellow-100
  info: 'var(--bg-info, #E1EAF9)', // blue-100
  success: 'var(--bg-success, #DBF1EB)', // green-100
  backdrop: 'var(--bg-backdrop, #161B2DB2)', // grey-1000 with 70% opacity

  // shadow colors
  'shadow-blue': 'var(--shadow-blue-500, #2764D924)',
  'shadow-grey': 'var(--shadow-grey-1000, #161B2D08)',

  // REMOVED: old names, need to remove
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
  overlay: 'var(--bg-overlay, #FCFCFC80)',
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
  'transparent-black': 'var(--bg-transparent-black, rgb(0 0 0 / 0))',
  // New Chat button shadow — blue/purple pair at default, hover, and active alpha levels
  'new-chat-shadow-blue': 'var(--bg-new-chat-shadow-blue, #5C8DEA33)',
  'new-chat-shadow-blue-hover':
    'var(--bg-new-chat-shadow-blue-hover, #5C8DEA47)',
  'new-chat-shadow-blue-active':
    'var(--bg-new-chat-shadow-blue-active, #5C8DEA26)',
  'new-chat-shadow-purple': 'var(--bg-new-chat-shadow-purple, #A972FF24)',
  'new-chat-shadow-purple-hover':
    'var(--bg-new-chat-shadow-purple-hover, #A972FF33)',
  'new-chat-shadow-purple-active':
    'var(--bg-new-chat-shadow-purple-active, #A972FF1A)',
  'mask-opaque': 'var(--bg-mask-opaque, #000)',
  'accent-primary-fill': 'var(--bg-accent-primary-fill, #5C8DEA)',
  'hover-alpha': 'var(--bg-hover-alpha, rgba(0, 0, 0, 0.04))',
  'focus-ring-alpha': 'var(--bg-focus-ring-alpha, rgba(125, 164, 255, 0.5))',
};

const controlsBgColors = {
  // COLORS 2.0
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

  'control-disable': 'var(--bg-control-disable, #C7CBD4)', // grey-700

  // REMOVED: old names, need to remove
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
  'controls-accent': 'var(--controls-bg-accent, #5C8DEA)',
  'controls-accent-hover': 'var(--controls-bg-accent-hover, #4878D2)',
  'controls-accent-alpha': 'var(--controls-bg-accent-alpha, #5C8DEA2B)',
  'controls-enable-primary': 'var(--controls-enable-primary, #FCFCFC)',
};

const borderColors = {
  // COLORS 2.0
  transparent: 'transparent',
  primary: 'var(--stroke-primary, #6B7280)', // grey-800
  secondary: 'var(--stroke-secondary, #D1DBEA)', // grey-600
  tertiary: 'var(--stroke-tertiary, #E0E6F0)', // grey-500
  error: 'var(--stroke-error, #AE2F2F)', // red-800
  warning: 'var(--stroke-warning, #EEC840)', // yellow-500
  info: 'var(--stroke-info, #124ACE)', // blue-500
  success: 'var(--stroke-success, #007274)', // green-800
  // controls
  focus: 'var(--stroke-focus, #161B2D)', // grey-1000
  'accent-alpha': 'var(--stroke-accent-alpha, #2764D933)', // blue-500 alpha-20
  'error-alpha': 'var(--stroke-error-alpha, #AE2F2F73)', // red-800 alpha-45

  // REMOVED: old names, need to remove
  'accent-primary': 'var(--stroke-accent-primary, #124ACE)',
  'accent-primary-hover': 'var(--stroke-accent-primary-hover, #7DA4FF)',
  'hover-tint': 'var(--stroke-hover-tint, #0000001f)',
  hairline: 'var(--stroke-hairline, #0000000d)',
  'controls-accent': 'var(--controls-bg-accent, #5C8DEA)',
  'accent-primary-hover': 'var(--stroke-accent-primary-hover, #4878d2)',
  hover: 'var(--stroke-hover, #EEF1F7)',
};

const controlsBorderColors = {
  // REMOVED: old names, need to remove
  'controls-focus': 'var(--controls-stroke-focus, #EEF1F7)',
};

const textColors = {
  // COLORS 2.0
  transparent: 'transparent',
  primary: 'var(--text-primary, #161B2D)', // grey-1000
  secondary: 'var(--text-secondary, #6B7280)', // grey-800
  tertiary: 'var(--text-tertiary, #C7CBD4)', // grey-700
  accent: 'var(--text-accent, #1D4ED8)', // blue-500
  error: 'var(--text-error, #AE2F2F)', // red-500
  warning: 'var(--text-warning, #7F6300)', // yellow-700
  'warning-icon': 'var(--text-warning-icon, #EEC840)', // yellow-500
  info: 'var(--text-info, #1D4ED8)', // blue-500
  success: 'var(--text-success, #007274)', // green-800

  // REMOVED: old names, need to remove
  'accent-primary': 'var(--text-accent-primary, #7DA4FF)',
  'accent-secondary': 'var(--text-accent-secondary, #37BABC)',
  'accent-tertiary': 'var(--text-accent-tertiary, #A972FF)',
  // Catalog tab bar — override via CSS custom properties for dark-theme support
  'catalog-tab-active': 'var(--cat-tab-active-text, #111827)',
  'catalog-tab-inactive': 'var(--cat-tab-inactive-text, #6B7280)',
  'catalog-tab-hover': 'var(--cat-tab-hover-text, #374151)',
  'catalog-badge-active': 'var(--cat-badge-active-text, #2764D9)',
  'catalog-badge-inactive': 'var(--cat-badge-inactive-text, #9CA3AF)',
  'accent-primary': 'var(--text-accent-primary, #124ACE)',
  'accent-secondary': 'var(--text-accent-secondary, #007274)',
  'accent-tertiary': 'var(--text-accent-tertiary, #7E39EC)',
};

// NEW COLORS 2.0
const placeholderColor = {
  primary: 'var(--text-primary, #161B2D)', // grey-1000
};

const controlsTextColors = {
  'control-permanent': 'var(--text-control-permanent, #FCFCFC)', // grey-100
  'control-disable': 'var(--text-control-disable, #6B7280)', // grey-800
  'control-blue-hover': 'var(--text-control-blue-hover, #5976E9)', // blue-300
  'control-blue-active': 'var(--text-control-blue-active, #6785FB)', // blue-200
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
    borderColor: { ...borderColors, ...controlsBorderColors },
    stroke: { ...borderColors, ...controlsBorderColors },
    divideColor: { ...borderColors, ...controlsBorderColors },
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
