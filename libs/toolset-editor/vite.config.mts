/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { createLibTailwindUtilities } from '../../tools/vite-lib-tailwind-utilities.mjs';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/toolset-editor',
  plugins: [
    createLibTailwindUtilities({ root: import.meta.dirname }),
    react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
  ],
  resolve: {
    /*
     * Resolve workspace peers from source: their published bundles import
     * `.scss` modules that are not emitted to `dist`, which vitest cannot
     * load. The editor only imports the `@epam/ai-dial-chat-hooks` root
     * barrel, never its dependency-scoped subpaths, but that barrel's own
     * source pulls in most of chat-hooks' own workspace deps, so all of
     * them need an alias here too.
     */
    alias: {
      '@epam/ai-dial-attachment-canvas': path.resolve(
        import.meta.dirname,
        '../attachment-canvas/src/index.ts',
      ),
      '@epam/ai-dial-attachment-input': path.resolve(
        import.meta.dirname,
        '../attachment-input/src/index.ts',
      ),
      '@epam/ai-dial-builder-form': path.resolve(
        import.meta.dirname,
        '../builder-form/src/index.ts',
      ),
      '@epam/ai-dial-catalog': path.resolve(
        import.meta.dirname,
        '../catalog/src/index.ts',
      ),
      '@epam/ai-dial-chat-api-client': path.resolve(
        import.meta.dirname,
        '../chat-api-client/src/index.ts',
      ),
      '@epam/ai-dial-chat-hooks': path.resolve(
        import.meta.dirname,
        '../chat-hooks/src/index.ts',
      ),
      '@epam/ai-dial-chat-overlay': path.resolve(
        import.meta.dirname,
        '../chat-overlay/src/index.ts',
      ),
      '@epam/ai-dial-chat-shared': path.resolve(
        import.meta.dirname,
        '../chat-shared/src/index.ts',
      ),
      '@epam/ai-dial-mcp-apps': path.resolve(
        import.meta.dirname,
        '../mcp-apps/src/index.ts',
      ),
      '@epam/ai-dial-publish-panel': path.resolve(
        import.meta.dirname,
        '../publish-panel/src/index.ts',
      ),
      '@epam/ai-dial-quotations': path.resolve(
        import.meta.dirname,
        '../quotations/src/index.ts',
      ),
      '@epam/ai-dial-scheduled-tasks': path.resolve(
        import.meta.dirname,
        '../scheduled-tasks/src/index.ts',
      ),
      '@epam/ai-dial-share': path.resolve(
        import.meta.dirname,
        '../share/src/index.ts',
      ),
      '@epam/ai-dial-skill-editor': path.resolve(
        import.meta.dirname,
        '../skill-editor/src/index.ts',
      ),
      '@epam/ai-dial-source-panel': path.resolve(
        import.meta.dirname,
        '../source-panel/src/index.ts',
      ),
    },
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: '@epam/ai-dial-toolset-editor',
      fileName: 'index',
      formats: ['es' as const],
    },
    rolldownOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@epam/ai-dial-ui-kit',
        '@epam/ai-dial-builder-form',
        '@epam/ai-dial-chat-hooks',
        '@epam/ai-dial-chat-shared',
        '@tabler/icons-react',
      ],
    },
  },
  test: {
    name: '@epam/ai-dial-toolset-editor',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
