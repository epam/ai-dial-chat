import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  collectStaticImportClosure,
  measureFiles,
} from './static-import-closure';

/*
 * Regression budgets for the package's own build output — resolved from the
 * real measurements this change's group 6 recorded (see `design.md`'s Open
 * Questions), not guessed in advance. Each ceiling carries roughly 20-75%
 * headroom over the measured byte count: enough to absorb ordinary code
 * growth in this lib, but tight enough that re-bundling a private copy of an
 * externalized peer (Decision 2's defect) — which adds hundreds of KB, not a
 * few — trips it immediately.
 *
 * The entry closure budget was re-measured for the Office-citation-highlighting
 * change (`openspec/changes/highlight-office-document-annotations`): highlight
 * state, the overlay JSX, and the two new labels are genuinely eager-path code
 * in `OoxmlContent` (they decide the acquisition branch and render
 * unconditionally on every mount), while the rect-resolution math itself
 * (`ooxml-highlight-geometry.ts`) and the per-format highlight-surface
 * factories (`ooxml-highlight-surfaces.ts`) were moved behind the same dynamic
 * import as the format they serve, keeping them out of this closure.
 *
 * Measured on this change's final build (raw / gzip):
 *   entry static JS closure  46,734 / 13,310
 *   dist/index.css             4,015 /  1,265
 *   dist/PdfContent-*.js        7,012 /  2,824
 *   dist/PdfContent.css        16,398 /  4,540
 */

const distDir = resolve(__dirname, '../../dist');

const sizeOf = (fileName: string) => {
  const filePath = resolve(distDir, fileName);
  return {
    raw: statSync(filePath).size,
    gzip: gzipSync(readFileSync(filePath)).length,
  };
};

describe('entry static JavaScript closure size budget', () => {
  const { raw, gzip } = measureFiles(
    collectStaticImportClosure(resolve(distDir, 'index.js')),
  );

  it('stays within the eager-entry raw size budget', () => {
    expect(raw).toBeLessThanOrEqual(57_000);
  });

  it('stays within the eager-entry gzip size budget', () => {
    expect(gzip).toBeLessThanOrEqual(16_000);
  });
});

describe('dist/index.css size budget', () => {
  const { raw, gzip } = sizeOf('index.css');

  it('stays within the base-stylesheet raw size budget', () => {
    expect(raw).toBeLessThanOrEqual(6_000);
  });

  it('stays within the base-stylesheet gzip size budget', () => {
    expect(gzip).toBeLessThanOrEqual(2_000);
  });
});

describe('dist/PdfContent-*.js chunk size budget', () => {
  const pdfChunkFileName = readdirSync(distDir).find((file) =>
    /^PdfContent-.*\.js$/.test(file),
  ) as string;
  const { raw, gzip } = sizeOf(pdfChunkFileName);

  it('stays within the lazy PDF chunk raw size budget', () => {
    expect(raw).toBeLessThanOrEqual(12_000);
  });

  it('stays within the lazy PDF chunk gzip size budget', () => {
    expect(gzip).toBeLessThanOrEqual(5_000);
  });
});

describe('dist/PdfContent.css size budget', () => {
  const { raw, gzip } = sizeOf('PdfContent.css');

  it('stays within the PDF-only stylesheet raw size budget', () => {
    expect(raw).toBeLessThanOrEqual(24_000);
  });

  it('stays within the PDF-only stylesheet gzip size budget', () => {
    expect(gzip).toBeLessThanOrEqual(7_000);
  });
});
