/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { createLibTailwindUtilities } from '../../tools/vite-lib-tailwind-utilities.mjs';
import * as path from 'path';

export default defineConfig(({ command }) => ({
  // Published libraries must also run with React's production runtime.
  oxc: command === 'build' ? { jsx: { development: false } } : undefined,
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/scheduled-tasks',
  plugins: [
    createLibTailwindUtilities({ root: import.meta.dirname }),
    react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: { index: 'src/index.ts', validation: 'src/validation.ts' },
      cssFileName: 'index',
      name: '@epam/ai-dial-scheduled-tasks',
      fileName: (_format, entryName) => `${entryName}.js`,
      formats: ['es' as const],
    },
    rolldownOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        '@epam/ai-dial-builder-form',
        '@epam/ai-dial-chat-shared',
        /^@epam\/ai-dial-ui-kit(?:\/|$)/,
        '@tabler/icons-react',
        '@uiw/react-markdown-preview',
        '@uiw/react-md-editor',
      ],
    },
  },
  test: {
    name: '@epam/ai-dial-scheduled-tasks',
    watch: false,
    globals: true,
    environment: 'jsdom',
    /*
     * Resolve workspace peers from source for tests only: their published
     * bundles import `.scss` modules that are not emitted to `dist`, which
     * vitest cannot load. Kept out of the shared `resolve.alias` so it never
     * affects this lib's own production build.
     */
    alias: [
      {
        find: '@epam/ai-dial-builder-form/styles.css',
        replacement: path.resolve(
          import.meta.dirname,
          '../builder-form/src/styles.css',
        ),
      },
      {
        find: /^@epam\/ai-dial-builder-form$/,
        replacement: path.resolve(
          import.meta.dirname,
          '../builder-form/src/index.ts',
        ),
      },
      {
        find: /^@epam\/ai-dial-chat-shared$/,
        replacement: path.resolve(
          import.meta.dirname,
          '../chat-shared/src/index.ts',
        ),
      },
    ],
    setupFiles: ['./src/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
