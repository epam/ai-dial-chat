/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/chat-hooks',
  resolve: {
    /*
     * Resolves to source for tests only (rollupOptions.external keeps the
     * production build from bundling it either way) — the built dist eagerly
     * references browser globals (e.g. DOMMatrix) that jsdom doesn't provide,
     * while the source only touches them when actually invoked.
     */
    alias: {
      '@epam/ai-dial-attachment-canvas': path.resolve(
        import.meta.dirname,
        '../attachment-canvas/src/index.ts',
      ),
    },
  },
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
      /*
       * Multi-entry lib builds emit per-source-file declarations mirroring
       * src/'s folder structure by default (e.g. dist/entry-points/
       * viewport-layout.d.ts), which does not match the flat
       * dist/<entry>.d.ts paths package.json#exports points at. rollupTypes
       * bundles each entry's declarations (via api-extractor) into one
       * top-level .d.ts per entry key instead.
       */
      rollupTypes: true,
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
      entry: {
        index: 'src/index.ts',
        'viewport-layout': 'src/entry-points/viewport-layout.ts',
        'scroll-anchoring': 'src/entry-points/scroll-anchoring.ts',
        conversation: 'src/entry-points/conversation.ts',
        'conversation-transfer': 'src/entry-points/conversation-transfer.ts',
        'conversation-sources': 'src/entry-points/conversation-sources.ts',
        'file-manager': 'src/entry-points/file-manager.ts',
        catalog: 'src/entry-points/catalog.ts',
        'skills-state': 'src/entry-points/skills-state.ts',
        'skill-editor': 'src/entry-points/skill-editor.ts',
        oauth: 'src/entry-points/oauth.ts',
        'scheduled-tasks': 'src/entry-points/scheduled-tasks.ts',
        sharing: 'src/entry-points/sharing.ts',
        attachments: 'src/entry-points/attachments.ts',
        utils: 'src/entry-points/utils.ts',
      },
      name: '@epam/ai-dial-chat-hooks',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@epam/ai-dial-attachment-canvas',
        '@epam/ai-dial-attachment-input',
        '@epam/ai-dial-catalog',
        '@epam/ai-dial-chat-api-client',
        '@epam/ai-dial-chat-overlay',
        '@epam/ai-dial-chat-shared',
        '@epam/ai-dial-deployment-creation-form',
        '@epam/ai-dial-publish-panel',
        '@epam/ai-dial-quotations',
        '@epam/ai-dial-react-file-manager',
        '@epam/ai-dial-scheduled-tasks',
        '@epam/ai-dial-share',
        '@epam/ai-dial-skill-editor',
        '@epam/ai-dial-source-panel',
        '@epam/ai-dial-ui-kit',
      ],
    },
  },
  test: {
    name: '@epam/ai-dial-chat-hooks',
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
