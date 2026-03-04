import baseConfig from '../../eslint.config.mjs';



import nx from '@nx/eslint-plugin';
import jsoncParser from 'jsonc-eslint-parser';


export default [
  {
    ignores: ['**/dist'],
  },

  ...baseConfig,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: false,
        },
      ],
    },
  },
  {
    files: ['**/*.json'],
    plugins: {
      '@nx': nx,
    },
    languageOptions: {
      parser: jsoncParser,
    },
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/vite.config.{js,ts,mjs,mts}'],
        },
      ],
    },
  },
];