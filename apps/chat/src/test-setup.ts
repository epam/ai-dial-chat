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

/*
 * Pin the runtime default locale to 'en' for `new Intl.NumberFormat(...)` /
 * `new Intl.DateTimeFormat(...)` calls that pass no locale. Components and
 * mappers create such formatters at module load, so the pin has to run in
 * this setup file, before any module under test is imported; explicit locales
 * ('fr', 'de-DE', …) pass through untouched. Without it, assertions on
 * formatted numbers and dates flip with the host machine's locale — a 'uk'
 * default renders `7 500` instead of `7,500`, and a localized weekday name
 * instead of `Monday`. Note: `Number.prototype.toLocaleString` and
 * `Date.prototype.toLocaleDateString` use the engine intrinsics, not the
 * `Intl` global, so they are NOT covered by this pin.
 *
 * The wrappers are plain functions (not classes) because Intl constructors
 * are legal to call without `new` (`Intl.DateTimeFormat()` in
 * map-scheduled-task-dto.ts does exactly that), and a class constructor
 * would throw there. A function returning the real instance covers both
 * call styles; `setPrototypeOf` keeps the statics (`supportedLocalesOf`)
 * reachable.
 *
 * A plain function's own `.prototype` is a fresh empty object, which would
 * shadow the real `Intl.*.prototype` — hiding `resolvedOptions` and `format`
 * from `vi.spyOn(Intl.*.prototype, ...)`. Assigning the real prototype onto
 * the wrapper keeps that standard mocking idiom working.
 */
const RealNumberFormat = Intl.NumberFormat;

const PinnedNumberFormat = function (
  locale?: Intl.LocalesArgument,
  options?: Intl.NumberFormatOptions,
) {
  return new RealNumberFormat(locale ?? 'en', options);
} as unknown as typeof Intl.NumberFormat;

Object.setPrototypeOf(PinnedNumberFormat, RealNumberFormat);
/*
 * Assigned via defineProperty because the Intl constructor types mark
 * `prototype` as readonly, which rejects a plain assignment.
 */
Object.defineProperty(PinnedNumberFormat, 'prototype', {
  value: RealNumberFormat.prototype,
});

globalThis.Intl.NumberFormat = PinnedNumberFormat;

const RealDateTimeFormat = Intl.DateTimeFormat;

const PinnedDateTimeFormat = function (
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
) {
  return new RealDateTimeFormat(locale ?? 'en', options);
} as unknown as typeof Intl.DateTimeFormat;

Object.setPrototypeOf(PinnedDateTimeFormat, RealDateTimeFormat);
Object.defineProperty(PinnedDateTimeFormat, 'prototype', {
  value: RealDateTimeFormat.prototype,
});

globalThis.Intl.DateTimeFormat = PinnedDateTimeFormat;
