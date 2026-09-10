import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/vite.config.{js,ts,mjs,mts}',
            /*
             * The packed-fixture harness is a build/test-time
             * tool, not published library source — its own dependencies
             * (e.g. `playwright`, used by `browser-parity.mjs`) are workspace
             * devDependencies, not part of this package's runtime contract.
             */
            '{projectRoot}/e2e-fixtures/**/*.mjs',
          ],
          ignoredDependencies: [
            /*
             * API Extractor exposes this transitive attachment-canvas type as
             * a direct import in file-manager.d.ts. It therefore belongs in
             * the published peer contract even though source files only name
             * attachment-canvas itself.
             */
            '@epam/pdf-highlighter-kit',
          ],
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
