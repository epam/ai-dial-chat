import type { ReactNode } from 'react';
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
  Blob.prototype.stream = function (
    this: Blob,
  ): ReadableStream<Uint8Array<ArrayBuffer>> {
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

/*
 * `t` and the returned object are module-level singletons, not recreated per
 * call — real `react-i18next` returns a stable `t` reference across
 * re-renders (language/namespace unchanged), and code under test may rely on
 * that stability for memoization (e.g. `useCitationMarkdownComponents`'s
 * `markdownComponents` memo, which must not recompute on an unrelated
 * re-render). A fresh closure per call previously went unnoticed because
 * nothing depended on `t`'s identity — only its output.
 */
const mockT = (key: string, _params?: Record<string, string>) => key;
const mockUseTranslationResult = {
  t: mockT,
  i18n: {
    language: 'en',
    changeLanguage: vi.fn(),
  },
};

/*
 * `Trans` mirrors `mockT`: no locale resources are loaded in tests, so it
 * renders the `i18nKey` itself (a plain string is valid React children),
 * keeping key-based assertions working for components that interpolate
 * markup into translated sentences.
 */
const MockTrans = ({ i18nKey }: { i18nKey?: string }): ReactNode =>
  i18nKey ?? null;

vi.mock('react-i18next', () => ({
  useTranslation: () => mockUseTranslationResult,
  Trans: MockTrans,
}));
