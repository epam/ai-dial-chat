/*
 * The baseline summarizer against fixture captures: the current matrix
 * (`penguin-star`, `gift-wrapping`, `cat`), the S0 capture at 1cfb11468 that
 * still holds the removed `sleigh`, mixed provenance and unknown scenes.
 * Run: node --test libs/celebrations/browser-tests/summarize-baseline.spec.mjs
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'summarize-baseline.mjs',
);

const environment = (fingerprint) => ({
  captureId: fingerprint ? `f585b223a-wt-${fingerprint}` : 'f585b223a',
  revision: 'f585b223a',
  dirty: Boolean(fingerprint),
  fingerprint,
});

const finalSample = {
  layerPresent: false,
  animations: 0,
  snapshotNodes: 0,
};
const cycleMode = () => ({
  cycles: [
    { layerElements: 0, snapshotWrappers: 0, snapshotNodes: 0, animations: 0 },
  ],
  final: finalSample,
  resources: { heapUsedBytes: 0, detachedSvgNodes: 0 },
});
const sceneResult = (env) => ({
  ...(env ? { environment: env } : {}),
  cells: {},
  cycles: { complete: cycleMode(), cancel: cycleMode() },
});

/* Writes results.json under <cwd>/tmp/celebrations-baseline/<id>/ and runs the
   summarizer from <cwd>, as it runs from the repository root. */
const summarize = (results) => {
  const cwd = mkdtempSync(join(tmpdir(), 'summarize-baseline-'));
  const id = 'fixture';
  const root = join(cwd, 'tmp/celebrations-baseline', id);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'results.json'), JSON.stringify(results));
  const run = spawnSync(process.execPath, [SCRIPT, id], {
    cwd,
    encoding: 'utf8',
  });
  rmSync(cwd, { recursive: true, force: true });
  return run;
};

test('a current capture prints the provenance of every matrix scene', () => {
  const env = environment();
  const run = summarize({
    'penguin-star': sceneResult(env),
    'gift-wrapping': sceneResult(env),
    cat: sceneResult(env),
  });

  assert.equal(run.status, 0, run.stderr);
  for (const scene of ['penguin-star', 'gift-wrapping', 'cat']) {
    assert.match(run.stdout, new RegExp(`^\\| ${scene} \\| f585b223a`, 'm'));
    assert.match(run.stdout, new RegExp(`^## ${scene}$`, 'm'));
  }
  assert.doesNotMatch(run.stdout, /sleigh/);
});

test('PenguinStar recorded at another fingerprint is mixed provenance', () => {
  const run = summarize({
    'penguin-star': sceneResult(environment('0000aaaa')),
    'gift-wrapping': sceneResult(environment('1111bbbb')),
    cat: sceneResult(environment('1111bbbb')),
  });

  assert.equal(run.status, 1);
  assert.match(run.stderr, /Mixed provenance/);
  assert.match(run.stderr, /penguin-star at f585b223a\/0000aaaa/);
  assert.match(run.stderr, /gift-wrapping at f585b223a\/1111bbbb/);
});

test('the S0 capture with the removed sleigh still summarizes', () => {
  const run = summarize({
    environment: { revision: '1cfb11468' },
    sleigh: sceneResult(),
    'gift-wrapping': sceneResult(),
    cat: sceneResult(),
  });

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^\| revision \| 1cfb11468 \|$/m);
  assert.match(run.stdout, /^## sleigh$/m);
  assert.doesNotMatch(run.stdout, /penguin-star/);
});

test('a scene the matrix does not know is rejected', () => {
  const env = environment();
  const run = summarize({
    'penguin-star': sceneResult(env),
    'gift-wrapping': sceneResult(env),
    'snowman-delivery': sceneResult(env),
  });

  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /snowman-delivery/);
});

test('a capture holding both sleigh and penguin-star is rejected', () => {
  const run = summarize({
    sleigh: sceneResult(),
    'penguin-star': sceneResult(environment()),
  });

  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /penguin-star/);
});
