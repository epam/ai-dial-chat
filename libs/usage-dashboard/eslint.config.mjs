import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/react'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      /*
       * This library renders already-normalized display models only — DTO
       * interpretation stays outside it (see AGENTS.md §Library isolation). A
       * returning import here, even through a re-export, must fail lint
       * rather than wait for review.
       */
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@epam/ai-dial-chat-api-client',
                '@epam/ai-dial-chat-api-client/*',
              ],
              message:
                'libs/usage-dashboard must not import the generated BFF client — usage DTO interpretation belongs in libs/chat-hooks/src/usage under its recorded exception, with host-specific behavior supplied by callbacks. See AGENTS.md §Library isolation.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/vite.config.{js,ts,mjs,mts}',
          ],
          /*
           * vitest is test-only tooling shared through the workspace root's own
           * devDependency, not a runtime dependency of the published package —
           * it must never be a consumer-facing peerDependency.
           */
          ignoredDependencies: ['vitest'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  {
    ignores: ['**/out-tsc'],
  },
];
