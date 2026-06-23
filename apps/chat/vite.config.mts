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
        target: 'http://localhost:3005',
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
      '@epam/ai-dial-chat-shared': path.resolve(
        __dirname,
        '../../libs/chat-shared/src/index.ts',
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
      '@epam/ai-dial-source-panel': path.resolve(
        __dirname,
        '../../libs/source-panel/src/index.ts',
      ),
      '@epam/ai-dial-attachment-canvas': path.resolve(
        __dirname,
        '../../libs/attachment-canvas/src/index.ts',
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
  },
}));
