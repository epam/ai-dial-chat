#!/usr/bin/env node
/**
 * Reads apps/chat/dist/index.html, resolves every script/modulepreload/stylesheet
 * it references, and prints raw + gzip byte sizes plus JS/CSS/total subtotals.
 *
 * Used as the repeatable measurement tool for this change's before/after
 * bundle tables (see openspec/changes/optimize-chat-cold-load-performance).
 *
 * Usage: node scripts/measure-initial-bundle.mjs [path/to/dist/index.html]
 */
import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';

const indexHtmlPath = resolve(
  process.argv[2] ?? join('apps', 'chat', 'dist', 'index.html'),
);
const distDir = dirname(indexHtmlPath);

const html = readFileSync(indexHtmlPath, 'utf8');

// Match src="/assets/..." (entry script) and href="/assets/..." (modulepreload / stylesheet).
const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
  (m) => m[1],
);
// Preserve first-seen order, drop duplicates (e.g. an asset referenced twice).
const uniqueRefs = [...new Set(refs)];

const rows = uniqueRefs.map((ref) => {
  const filePath = join(distDir, ref.replace(/^\//, ''));
  const raw = statSync(filePath).size;
  const gzip = gzipSync(readFileSync(filePath)).length;
  const type = ref.endsWith('.css') ? 'css' : 'js';
  return { ref, type, raw, gzip };
});

const fmt = (n) => n.toLocaleString('en-US');

function printTable(title, list) {
  console.log(`\n${title}`);
  for (const { ref, raw, gzip } of list) {
    console.log(`  ${ref.padEnd(50)} raw ${fmt(raw).padStart(10)}  gzip ${fmt(gzip).padStart(9)}`);
  }
}

const jsRows = rows.filter((r) => r.type === 'js');
const cssRows = rows.filter((r) => r.type === 'css');

printTable(`JS (${jsRows.length} files)`, jsRows);
printTable(`CSS (${cssRows.length} files)`, cssRows);

const sum = (list, key) => list.reduce((acc, r) => acc + r[key], 0);

console.log('\nTotals');
console.log(`  JS    raw ${fmt(sum(jsRows, 'raw')).padStart(12)}  gzip ${fmt(sum(jsRows, 'gzip')).padStart(10)}`);
console.log(`  CSS   raw ${fmt(sum(cssRows, 'raw')).padStart(12)}  gzip ${fmt(sum(cssRows, 'gzip')).padStart(10)}`);
console.log(`  Total raw ${fmt(sum(rows, 'raw')).padStart(12)}  gzip ${fmt(sum(rows, 'gzip')).padStart(10)}`);
