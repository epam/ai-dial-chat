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
        __dirname,
        '../../libs/chat-shared/src/index.ts',
      ),
      '@epam/ai-dial-chat-overlay': path.resolve(
        __dirname,
        '../../libs/chat-overlay/src/index.ts',
      ),
      '@epam/ai-dial-conversation-input': path.resolve(
        __dirname,
        '../../libs/conversation-input/src/index.ts',
      ),
      '@epam/ai-dial-conversation-messages': path.resolve(
        __dirname,
        '../../libs/conversation-messages/src/index.ts',
      ),
      '@epam/ai-dial-conversation-stages': path.resolve(
        __dirname,
        '../../libs/conversation-stages/src/index.ts',
      ),
      '@epam/chat-api-client': path.resolve(
        __dirname,
        '../../libs/chat-api-client/src/index.ts',
      ),
      '@epam/ai-dial-conversation-panel': path.resolve(
        __dirname,
        '../../libs/conversation-panel/src/index.ts',
      ),
      '@epam/ai-dial-sidebar': path.resolve(
        __dirname,
        '../../libs/sidebar/src/index.ts',
      ),
      '@epam/ai-dial-starter-buttons': path.resolve(
        __dirname,
        '../../libs/starter-buttons/src/index.ts',
      ),
      '@epam/ai-dial-catalog': path.resolve(
        __dirname,
        '../../libs/catalog/src/index.ts',
      ),
      '@epam/ai-dial-publish-panel': path.resolve(
        __dirname,
        '../../libs/publish-panel/src/index.ts',
      ),
      '@epam/ai-dial-source-panel': path.resolve(
        __dirname,
        '../../libs/source-panel/src/index.ts',
      ),
      '@epam/ai-dial-attachment-canvas': path.resolve(
        __dirname,
        '../../libs/attachment-canvas/src/index.ts',
      ),
      '@epam/ai-dial-attachment-input': path.resolve(
        __dirname,
        '../../libs/attachment-input/src/index.ts',
      ),
      '@epam/ai-dial-kit': path.resolve(
        __dirname,
        '../../libs/ai-dial-kit/src/index.ts',
      ),
      '@epam/ai-dial-share': path.resolve(
        __dirname,
        '../../libs/share/src/index.ts',
      ),
      '@epam/ai-dial-deployment-creation-form': path.resolve(
        __dirname,
        '../../libs/deployment-creation-form/src/index.ts',
      ),
      '@epam/ai-dial-scheduled-tasks': path.resolve(
        __dirname,
        '../../libs/scheduled-tasks/src/index.ts',
      ),
      '@epam/ai-dial-quotations': path.resolve(
        __dirname,
        '../../libs/quotations/src/index.ts',
      ),
      '@epam/ai-dial-builder-form': path.resolve(
        __dirname,
        '../../libs/builder-form/src/index.ts',
      ),
      '@epam/ai-dial-react-pdf-highlighter/styles.css': path.resolve(
        __dirname,
        '../../node_modules/@epam/ai-dial-react-pdf-highlighter/dist/index.css',
      ),
      '@epam/pdf-highlighter-kit/dist/pdf-highlight-viewer.css': path.resolve(
        __dirname,
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
          if (id.includes('@epam/ai-dial-ui-kit')) return 'ui-kit';
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
