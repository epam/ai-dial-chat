/*
 * Regression tests for the module-boundary rules in eslint.config.mjs: the
 * `type:*` depConstraints of `@nx/enforce-module-boundaries` and the
 * `no-restricted-imports` guards on the fixture and hooks/UI edges. Each case
 * lints an in-memory import as if it lived in the source project's src/
 * folder; no source file is written to disk.
 * Run: node --test tools/module-boundaries.spec.mjs
 */

import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createProjectGraphAsync, readCachedProjectGraph } from '@nx/devkit';
import { ESLint } from 'eslint';

const RULE = '@nx/enforce-module-boundaries';
const RESTRICTED_RULE = 'no-restricted-imports';
const workspaceRoot = fileURLToPath(new URL('..', import.meta.url));
const eslint = new ESLint({ cwd: workspaceRoot });

/*
 * `@nx/enforce-module-boundaries` reads only the cached project graph and
 * silently skips itself when there is none — as on a fresh CI checkout where
 * no `nx` command ran first — which would turn every "cannot import" case
 * into a 0-error failure and every "may import" case into a vacuous pass.
 * Build (and cache) the graph up front, and fail loudly if it is still missing.
 */
before(async () => {
  await createProjectGraphAsync({ exitOnError: false });
  assert.ok(
    readCachedProjectGraph(),
    'no cached Nx project graph, so the boundary rule would be skipped',
  );
});

const boundaryErrors = async (
  projectRoot,
  specifier,
  ruleId = RULE,
  importedNames,
) => {
  const names = importedNames?.join(', ');
  const source = names
    ? `import { ${names} } from '${specifier}';\n\nexport { ${names} };\n`
    : `import * as probe from '${specifier}';\n\nexport default probe;\n`;
  const [result] = await eslint.lintText(source, {
    filePath: `${workspaceRoot}${projectRoot}/src/__module-boundaries-probe__.ts`,
  });
  return result.messages.filter((message) => message.ruleId === ruleId);
};

test('a UI lib cannot import the generated API client', async () => {
  const errors = await boundaryErrors(
    'libs/catalog',
    '@epam/ai-dial-chat-api-client',
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /type:ui/);
});

test('chat-shared cannot import a feature lib', async () => {
  // Every feature lib already depends on chat-shared, so Nx reports the cycle
  // before it checks tags.
  const errors = await boundaryErrors(
    'libs/chat-shared',
    '@epam/ai-dial-catalog',
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Circular dependency/);
});

test('chat-shared cannot import a non-shared lib', async () => {
  const errors = await boundaryErrors(
    'libs/chat-shared',
    '@epam/ai-dial-chat-api-client',
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /type:shared/);
});

test('the backend cannot import a frontend lib', async () => {
  const errors = await boundaryErrors(
    'apps/chat-api',
    '@epam/ai-dial-chat-shared',
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /type:backend/);
});

test('a sandbox app cannot import the generated API client', async () => {
  const errors = await boundaryErrors(
    'apps/chat-overlay-sandbox',
    '@epam/ai-dial-chat-api-client',
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /type:fixture/);
});

test('a consumer fixture cannot import the generated API client', async () => {
  const errors = await boundaryErrors(
    'tools/scheduled-tasks-consumer-fixture',
    '@epam/ai-dial-chat-api-client',
    RESTRICTED_RULE,
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Consumer fixtures are external hosts/);
});

test('chat-hooks may import the generated API client', async () => {
  const errors = await boundaryErrors(
    'libs/chat-hooks',
    '@epam/ai-dial-chat-api-client',
  );
  assert.deepEqual(errors, []);
});

test('chat-hooks cannot import a hook from a feature lib', async () => {
  const errors = await boundaryErrors(
    'libs/chat-hooks',
    '@epam/ai-dial-catalog',
    RESTRICTED_RULE,
    ['useFavColumns'],
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /not its hooks/);
});

test("chat-hooks may import a feature lib's types, enums and pure functions", async () => {
  const errors = await boundaryErrors(
    'libs/chat-hooks',
    '@epam/ai-dial-catalog',
    RESTRICTED_RULE,
    ['CatalogLimitStatus', 'getCatalogItemTabs'],
  );
  assert.deepEqual(errors, []);
});

test('a feature lib other than toolset-editor cannot import chat-hooks', async () => {
  const errors = await boundaryErrors(
    'libs/catalog',
    '@epam/ai-dial-chat-hooks',
    RESTRICTED_RULE,
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Only toolset-editor/);
});

test('toolset-editor may import chat-hooks', async () => {
  const errors = await boundaryErrors(
    'libs/toolset-editor',
    '@epam/ai-dial-chat-hooks',
    RESTRICTED_RULE,
    ['getApiErrorDetails'],
  );
  assert.deepEqual(errors, []);
});

test('chat-hooks has no .tsx file outside its tests', () => {
  const collectTsx = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return entry.name === 'tests' ? [] : collectTsx(path);
      }
      return entry.name.endsWith('.tsx') && !entry.name.includes('.spec.')
        ? [path]
        : [];
    });
  assert.deepEqual(collectTsx(join(workspaceRoot, 'libs/chat-hooks/src')), []);
});
