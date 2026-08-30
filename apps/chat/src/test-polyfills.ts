/*
 * Browser globals that jsdom does not implement, installed before any other
 * setup file runs.
 *
 * `pdfjs-dist` evaluates `new DOMMatrix()` at module scope, and Vitest loads
 * the real `@epam/pdf-highlighter-kit` module (which imports pdfjs) while
 * resolving the `vi.mock` for it in `test-setup.ts` — so the global has to
 * exist before that mock is registered. `vi.mock` calls are hoisted to the top
 * of their own file, which is why this lives in a separate setup file listed
 * ahead of `test-setup.ts` rather than at the top of it.
 *
 * The stubs only need to survive module evaluation: every test mocks the PDF
 * viewer away, so no matrix math is ever performed against them.
 */

class MockDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  multiplySelf() {
    return this;
  }
  preMultiplySelf() {
    return this;
  }
  translateSelf() {
    return this;
  }
  scaleSelf() {
    return this;
  }
  rotateSelf() {
    return this;
  }
  invertSelf() {
    return this;
  }
}

globalThis.DOMMatrix ??= MockDOMMatrix as unknown as typeof DOMMatrix;
