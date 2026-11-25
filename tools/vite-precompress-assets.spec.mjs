import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { precompressDirectory } from './vite/precompress-assets.mjs';

const SCRIPT = `export const items = ${JSON.stringify(
  Array.from({ length: 200 }, (_, index) => ({ id: `item-${index}` })),
)};`;

describe('precompressDirectory', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'precompress-'));
    await mkdir(join(dir, 'assets'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes Brotli and gzip copies that decode to the original', async () => {
    await writeFile(join(dir, 'assets', 'index-abc.js'), SCRIPT);

    const totals = await precompressDirectory(dir);

    assert.equal(totals.variants, 2);
    const brotli = await readFile(join(dir, 'assets', 'index-abc.js.br'));
    const gzip = await readFile(join(dir, 'assets', 'index-abc.js.gz'));
    assert.equal(brotliDecompressSync(brotli).toString('utf8'), SCRIPT);
    assert.equal(gunzipSync(gzip).toString('utf8'), SCRIPT);
    assert.ok(totals.brotliBytes < totals.originalBytes / 5);
  });

  it('skips HTML, already-compressed formats and files under 1 KB', async () => {
    await writeFile(join(dir, 'index.html'), `<html>${SCRIPT}</html>`);
    await writeFile(join(dir, 'assets', 'font.woff2'), SCRIPT);
    await writeFile(join(dir, 'assets', 'small.js'), 'export const a = 1;');

    const totals = await precompressDirectory(dir);

    assert.equal(totals.variants, 0);
    assert.deepEqual((await readdir(join(dir, 'assets'))).sort(), [
      'font.woff2',
      'small.js',
    ]);
  });

  it('skips a variant that saves less than a tenth of the file', async () => {
    await writeFile(join(dir, 'assets', 'noise.wasm'), randomBytes(4096));

    const totals = await precompressDirectory(dir);

    assert.equal(totals.variants, 0);
    assert.deepEqual(await readdir(join(dir, 'assets')), ['noise.wasm']);
  });
});
