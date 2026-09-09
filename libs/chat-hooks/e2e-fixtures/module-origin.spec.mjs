/**
 * Proves that scanning a production
 * bundle's *text* for a forbidden implementation's declared name is
 * unreliable, and that `matchesForbiddenOrigin`'s module-origin metadata
 * (real chunk provenance from `generateBundle`, not text) catches the same
 * case reliably. See `application-mode.mjs`'s `matchesForbiddenOrigin` doc
 * comment for the mechanism this documents.
 *
 * Hermetic and fast: the "forbidden" module is a local fixture file aliased
 * in directly (no npm install, no real dependency), so this only exercises
 * the build/measurement pipeline, not any real package's peer contract.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildEntry,
  matchesForbiddenOrigin,
  measureBuild,
} from './application-mode.mjs';
import { cleanupDir, createFixtureDir } from './harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const chatHooksRoot = path.resolve(here, '..');
const workspaceRoot = path.resolve(chatHooksRoot, '..', '..');
const keepFixtures = process.env.KEEP_FIXTURES === '1';
const tmpRoot = mkdtempSync(
  path.join(os.tmpdir(), 'ai-dial-chat-module-origin-'),
);

after(() => {
  if (!keepFixtures) cleanupDir(tmpRoot);
});

test('module-origin metadata finds a forbidden implementation that minified text does not', () => {
  const dir = createFixtureDir(tmpRoot, 'forbidden-origin');

  /*
   * A module-scope function declaration with no string-literal reference to
   * its own name anywhere (unlike, e.g., a class relying on
   * `Symbol.toStringTag` — see fixtures.mjs's SIDE_EFFECT_CHECKS comment for
   * why that case *does* survive minification). A plain top-level function
   * whose only reference is a call site is exactly the case a minifier
   * safely renames.
   */
  const forbiddenModulePath = path.join(
    dir,
    'forbidden-marker-implementation.ts',
  );
  writeFileSync(
    forbiddenModulePath,
    'export function superDistinctiveForbiddenComputation() {\n  return 40 + 2;\n}\n',
  );
  writeFileSync(
    path.join(dir, 'entry.ts'),
    "import { superDistinctiveForbiddenComputation } from 'forbidden-marker-lib';\n" +
      'globalThis.__value = superDistinctiveForbiddenComputation();\n',
  );
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      { name: 'module-origin-negative-fixture', private: true, type: 'module' },
      null,
      2,
    ) + '\n',
  );

  const build = buildEntry(workspaceRoot, dir, {
    'forbidden-marker-lib': forbiddenModulePath,
  });
  assert.equal(
    build.success,
    true,
    `fixture must build:\n${build.output ?? ''}`,
  );

  const measured = measureBuild(build.outDir);

  assert.equal(
    measured.initialFilesText.includes('superDistinctiveForbiddenComputation'),
    false,
    'expected the minifier to rename this local binding out of the bundle text — if this now ' +
      'fails, the premise of this negative test (that text search is unreliable) may no longer ' +
      'hold for this bundler/minify configuration; investigate before relying on text search anywhere.',
  );

  const found = matchesForbiddenOrigin(measured, [
    'forbidden-marker-implementation',
  ]);
  assert.deepEqual(
    found,
    ['forbidden-marker-implementation'],
    'module-origin metadata must find the forbidden module by its resolved path even though its ' +
      'declared name is absent from the bundle text',
  );
});
