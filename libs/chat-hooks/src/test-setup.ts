import { vi } from 'vitest';

/*
 * @epam/ai-dial-attachment-canvas (aliased to source for tests, see
 * vite.config.mts) pulls in @epam/pdf-highlighter-kit's compiled dist, whose
 * internal relative import doesn't resolve outside a bundler. Mocked here —
 * not exercised by any test in this package — the same way apps/chat's own
 * test-setup.ts mocks it.
 */
vi.mock('@epam/pdf-highlighter-kit', () => ({
  PDFHighlightViewer: () => null,
}));
