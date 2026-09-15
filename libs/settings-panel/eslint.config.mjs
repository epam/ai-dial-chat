import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/react'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
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
          /*
           * The kit reaches this lib only through its stylesheet — the panel
           * applies `dial-h1-text` / `dial-small-text` typography classes and
           * imports no kit module, which this rule cannot see. The peer stays:
           * a host that omits the kit gets an unstyled panel.
           */
          ignoredDependencies: ['vitest', '@epam/ai-dial-ui-kit'],
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
