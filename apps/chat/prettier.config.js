const prettierDefault = require('../../prettier.config');

module.exports = {
  ...prettierDefault,
  importOrder: [
    '<THIRD_PARTY_MODULES>',
    '^vitest*', // React
    'testing-library*',
    'react', // React
    '^react-.*$', // React-related imports
    '^next', // Next-related imports
    '^next-.*$', // Next-related imports
    '^next/.*$', // Next-related imports
    '.*next$', // Next-related imports
    '^rxjs', // rxjs imports
    '^@reduxjs/.*$', // rxjs imports
    '^redux-observable$', // rxjs imports
    '^classnames$',
    '^shared$',
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
};
