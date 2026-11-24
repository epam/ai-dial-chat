import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import {
  checkRouteGraph,
  packageOf,
  readStaticImports,
} from './check-route-graph.mjs';

const dirs = [];

/* Writes a minimal built `dist/`: an entry with one preload, a lazy route
 * chunk and its static imports, each with a source map naming its sources. */
const makeDist = (chunks) => {
  const distDir = mkdtempSync(join(tmpdir(), 'route-graph-'));
  dirs.push(distDir);
  const assetsDir = join(distDir, 'assets');
  mkdirSync(assetsDir);
  writeFileSync(
    join(distDir, 'index.html'),
    '<script type="module" src="/assets/index-a.js"></script>' +
      '<link rel="modulepreload" href="/assets/vendor-b.js">',
  );
  Object.entries(chunks).forEach(([file, { code, sources }]) => {
    writeFileSync(join(assetsDir, file), code);
    writeFileSync(
      join(assetsDir, `${file}.map`),
      JSON.stringify({ version: 3, sources, mappings: '' }),
    );
  });
  return distDir;
};

after(() =>
  dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })),
);

describe('readStaticImports', () => {
  it('reads static imports and re-exports but not dynamic imports', () => {
    const code =
      'import{a as b}from"./one-1.js";import"./two-2.js";' +
      'export{c}from"./three-3.js";const d=()=>import("./lazy-4.js");';

    assert.deepEqual(readStaticImports(code), [
      'one-1.js',
      'two-2.js',
      'three-3.js',
    ]);
  });
});

describe('packageOf', () => {
  it('returns scoped and plain package names, and null for app code', () => {
    assert.equal(
      packageOf('../../node_modules/@mcp-ui/client/dist/index.mjs'),
      '@mcp-ui/client',
    );
    assert.equal(packageOf('../../node_modules/zod/v4/core.js'), 'zod');
    assert.equal(packageOf('../../apps/chat/src/app/app.tsx'), null);
  });
});

describe('checkRouteGraph', () => {
  it('reports a forbidden package reachable from the route, skipping entry chunks', () => {
    const distDir = makeDist({
      'index-a.js': {
        code: 'import"./vendor-b.js";',
        sources: ['src/main.tsx'],
      },
      'vendor-b.js': {
        code: '',
        sources: ['../node_modules/zod/index.js'],
      },
      'Conversation-c.js': {
        code: 'import"./vendor-b.js";import"./shared-d.js";',
        sources: ['src/pages/Conversation.tsx'],
      },
      'shared-d.js': {
        code: 'const l=()=>import("./lazy-e.js");',
        sources: ['../node_modules/@mcp-ui/client/dist/index.mjs'],
      },
      'lazy-e.js': {
        code: '',
        sources: ['../node_modules/@modelcontextprotocol/sdk/index.js'],
      },
    });

    const report = checkRouteGraph({ distDir, chunkPrefix: 'Conversation-' });

    assert.deepEqual(report.chunks.map((chunk) => chunk.file).sort(), [
      'Conversation-c.js',
      'shared-d.js',
    ]);
    assert.deepEqual(report.forbidden, ['@mcp-ui/client']);
    assert.equal(report.hasSourceMaps, true);
  });

  it('passes when the forbidden packages sit behind a dynamic import only', () => {
    const distDir = makeDist({
      'index-a.js': { code: '', sources: [] },
      'vendor-b.js': { code: '', sources: [] },
      'Conversation-c.js': {
        code: 'const l=()=>import("./renderer-d.js");',
        sources: ['src/pages/Conversation.tsx'],
      },
      'renderer-d.js': {
        code: '',
        sources: ['../node_modules/zod/index.js'],
      },
    });

    const report = checkRouteGraph({ distDir, chunkPrefix: 'Conversation-' });

    assert.deepEqual(report.forbidden, []);
  });

  it('throws when no chunk matches the prefix', () => {
    const distDir = makeDist({ 'index-a.js': { code: '', sources: [] } });

    assert.throws(
      () => checkRouteGraph({ distDir, chunkPrefix: 'Missing-' }),
      /No chunk starting with "Missing-"/,
    );
  });
});
