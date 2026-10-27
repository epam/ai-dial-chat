// Regression tests for the `type:*` depConstraints of
// `@nx/enforce-module-boundaries` in eslint.config.mjs. Each case lints an
// in-memory import as if it lived in the source project's src/ folder; nothing
// is written to disk.
// Run: node --test tools/module-boundaries.spec.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

const RULE = '@nx/enforce-module-boundaries';
const FIXTURE_RULE = 'no-restricted-imports';
const workspaceRoot = fileURLToPath(new URL('..', import.meta.url));
const eslint = new ESLint({ cwd: workspaceRoot });

const boundaryErrors = async (projectRoot, specifier, ruleId = RULE) => {
  const [result] = await eslint.lintText(
    `import * as probe from '${specifier}';\n\nexport default probe;\n`,
    {
      filePath: `${workspaceRoot}${projectRoot}/src/__module-boundaries-probe__.ts`,
    },
  );
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
    FIXTURE_RULE,
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
