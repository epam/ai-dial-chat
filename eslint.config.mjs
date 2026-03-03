import js from '@eslint/js';
import nx from '@nx/eslint-plugin';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierPlugin from 'eslint-plugin-prettier';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/.git',
      '**/.svn',
      '**/.hg',
      '**/node_modules',
      '.next',
      'next.config.js',
      'next-i18next.config.js',
      'public',
      'dist',
      '.github',
      'helm',
      'apps/chat-e2e/html-report',
      'apps/chat-e2e/chat-html-report',
      'apps/chat-e2e/overlay-html-report',
      'next-env.d.ts',
      '**/package.json',
      '**/**.config.js',
      '**/**.config.mjs',
      '**/jest.config.ts',
      '**/setupTests.ts',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 5,
      sourceType: 'commonjs',
      parserOptions: {
        project: ['tsconfig.*?.json'],
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        globalThis: 'readonly',
        NodeJS: 'readonly',
        WindowEventMap: 'readonly',
      },
    },
    plugins: {
      '@nx': nx,
      react: reactPlugin,
      prettier: prettierPlugin,
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...prettierPlugin.configs.recommended.rules,
      'no-redeclare': 'off',
      'no-multi-spaces': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^__' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
      'no-empty': 'warn',
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      'no-constant-condition': 'off',
      'no-multiple-empty-lines': ['warn', { max: 1, maxBOF: 0 }],
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
];
