/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { createLibTailwindUtilities } from '../../tools/vite-lib-tailwind-utilities.mjs';
import * as path from 'path';
import { createIsExternalPeerImport } from '../../tools/vite-external-matcher.mjs';
import { createVerifyPublishedStyles } from '../../tools/vite-verify-published-styles.mjs';

/* One marker per event plus a Tailwind utility the scenes use in TSX; CSS-module
   hashes change, their name prefixes do not. */
const REQUIRED_PUBLISHED_STYLE_MARKERS = [
  '_halloween-spider-weave_',
  '_giftButton_',
  '.desktop\\:bottom-4',
] as const;

const isExternalPeerImport = createIsExternalPeerImport([
  '@epam/ai-dial-chat-shared',
]);

export default defineConfig(({ command }) => ({
  // Published libraries must also run with React's production runtime.
  oxc: command === 'build' ? { jsx: { development: false } } : undefined,
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/celebrations',
  plugins: [
    createLibTailwindUtilities({ root: import.meta.dirname }),
    react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
    {
      ...createVerifyPublishedStyles({
        root: import.meta.dirname,
        requiredMarkers: REQUIRED_PUBLISHED_STYLE_MARKERS,
        forbidEmbeddedFonts: true,
      }),
      /* Only the library build emits `dist/index.css`; Storybook turns
         library mode off. */
      apply: (config, { command }) =>
        command === 'build' && Boolean(config.build?.lib),
    },
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    /* One stylesheet for every entry, so `./styles.css` carries all scenes. */
    cssCodeSplit: false,
    lib: {
      entry: {
        index: 'src/index.ts',
        halloween: 'src/halloween/index.ts',
        'new-year': 'src/new-year/index.ts',
      },
      name: '@epam/ai-dial-celebrations',
      cssFileName: 'index',
      formats: ['es' as const],
    },
    rolldownOptions: {
      external: (id: string) =>
        [
          'react',
          'react-dom',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
          'react-error-boundary',
        ].includes(id) ||
        /^@epam\/ai-dial-ui-kit(?:\/|$)/.test(id) ||
        isExternalPeerImport(id),
    },
  },
  test: {
    name: '@epam/ai-dial-celebrations',
    watch: false,
    globals: true,
    environment: 'jsdom',
    /*
     * Resolve chat-shared from source for tests only: its published bundle
     * imports `.scss` modules that are not emitted to `dist`, which vitest
     * cannot load. Kept out of the shared `resolve.alias` so it never
     * affects this lib's own production build.
     */
    alias: {
      '@epam/ai-dial-chat-shared': path.resolve(
        import.meta.dirname,
        '../chat-shared/src/index.ts',
      ),
    },
    setupFiles: ['./src/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
