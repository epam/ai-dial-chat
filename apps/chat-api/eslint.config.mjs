import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      // Nested conditionals read as early returns, `if`/`else` or named helpers.
      'no-nested-ternary': 'error',
    },
  },
];
