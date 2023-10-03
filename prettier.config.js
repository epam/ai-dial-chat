module.exports = {
  trailingComma: 'all',
  singleQuote: true,
  plugins: [
    '@trivago/prettier-plugin-sort-imports',
    'prettier-plugin-tailwindcss',
  ],
  importOrder: [
    'react', // React
    '^react-.*$', // React-related imports
    '^next', // Next-related imports
    '^next-.*$', // Next-related imports
    '^next/.*$', // Next-related imports
    '.*next$', // Next-related imports
    '^rxjs', // rxjs imports
    '^@reduxjs/.*$', // rxjs imports
    '^redux-observable$', // rxjs imports
    '^.*/hooks/.*$', // Hooks
    '^.*/services/.*$', // Services
    '^.*/utils/.*$', // Utils
    '^.*/types/.*$', // Types
    '^.*/store/.*$', // Store
    '^.*/constants/.*$', // Constants
    '^.*/pages/.*$', // Pages
    '^.*/components/.*$', // Components
    '^[./]', // Other imports
    '.*', // Any uncaught imports
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  pluginSearchDirs: false,
};
