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

/*
 * Pin the runtime default locale to 'en' for `new Intl.NumberFormat(...)` /
 * `new Intl.DateTimeFormat(...)` calls that pass no locale. The limits mappers
 * create such formatters at module load, so the pin has to run in this setup
 * file, before any module under test is imported; explicit locales ('fr',
 * 'de-DE', …) pass through untouched. Without it, assertions on formatted
 * token counts flip with the host machine's locale — a 'uk' default renders
 * `1,9 млн` instead of `1.9M`. Note:
 * `Number.prototype.toLocaleString` and `Date.prototype.toLocaleDateString`
 * use the engine intrinsics, not the `Intl` global, so they are NOT covered
 * by this pin.
 *
 * The wrappers are plain functions (not classes) because Intl constructors
 * are legal to call without `new`, and a class constructor would throw there.
 * A function returning the real instance covers both call styles;
 * `setPrototypeOf` keeps the statics (`supportedLocalesOf`) reachable.
 */
const RealNumberFormat = Intl.NumberFormat;

const PinnedNumberFormat = function (
  locale?: Intl.LocalesArgument,
  options?: Intl.NumberFormatOptions,
) {
  return new RealNumberFormat(locale ?? 'en', options);
} as unknown as typeof Intl.NumberFormat;

Object.setPrototypeOf(PinnedNumberFormat, RealNumberFormat);

globalThis.Intl.NumberFormat = PinnedNumberFormat;

const RealDateTimeFormat = Intl.DateTimeFormat;

const PinnedDateTimeFormat = function (
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
) {
  return new RealDateTimeFormat(locale ?? 'en', options);
} as unknown as typeof Intl.DateTimeFormat;

Object.setPrototypeOf(PinnedDateTimeFormat, RealDateTimeFormat);

globalThis.Intl.DateTimeFormat = PinnedDateTimeFormat;
