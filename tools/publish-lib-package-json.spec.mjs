// Unit tests for the pure package.json transformation `publish-lib.mjs` uses
// to build the manifest it writes into dist/ before `npm publish` runs there.
// Run: node --test tools/publish-lib-package-json.spec.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  stripDistPrefix,
  rewriteExportsObj,
  preparePublishPackageJson,
  countRawJsonKeyOccurrences,
  collectExportFilePaths,
} from './publish-lib-package-json.mjs';

test('stripDistPrefix rewrites a "./dist/..." path to "./..."', () => {
  assert.equal(stripDistPrefix('./dist/index.js'), './index.js');
  assert.equal(stripDistPrefix('./dist/oauth.js'), './oauth.js');
});

test('stripDistPrefix leaves a non-"./dist/" string untouched', () => {
  assert.equal(stripDistPrefix('./package.json'), './package.json');
  assert.equal(stripDistPrefix('react'), 'react');
});

test('stripDistPrefix passes through non-string values unchanged', () => {
  assert.equal(stripDistPrefix(undefined), undefined);
  assert.equal(stripDistPrefix(null), null);
});

test('rewriteExportsObj strips "./dist/" prefixes and drops "@epam/source" at any depth', () => {
  const rewritten = rewriteExportsObj({
    '.': {
      '@epam/source': './src/index.ts',
      types: './dist/index.d.ts',
      import: './dist/index.js',
      default: './dist/index.js',
    },
    './package.json': './package.json',
  });

  assert.deepEqual(rewritten, {
    '.': {
      types: './index.d.ts',
      import: './index.js',
      default: './index.js',
    },
    './package.json': './package.json',
  });
});

test('preparePublishPackageJson rewrites a top-level sideEffects array', () => {
  const json = {
    name: '@epam/ai-dial-chat-hooks',
    sideEffects: [
      './dist/index.js',
      './dist/oauth.js',
      './dist/file-manager.js',
    ],
  };

  preparePublishPackageJson(json, {
    version: '1.2.3',
    projectRoot: 'libs/chat-hooks',
    isWorkspaceLib: () => false,
  });

  assert.deepEqual(json.sideEffects, [
    './index.js',
    './oauth.js',
    './file-manager.js',
  ]);
});

test('preparePublishPackageJson leaves an absent sideEffects field untouched', () => {
  const json = { name: '@epam/ai-dial-chat-hooks' };

  preparePublishPackageJson(json, {
    version: '1.2.3',
    projectRoot: 'libs/chat-hooks',
    isWorkspaceLib: () => false,
  });

  assert.equal('sideEffects' in json, false);
});

test('preparePublishPackageJson sets version, drops "private", and sets "repository"', () => {
  const json = {
    name: '@epam/ai-dial-chat-hooks',
    version: '0.0.1',
    private: true,
  };

  preparePublishPackageJson(json, {
    version: '1.2.3',
    projectRoot: 'libs/chat-hooks',
    isWorkspaceLib: () => false,
  });

  assert.equal(json.version, '1.2.3');
  assert.equal('private' in json, false);
  assert.equal(json.repository.type, 'git');
  assert.equal(json.repository.directory, 'libs/chat-hooks');
});

test('preparePublishPackageJson resolves workspace-lib dependency placeholders to the publish version', () => {
  const json = {
    name: '@epam/ai-dial-chat-hooks',
    peerDependencies: { react: '^19.2.6', '@epam/ai-dial-chat-shared': '*' },
  };

  preparePublishPackageJson(json, {
    version: '1.2.3',
    projectRoot: 'libs/chat-hooks',
    isWorkspaceLib: (dep) => dep === '@epam/ai-dial-chat-shared',
  });

  assert.equal(json.peerDependencies.react, '^19.2.6');
  assert.equal(json.peerDependencies['@epam/ai-dial-chat-shared'], '1.2.3');
});

test('countRawJsonKeyOccurrences counts a top-level key literal in raw JSON text', () => {
  assert.equal(
    countRawJsonKeyOccurrences(
      '{"sideEffects": false, "sideEffects": ["a"]}',
      'sideEffects',
    ),
    2,
  );
  assert.equal(
    countRawJsonKeyOccurrences('{"sideEffects": ["a"]}', 'sideEffects'),
    1,
  );
  assert.equal(
    countRawJsonKeyOccurrences('{"main": "./index.js"}', 'sideEffects'),
    0,
  );
});

test('preparePublishPackageJson errors on a manifest with more than one "sideEffects" key, rather than silently picking one', () => {
  const rawSource =
    '{"name":"@epam/ai-dial-chat-hooks","sideEffects":false,"sideEffects":["./dist/index.js"]}';
  const json = JSON.parse(rawSource);

  assert.throws(
    () =>
      preparePublishPackageJson(json, {
        version: '1.2.3',
        projectRoot: 'libs/chat-hooks',
        isWorkspaceLib: () => false,
        rawSource,
      }),
    /"sideEffects"/,
  );
});

test('preparePublishPackageJson accepts a manifest with exactly one "sideEffects" key when rawSource is provided', () => {
  const rawSource =
    '{"name":"@epam/ai-dial-chat-hooks","sideEffects":["./dist/index.js"]}';
  const json = JSON.parse(rawSource);

  preparePublishPackageJson(json, {
    version: '1.2.3',
    projectRoot: 'libs/chat-hooks',
    isWorkspaceLib: () => false,
    rawSource,
  });

  assert.deepEqual(json.sideEffects, ['./index.js']);
});

test('preparePublishPackageJson removes the dev-only "nx" configuration block', () => {
  const json = {
    name: '@epam/ai-dial-chat-hooks',
    nx: { tags: ['publishable'] },
  };

  preparePublishPackageJson(json, {
    version: '1.2.3',
    projectRoot: 'libs/chat-hooks',
    isWorkspaceLib: () => false,
  });

  assert.equal('nx' in json, false);
});

test('collectExportFilePaths gathers leaf targets from every condition and subpath', () => {
  const targets = collectExportFilePaths({
    './package.json': './package.json',
    './styles.css': './index.css',
    '.': {
      types: './index.d.ts',
      import: './index.js',
      default: './index.js',
    },
    './markdown': {
      types: './markdown.d.ts',
      import: './markdown.js',
      default: './markdown.js',
    },
  });

  assert.deepEqual([...targets].sort(), [
    './index.css',
    './index.d.ts',
    './index.js',
    './markdown.d.ts',
    './markdown.js',
    './package.json',
  ]);
});

test('collectExportFilePaths skips bare specifiers and array fallbacks keep both entries', () => {
  const targets = collectExportFilePaths({
    './aliased': 'some-other-package',
    './fallback': ['./modern.js', './legacy.js'],
  });

  assert.deepEqual([...targets].sort(), ['./legacy.js', './modern.js']);
});

test('collectExportFilePaths returns an empty set for a package without exports', () => {
  assert.deepEqual([...collectExportFilePaths(undefined)], []);
});

test('nested sideEffects metadata is not a duplicate root key', () => {
  const rawSource = '{"sideEffects":false,"metadata":{"sideEffects":true}}';
  assert.doesNotThrow(() =>
    preparePublishPackageJson(JSON.parse(rawSource), {
      version: '1.0.0',
      projectRoot: 'libs/example',
      isWorkspaceLib: () => false,
      rawSource,
    }),
  );
});
