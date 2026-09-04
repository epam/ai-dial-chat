/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/chat',
  server: {
    port: 4207,
    host: 'localhost',
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4207,
    host: 'localhost',
  },
  plugins: [react(), svgr()],
  resolve: {
    alias: {
      /* remark-math resolves math delimiters through micromark-extension-math, which only
       * recognizes `$...$`/`$$...$$`. This fork additionally recognizes the `\(...\)`/`\[...\]`
       * delimiters that LLMs commonly emit. */
      'micromark-extension-math': 'micromark-extension-llm-math',
      '@epam/ai-dial-chat-shared': path.resolve(
        import.meta.dirname,
        '../../libs/chat-shared/src/index.ts',
      ),
      /* `@epam/ai-dial-chat-hooks` ships one root barrel plus 14 dependency-scoped
       * subpaths (see `libs/chat-hooks/package.json#exports`). Vite's alias matcher
       * treats a plain string `find` as a prefix match (`importee === find ||
       * importee.startsWith(find + '/')`), so a bare `@epam/ai-dial-chat-hooks`
       * entry would also swallow every subpath import and rewrite it onto
       * `src/index.ts/<subpath>` — a path that does not exist. Listing each
       * subpath's own explicit alias before the general one (object key order is
       * preserved and checked in order) makes the more specific match win. */
      '@epam/ai-dial-chat-hooks/viewport-layout': path.resolve(
        import.meta.dirname,
        '../../libs/chat-hooks/src/entry-points/viewport-layout.ts',
      ),
      '@epam/ai-dial-chat-hooks/scroll-anchoring': path.resolve(
        import.meta.dirname,
        '../../libs/chat-hooks/src/entry-points/scroll-anchoring.ts',
      ),
      '@epam/ai-dial-chat-hooks/conversation': path.resolve(
        import.meta.dirname,
        '../../libs/chat-hooks/src/entry-points/conversation.ts',
      ),
      '@epam/ai-dial-chat-hooks/conversation-transfer': path.resolve(
        import.meta.dirname,
        '../../libs/chat-hooks/src/entry-points/conversation-transfer.ts',
      ),
      '@epam/ai-dial-chat-hooks/conversation-sources': path.resolve(
        import.meta.dirname,
        '../../libs/chat-hooks/src/entry-points/conversation-sources.ts',
      ),
      '@epam/ai-dial-chat-hooks/file-manager': path.resolve(
        import.meta.dirname,
        '../../libs/chat-hooks/src/entry-points/file-manager.ts',
      ),
      '@epam/ai-dial-chat-hooks/catalog': path.resolve(
        import.meta.dirname,
        '../../libs/chat-hooks/src/entry-points/catalog.ts',
      ),
      '@epam/ai-dial-chat-hooks/skills-state': path.resolve(
        import.meta.dirname,
        '../../libs/chat-hooks/src/entry-points/skills-state.ts',
      ),
      '@epam/ai-dial-chat-hooks/skill-editor': path.resolve(
        import.meta.dirname,
        '../../libs/chat-hooks/src/entry-points/skill-editor.ts',
      ),
      '@epam/ai-dial-chat-hooks/oauth': path.resolve(
        import.meta.dirname,
        '../../libs/chat-hooks/src/entry-points/oauth.ts',
      ),
      '@epam/ai-dial-chat-hooks/scheduled-tasks': path.resolve(
        import.meta.dirname,
        '../../libs/chat-hooks/src/entry-points/scheduled-tasks.ts',
      ),
      '@epam/ai-dial-chat-hooks/sharing': path.resolve(
        import.meta.dirname,
        '../../libs/chat-hooks/src/entry-points/sharing.ts',
      ),
      '@epam/ai-dial-chat-hooks/attachments': path.resolve(
        import.meta.dirname,
        '../../libs/chat-hooks/src/entry-points/attachments.ts',
      ),
      '@epam/ai-dial-chat-hooks/utils': path.resolve(
        import.meta.dirname,
        '../../libs/chat-hooks/src/entry-points/utils.ts',
      ),
      '@epam/ai-dial-chat-hooks': path.resolve(
        import.meta.dirname,
        '../../libs/chat-hooks/src/index.ts',
      ),
      '@epam/ai-dial-chat-overlay': path.resolve(
        import.meta.dirname,
        '../../libs/chat-overlay/src/index.ts',
      ),
      '@epam/ai-dial-conversation-input': path.resolve(
        import.meta.dirname,
        '../../libs/conversation-input/src/index.ts',
      ),
      '@epam/ai-dial-conversation-messages': path.resolve(
        import.meta.dirname,
        '../../libs/conversation-messages/src/index.ts',
      ),
      '@epam/ai-dial-conversation-stages': path.resolve(
        import.meta.dirname,
        '../../libs/conversation-stages/src/index.ts',
      ),
      '@epam/ai-dial-chat-api-client': path.resolve(
        import.meta.dirname,
        '../../libs/chat-api-client/src/index.ts',
      ),
      '@epam/ai-dial-conversation-panel': path.resolve(
        import.meta.dirname,
        '../../libs/conversation-panel/src/index.ts',
      ),
      '@epam/ai-dial-sidebar': path.resolve(
        import.meta.dirname,
        '../../libs/sidebar/src/index.ts',
      ),
      '@epam/ai-dial-navigation-panel': path.resolve(
        import.meta.dirname,
        '../../libs/navigation-panel/src/index.ts',
      ),
      '@epam/ai-dial-starter-buttons': path.resolve(
        import.meta.dirname,
        '../../libs/starter-buttons/src/index.ts',
      ),
      '@epam/ai-dial-catalog': path.resolve(
        import.meta.dirname,
        '../../libs/catalog/src/index.ts',
      ),
      '@epam/ai-dial-publish-panel': path.resolve(
        import.meta.dirname,
        '../../libs/publish-panel/src/index.ts',
      ),
      '@epam/ai-dial-source-panel': path.resolve(
        import.meta.dirname,
        '../../libs/source-panel/src/index.ts',
      ),
      '@epam/ai-dial-attachment-canvas': path.resolve(
        import.meta.dirname,
        '../../libs/attachment-canvas/src/index.ts',
      ),
      '@epam/ai-dial-attachment-input': path.resolve(
        import.meta.dirname,
        '../../libs/attachment-input/src/index.ts',
      ),
      '@epam/ai-dial-share': path.resolve(
        import.meta.dirname,
        '../../libs/share/src/index.ts',
      ),
      '@epam/ai-dial-deployment-creation-form': path.resolve(
        import.meta.dirname,
        '../../libs/deployment-creation-form/src/index.ts',
      ),
      '@epam/ai-dial-scheduled-tasks': path.resolve(
        import.meta.dirname,
        '../../libs/scheduled-tasks/src/index.ts',
      ),
      '@epam/ai-dial-quotations': path.resolve(
        import.meta.dirname,
        '../../libs/quotations/src/index.ts',
      ),
      '@epam/ai-dial-builder-form': path.resolve(
        import.meta.dirname,
        '../../libs/builder-form/src/index.ts',
      ),
      '@epam/ai-dial-skill-editor': path.resolve(
        import.meta.dirname,
        '../../libs/skill-editor/src/index.ts',
      ),
      '@epam/ai-dial-prompt-editor': path.resolve(
        import.meta.dirname,
        '../../libs/prompt-editor/src/index.ts',
      ),
      '@epam/ai-dial-prompts': path.resolve(
        import.meta.dirname,
        '../../libs/prompts/src/index.ts',
      ),
      '@epam/ai-dial-settings-panel': path.resolve(
        import.meta.dirname,
        '../../libs/settings-panel/src/index.ts',
      ),
      '@epam/ai-dial-usage-dashboard': path.resolve(
        import.meta.dirname,
        '../../libs/usage-dashboard/src/index.ts',
      ),
      '@epam/ai-dial-react-pdf-highlighter/styles.css': path.resolve(
        import.meta.dirname,
        '../../node_modules/@epam/ai-dial-react-pdf-highlighter/dist/index.css',
      ),
      '@epam/pdf-highlighter-kit/dist/pdf-highlight-viewer.css': path.resolve(
        import.meta.dirname,
        '../../node_modules/@epam/pdf-highlighter-kit/dist/pdf-highlight-viewer.css',
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
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('classnames') || id.includes('tailwind-merge'))
            return 'vendor-utils';
          if (id.includes('@tabler/icons-react')) return 'tabler-icons';
          /* `@epam/ai-dial-ui-kit` already splits Monaco behind its own dynamic-import
           * boundary (`LazyDialJsonEditor` -> `JsonEditor-*.js` -> `MarkdownEditor-*.js`).
           * A bare substring match on the package name would re-merge those already-lazy
           * chunks (they physically live under the package's `dist/` folder too) back into
           * this eager chunk, defeating the library's own split. Exclude them explicitly. */
          if (
            id.includes('@epam/ai-dial-ui-kit') &&
            !id.includes('JsonEditor') &&
            !id.includes('MarkdownEditor')
          )
            return 'ui-kit';
          return undefined;
        },
      },
    },
  },
  test: {
    name: '@epam/chat',
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
    server: {
      deps: {
        inline: [
          '@epam/pdf-highlighter-kit',
          '@epam/ai-dial-react-pdf-highlighter',
        ],
      },
    },
  },
}));
