#!/usr/bin/env node
/**
 * Asserts the property design.md's Decision 6 exists this fixture to prove:
 * once `@epam/ai-dial-attachment-canvas` is installed the way a real
 * downstream consumer would install it (a packed tarball, resolved through
 * plain `node_modules`, never the workspace's `@epam/source` alias) and
 * bundled into an ordinary app, the PDF engine (`pdfjs-dist`, via
 * `@epam/ai-dial-react-pdf-highlighter`) and the syntax-highlighter engine
 * (`react-syntax-highlighter`'s `refractor` grammar library) load only
 * on demand — never as part of this app's eager entry graph.
 *
 * Usage: node scripts/verify-build-output.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(__dirname, '..');
const distDir = resolve(fixtureRoot, 'dist');
const assetsDir = resolve(distDir, 'assets');

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};

const indexHtml = readFileSync(resolve(distDir, 'index.html'), 'utf-8');

// Same technique as scripts/measure-initial-bundle.mjs: the eager graph is
// exactly what index.html references directly (entry script, modulepreload,
// stylesheet) — everything else is reachable only through a dynamic import()
// and is therefore genuinely on-demand.
const eagerRefs = [
  ...new Set(
    [...indexHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) =>
      match[1].replace(/^\//, ''),
    ),
  ),
];

if (eagerRefs.length === 0) {
  fail('Could not find any eager asset references in dist/index.html.');
}

const allAssetFiles = readdirSync(assetsDir).map((file) => `assets/${file}`);
const onDemandRefs = allAssetFiles.filter((file) => !eagerRefs.includes(file));

const readAsset = (ref) => readFileSync(resolve(distDir, ref), 'utf-8');

const PDF_ENGINE_TELLTALE = 'GlobalWorkerOptions'; // pdfjs-dist's own API surface
const SYNTAX_HIGHLIGHTER_ENGINE_TELLTALE = 'refractor'; // react-syntax-highlighter's grammar engine

const eagerJsRefs = eagerRefs.filter((ref) => ref.endsWith('.js'));
const eagerCssRefs = eagerRefs.filter((ref) => ref.endsWith('.css'));

for (const ref of eagerJsRefs) {
  const contents = readAsset(ref);
  if (contents.includes(PDF_ENGINE_TELLTALE)) {
    fail(
      `Eager entry ${ref} bundles the pdfjs-dist engine (${PDF_ENGINE_TELLTALE}).`,
    );
  }
  if (contents.includes(SYNTAX_HIGHLIGHTER_ENGINE_TELLTALE)) {
    fail(
      `Eager entry ${ref} bundles the react-syntax-highlighter engine (${SYNTAX_HIGHLIGHTER_ENGINE_TELLTALE}).`,
    );
  }
}

const pdfVendorSelectors = ['.pdf-highlight-viewer', '.pdf-canvas'];
for (const ref of eagerCssRefs) {
  const contents = readAsset(ref);
  for (const selector of pdfVendorSelectors) {
    if (contents.includes(selector)) {
      fail(
        `Eager stylesheet ${ref} contains the PDF-vendor selector "${selector}".`,
      );
    }
  }
}

const hasOnDemandPdfEngine = onDemandRefs.some(
  (ref) => ref.endsWith('.js') && readAsset(ref).includes(PDF_ENGINE_TELLTALE),
);
if (!hasOnDemandPdfEngine) {
  fail(
    'No on-demand chunk contains the pdfjs-dist engine — the PDF lazy boundary may be broken.',
  );
}

const hasOnDemandSyntaxHighlighterEngine = onDemandRefs.some(
  (ref) =>
    ref.endsWith('.js') &&
    readAsset(ref).includes(SYNTAX_HIGHLIGHTER_ENGINE_TELLTALE),
);
if (!hasOnDemandSyntaxHighlighterEngine) {
  fail(
    'No on-demand chunk contains the react-syntax-highlighter engine — the code lazy boundary may be broken.',
  );
}

const onDemandPdfCssRef = onDemandRefs.find(
  (ref) =>
    ref.endsWith('.css') &&
    pdfVendorSelectors.every((selector) => readAsset(ref).includes(selector)),
);
if (!onDemandPdfCssRef) {
  fail('No on-demand stylesheet contains the PDF-vendor selectors.');
} else {
  const pdfCssFileName = onDemandPdfCssRef.split('/').at(-1);
  const isReferencedByJs = allAssetFiles.some(
    (ref) => ref.endsWith('.js') && readAsset(ref).includes(pdfCssFileName),
  );
  if (!isReferencedByJs) {
    fail(
      `On-demand PDF stylesheet ${onDemandPdfCssRef} is orphaned from the JavaScript chunk graph.`,
    );
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.info(
  'OK: eager entry bundles neither engine; both load only on demand.',
);
console.info(`  eager JS:   ${eagerJsRefs.join(', ')}`);
console.info(`  eager CSS:  ${eagerCssRefs.join(', ')}`);
console.info(`  on-demand:  ${onDemandRefs.length} file(s)`);
