// Unit tests for the pure package.json transformation `publish-lib.mjs` uses
// to build the manifest it writes into dist/ before `npm publish` runs there.
// Run: node --test tools/publish-lib-package-json.spec.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  stripDistPrefix,
  rewriteExportsObj,
  preparePublishPackageJson,
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
    sideEffects: ['./dist/index.js', './dist/oauth.js', './dist/file-manager.js'],
  };

  preparePublishPackageJson(json, {
    version: '1.2.3',
    projectRoot: 'libs/chat-hooks',
    isWorkspaceLib: () => false,
  });

  assert.deepEqual(json.sideEffects, ['./index.js', './oauth.js', './file-manager.js']);
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
  const json = { name: '@epam/ai-dial-chat-hooks', version: '0.0.1', private: true };

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

test('preparePublishPackageJson removes the dev-only "nx" configuration block', () => {
  const json = { name: '@epam/ai-dial-chat-hooks', nx: { tags: ['publishable'] } };

  preparePublishPackageJson(json, {
    version: '1.2.3',
    projectRoot: 'libs/chat-hooks',
    isWorkspaceLib: () => false,
  });

  assert.equal('nx' in json, false);
});
