import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectStaticImportClosure } from './static-import-closure';

/*
 * Walks the *built* `dist/` output (never `@epam/source`) to prove the
 * package-boundary decisions in `design.md` (Decisions 1 and 2) actually
 * hold for a real consumer of the published package: the eager entry never
 * bundles a private copy of an externalized peer engine, the two lazy
 * boundaries still exist as on-demand `import(...)` call sites, and the
 * PDF-vendor CSS selectors live in a file distinct from the one
 * `package.json#exports["./styles.css"]` points at. This assumes `dist/` was
 * just rebuilt — the project's `test` target depends on its own `build`
 * target for exactly this reason.
 */

const libRoot = resolve(__dirname, '../..');
const distDir = resolve(libRoot, 'dist');

const packageJson = JSON.parse(
  readFileSync(resolve(libRoot, 'package.json'), 'utf-8'),
);

const indexJs = readFileSync(resolve(distDir, 'index.js'), 'utf-8');
const staticClosureJs = collectStaticImportClosure(resolve(distDir, 'index.js'))
  .map((filePath) => readFileSync(filePath, 'utf-8'))
  .join('\n');

const distFiles = readdirSync(distDir);
const pdfChunkFileName = distFiles.find((file) =>
  /^PdfContent-.*\.js$/.test(file),
);

const collectExportTargets = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([condition, target]) =>
    condition === '@epam/source' ? [] : collectExportTargets(target),
  );
};

describe('published entry-point contract', () => {
  it('builds every non-source entry and exports target', () => {
    const targets = [
      packageJson.main,
      packageJson.module,
      packageJson.types,
      ...collectExportTargets(packageJson.exports),
    ];

    for (const target of new Set(targets)) {
      expect(existsSync(resolve(libRoot, target)), `${target} must exist`).toBe(
        true,
      );
    }
  });
});

describe('dist/index.js static import closure', () => {
  it('never bundles pdfjs-dist implementation code', () => {
    for (const telltale of [
      'GlobalWorkerOptions',
      'getDocument',
      'PDFWorker',
    ]) {
      expect(staticClosureJs).not.toContain(telltale);
    }
  });

  it('references react-syntax-highlighter only as an external dynamic import specifier', () => {
    const occurrences =
      staticClosureJs.split('react-syntax-highlighter').length - 1;
    expect(occurrences).toBe(1);
    expect(staticClosureJs).toMatch(/import\("react-syntax-highlighter"\)/);
  });

  it('still contains the PDF and code lazy-loading call sites', () => {
    expect(indexJs).toMatch(/import\("\.\/PdfContent-[\w-]+\.js"\)/);
    expect(indexJs).toMatch(/import\("react-syntax-highlighter"\)/);
  });
});

describe('dist/PdfContent-*.js dynamic chunk', () => {
  it('exists as a separate chunk', () => {
    expect(pdfChunkFileName).toBeTruthy();
  });

  it('never bundles pdfjs-dist implementation code', () => {
    const pdfChunkJs = readFileSync(
      resolve(distDir, pdfChunkFileName as string),
      'utf-8',
    );
    for (const telltale of [
      'GlobalWorkerOptions',
      'getDocument',
      'PDFWorker',
    ]) {
      expect(pdfChunkJs).not.toContain(telltale);
    }
  });

  it('imports its split stylesheet so consumers preload CSS with the chunk', () => {
    const pdfChunkJs = readFileSync(
      resolve(distDir, pdfChunkFileName as string),
      'utf-8',
    );
    expect(pdfChunkJs).toMatch(/^import "\.\/PdfContent\.css";/);
  });
});

describe('dist CSS files — PDF-vendor selectors stay out of the base stylesheet', () => {
  const stylesExportPath = packageJson.exports['./styles.css'] as string;
  const baseStylesFile = resolve(libRoot, stylesExportPath);
  const baseCss = readFileSync(baseStylesFile, 'utf-8');

  const pdfVendorSelectors = [
    '.pdf-highlight-viewer',
    '.pdf-canvas',
    '.pdf-context-menu',
    '.pdf-page-container',
    '.pdf-tooltip',
  ];

  it('exports["./styles.css"] resolves to a real file distinct from "dist/style.css"', () => {
    expect(stylesExportPath).toBe('./dist/index.css');
  });

  it('the base stylesheet contains no PDF-vendor selectors', () => {
    for (const selector of pdfVendorSelectors) {
      expect(baseCss).not.toContain(selector);
    }
  });

  it('the PDF-vendor selectors exist in a different CSS file than the base stylesheet', () => {
    const cssFiles = distFiles.filter((file) => file.endsWith('.css'));
    const pdfCssFile = cssFiles.find((file) => {
      const filePath = resolve(distDir, file);
      if (filePath === baseStylesFile) return false;
      const contents = readFileSync(filePath, 'utf-8');
      return pdfVendorSelectors.every((selector) =>
        contents.includes(selector),
      );
    });
    expect(pdfCssFile).toBeTruthy();
  });
});
