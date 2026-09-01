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

/*
 * jsdom does not implement Blob.prototype.arrayBuffer() or text().
 * Polyfill arrayBuffer() via FileReader.readAsArrayBuffer (raw bytes, no
 * encoding transformation), then derive text() from it using TextDecoder so
 * invalid UTF-8 bytes reliably become U+FFFD replacement characters.
 */
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

if (typeof Blob !== 'undefined' && !Blob.prototype.text) {
  Blob.prototype.text = function (): Promise<string> {
    return this.arrayBuffer().then((buf) =>
      new TextDecoder('utf-8', { fatal: false }).decode(buf),
    );
  };
}
