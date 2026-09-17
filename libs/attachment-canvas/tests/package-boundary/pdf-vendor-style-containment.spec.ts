import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * `attachment-preview-style-containment` requires that the vendor CSS the
 * lazily loaded PDF engine pulls in cannot alter layout outside the preview.
 * The mechanism is a named cascade layer, and nothing in `lint`, `typecheck`,
 * or a jsdom test evaluates the cascade — so the guarantee is asserted here,
 * against the emitted stylesheet, where it is actually observable.
 *
 * The vendor sheet (`@epam/ai-dial-react-pdf-highlighter/styles.css`) is a
 * complete Tailwind build: it redefines base utilities the host also owns
 * (`.hidden`, `.flex`, …) plus Preflight. Unlayered, arriving after the host's
 * stylesheet, a plain `.hidden { display: none }` outranks the host's
 * `@media (min-width:1280px) { .desktop\:block { display: block } }`, because
 * a media-query variant adds no specificity.
 */

const distDir = resolve(__dirname, '../../dist');
const LAYER_AT_RULE = '@layer pdf-vendor{';

const readCss = (fileName: string) =>
  readFileSync(resolve(distDir, fileName), 'utf8');

/** Splits `css` into the `@layer pdf-vendor` block and everything outside it. */
const splitOnVendorLayer = (css: string) => {
  const start = css.indexOf(LAYER_AT_RULE);
  if (start === -1) return { inside: '', outside: css };
  let depth = 0;
  let end = css.length;
  for (let i = start + LAYER_AT_RULE.length - 1; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  return {
    inside: css.slice(start, end),
    outside: css.slice(0, start) + css.slice(end),
  };
};

describe('PDF vendor stylesheet containment', () => {
  const pdfCss = readCss('PdfContent.css');
  const { inside, outside } = splitOnVendorLayer(pdfCss);

  it('emits the vendor stylesheet inside a single named cascade layer', () => {
    expect(pdfCss.split(LAYER_AT_RULE)).toHaveLength(2);
    expect(inside.length).toBeGreaterThan(1_000);
  });

  it('keeps the host-colliding base utilities inside the layer', () => {
    expect(inside).toContain('.hidden{display:none}');
    expect(outside).not.toContain('.hidden');
  });

  it('keeps Preflight inside the layer', () => {
    /* Tailwind Preflight's opening rule — unlayered, it restyles every
       element in the host application. */
    expect(inside).toContain('border:0 solid');
    expect(outside).not.toContain('border:0 solid');
  });

  it('leaves only the library own rules outside the layer', () => {
    /* The single CSS-module rule `PdfContent.module.scss` contributes. */
    expect(outside.trim()).toMatch(/^\._[A-Za-z0-9_]+\s+\.pdf-container\{/);
  });
});

describe('PDF vendor stylesheet stays off the eager path', () => {
  const baseCss = readCss('index.css');

  it('is absent from the package base stylesheet', () => {
    expect(baseCss).not.toContain('@layer pdf-vendor');
    /*
     * Preflight, not `.hidden`, is what marks the vendor build here: the base
     * stylesheet carries the Tailwind utilities this package's own components
     * reference (tools/vite-lib-tailwind-utilities.mjs), and `.hidden` is one
     * of them. Preflight is emitted by the vendor sheet alone.
     */
    expect(baseCss).not.toContain('border:0 solid');
  });
});
