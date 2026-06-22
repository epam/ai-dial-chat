import baseConfig from '../../eslint.config.mjs';

export default [
  {
    ignores: ['./apps/chat/public/pdf.worker.min.mjs'],
  },
  ...baseConfig,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    settings: {
      tailwindcss: {
        config: './apps/chat/tailwind.config.js',
        callees: ['classnames', 'classNames'],
      },
    },
    rules: {
      '@next/next/no-html-link-for-pages': ['error', './apps/chat/src/pages'],
      'react/jsx-boolean-value': ['error', 'never'],
      'tailwindcss/no-custom-classname': 'error',
      'tailwindcss/no-contradicting-classname': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: ['react-i18next'],
          patterns: ['../../**', '../../*', '../**', '!../*'],
        },
      ],
      'no-restricted-globals': [
        'warn',
        {
          name: 'localStorage',
          message: 'Use DataService instead.',
        },
        {
          name: 'sessionStorage',
          message: 'Use DataService instead.',
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "VariableDeclarator[init.callee.name='useFormContext'] > ObjectPattern > Property[key.name='watch']",
          message:
            "Do not destructure 'watch' from useFormContext. Use useWatch() hook instead for React Compiler compatibility.",
        },
        {
          selector:
            "VariableDeclarator[init.callee.name='useFormContext'] > ObjectPattern > Property[key.name='formState']",
          message:
            "Do not destructure 'formState' from useFormContext. Use useFormState() hook instead for React Compiler compatibility.",
        },
      ],
    },
  },
  {
    files: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
    rules: {
      'testing-library/await-async-queries': 'error',
      'testing-library/no-await-sync-queries': 'error',
      'testing-library/no-debugging-utils': 'warn',
      'testing-library/no-dom-import': 'off',
    },
  },
];
