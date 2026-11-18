import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import {
  dropRootManifestRepeats,
  readWorkspaceDeclaredDependencies,
} from './drop-root-manifest-repeats.mjs';

const issue = (workspace, symbol) => ({ workspace, symbol });

const reporterOptions = () => ({
  issues: {
    dependencies: {
      '/repo/package.json': {
        react: issue('.', 'react'),
        polished: issue('.', 'polished'),
      },
      '/repo/apps/chat-api/package.json': {
        react: issue('apps/chat-api', 'react'),
      },
    },
    devDependencies: {
      '/repo/package.json': { vite: issue('.', 'vite') },
    },
    optionalPeerDependencies: {},
  },
  counters: {
    dependencies: 3,
    devDependencies: 1,
    optionalPeerDependencies: 0,
  },
});

describe('dropRootManifestRepeats', () => {
  it('drops root findings for packages a workspace declares', () => {
    const result = dropRootManifestRepeats(
      reporterOptions(),
      new Set(['react', 'vite']),
    );

    assert.deepEqual(
      Object.keys(result.issues.dependencies['/repo/package.json']),
      ['polished'],
    );
    assert.equal(
      result.issues.devDependencies['/repo/package.json'],
      undefined,
    );
    assert.equal(result.counters.dependencies, 2);
    assert.equal(result.counters.devDependencies, 0);
  });

  it('keeps the same package reported by its owning workspace', () => {
    const result = dropRootManifestRepeats(
      reporterOptions(),
      new Set(['react']),
    );

    assert.ok(
      result.issues.dependencies['/repo/apps/chat-api/package.json'].react,
    );
  });

  it('keeps root findings that no workspace declares', () => {
    const result = dropRootManifestRepeats(reporterOptions(), new Set());

    assert.equal(result.counters.dependencies, 3);
    assert.equal(result.counters.devDependencies, 1);
  });
});

describe('readWorkspaceDeclaredDependencies', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'knip-root-repeats-'));
  after(() => rmSync(cwd, { recursive: true, force: true }));

  it('collects every dependency field of app and lib manifests', () => {
    const write = (dir, manifest) => {
      mkdirSync(join(cwd, dir), { recursive: true });
      writeFileSync(join(cwd, dir, 'package.json'), JSON.stringify(manifest));
    };
    write('apps/chat', { dependencies: { react: '^19.0.0' } });
    write('libs/kit', {
      peerDependencies: { 'react-dom': '^19.0.0' },
      devDependencies: { vitest: '^4.0.0' },
    });
    write('packages/ignored', { dependencies: { lodash: '^4.0.0' } });

    assert.deepEqual([...readWorkspaceDeclaredDependencies(cwd)].sort(), [
      'react',
      'react-dom',
      'vitest',
    ]);
  });
});
