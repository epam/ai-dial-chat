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
          ],
          /*
           * dompurify, lru-cache, mime-types, yaml, and fflate are
           * implementation-only dependencies bundled into their owning
           * entry-point's output (design.md D3) and intentionally declared in
           * no dependency field of the published package.json — they are
           * never imported by name by a consumer. Excluded here so this rule
           * does not ask for them to be re-declared as (peer)dependencies.
           */
          ignoredDependencies: [
            'dompurify',
            'lru-cache',
            'mime-types',
            'yaml',
            'fflate',
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
