import { vi } from 'vitest';

class MockResizeObserver {
  observe() {
    /* no-op */
  }
  unobserve() {
    /* no-op */
  }
  disconnect() {
    /* no-op */
  }
}

globalThis.ResizeObserver ??=
  MockResizeObserver as unknown as typeof ResizeObserver;

class MockIntersectionObserver {
  observe() {
    /* no-op */
  }
  unobserve() {
    /* no-op */
  }
  disconnect() {
    /* no-op */
  }
}

globalThis.IntersectionObserver ??=
  MockIntersectionObserver as unknown as typeof IntersectionObserver;

/*
 * jsdom's Blob/File implementation has no `arrayBuffer()`/`stream()`/`text()`
 * methods. Polyfill all three together — adding only `arrayBuffer()` makes
 * undici's `isBlobLike` duck-typing (used by the real `Response` constructor
 * in `new Response(new Blob(...))`) start treating the object as Blob-like
 * and call its (still-missing) `stream()`, breaking every test that builds a
 * `Response` from a `Blob`.
 */
if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}
if (!Blob.prototype.text) {
  Blob.prototype.text = async function (this: Blob): Promise<string> {
    return new TextDecoder().decode(await this.arrayBuffer());
  };
}
if (!Blob.prototype.stream) {
  Blob.prototype.stream = function (this: Blob): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start: async (controller) => {
        controller.enqueue(new Uint8Array(await this.arrayBuffer()));
        controller.close();
      },
    });
  };
}

vi.mock('@epam/pdf-highlighter-kit', () => ({
  PDFHighlightViewer: () => null,
}));

vi.mock('@epam/ai-dial-react-pdf-highlighter', () => ({
  DocumentPreview: () => null,
  PageThumbnail: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      return key;
    },
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}));
