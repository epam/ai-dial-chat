import nx from '@nx/eslint-plugin';
import react from 'eslint-plugin-react';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/react'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      react,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'react/jsx-no-target-blank': 'warn',
      'react/jsx-key': 'error',
      'react/no-children-prop': 'error',
      'react/no-danger': 'warn',
      'react/no-danger-with-children': 'error',
      'react/no-deprecated': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react/self-closing-comp': 'warn',
      '@nx/enforce-module-boundaries': 'off',
    },
  },
];
