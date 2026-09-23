import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  cleanupDir,
  createTmpRoot,
  execNpmSync,
  resolvePeerClosure,
} from './harness.mjs';

test('resolves workspace peers to local artifacts and external peers to exact locked versions', () => {
  const specs = {
    '@epam/ai-dial-chat-shared':
      'file:///tmp/epam-ai-dial-chat-shared-0.0.0-packed.0.tgz',
    '@epam/ai-dial-ui-kit': '0.14.0-dev.15',
    '@tabler/icons-react': '3.44.0',
  };
  const requiredPeers = {
    '@epam/ai-dial-chat-shared': {
      '@epam/ai-dial-ui-kit': '^0.14.0-dev.15',
    },
    '@epam/ai-dial-ui-kit': {
      '@tabler/icons-react': '^3.30.0',
      react: '^19.0.0',
    },
    '@tabler/icons-react': { react: '>=16' },
  };

  const closure = resolvePeerClosure(['@epam/ai-dial-chat-shared'], {
    resolveDependencySpec: (name) => specs[name],
    readClosureDependencies: (name) => requiredPeers[name] ?? {},
  });

  assert.deepEqual(closure, specs);
  assert.equal(
    Object.values(closure).some((spec) =>
      ['development', 'latest', '*'].includes(spec),
    ),
    false,
  );
});

test('deduplicates cycles in a peer dependency graph', () => {
  const calls = [];
  const closure = resolvePeerClosure(['a'], {
    resolveDependencySpec: (name) => `file:///tmp/${name}.tgz`,
    readClosureDependencies: (name) => {
      calls.push(name);
      return name === 'a' ? { b: '*' } : { a: '*' };
    },
  });

  assert.deepEqual(closure, {
    a: 'file:///tmp/a.tgz',
    b: 'file:///tmp/b.tgz',
  });
  assert.deepEqual(calls, ['a', 'b']);
});

test('packs a workspace sibling reached through dependencies, not only peers', () => {
  /*
   * `conversation-panel` composes `sidebar` as a `dependency`. The publish
   * transform rewrites that spec to the packed version, which exists only as a
   * local tarball — so a closure that followed peers alone left the sibling
   * unpacked and npm went to the registry for
   * `@epam/ai-dial-sidebar@0.0.0-packed.0`.
   */
  const pulledIn = {
    '@epam/ai-dial-conversation-panel': {
      '@epam/ai-dial-chat-shared': '*',
      '@epam/ai-dial-sidebar': '0.0.1',
    },
    '@epam/ai-dial-chat-shared': {},
    '@epam/ai-dial-sidebar': {},
  };

  const closure = resolvePeerClosure(['@epam/ai-dial-conversation-panel'], {
    resolveDependencySpec: (name) => `file:///tmp/${name}.tgz`,
    readClosureDependencies: (name) => pulledIn[name] ?? {},
  });

  assert.deepEqual(Object.keys(closure).sort(), [
    '@epam/ai-dial-chat-shared',
    '@epam/ai-dial-conversation-panel',
    '@epam/ai-dial-sidebar',
  ]);
});

/* Real concurrent packs must not exchange release versions through shared dist/. */
test('concurrent fixture releases install coherent tarballs without modifying shared build output', async (t) => {
  const tmpRoot = createTmpRoot('fixture-pack-isolation-');
  t.after(() => cleanupDir(tmpRoot));
  const workspaceRoot = path.join(tmpRoot, 'workspace');
  const names = ['@fixture/root', '@fixture/shared'];
  const originals = new Map();
  const lock = { packages: {} };
  for (const name of names) {
    const projectRoot = `libs/${name.split('/')[1]}`;
    const dir = path.join(workspaceRoot, projectRoot);
    mkdirSync(path.join(dir, 'dist'), { recursive: true });
    const source = JSON.stringify({
      name,
      version: '0.0.1',
      private: true,
      type: 'module',
      exports: {
        '.': { '@epam/source': './src/index.ts', import: './dist/index.js' },
      },
      ...(name === names[0] ? { peerDependencies: { [names[1]]: '*' } } : {}),
    });
    writeFileSync(path.join(dir, 'package.json'), source);
    /* A stale dist manifest must never supply either the version or peers. */
    const distManifest = path.join(dir, 'dist/package.json');
    writeFileSync(distManifest, '{"name":"stale","version":"9.9.9"}\n');
    originals.set(distManifest, readFileSync(distManifest, 'utf8'));
    writeFileSync(path.join(dir, 'dist/index.js'), 'export const value = 1;\n');
    lock.packages[projectRoot] = { name, version: '0.0.1' };
  }
  writeFileSync(
    path.join(workspaceRoot, 'package-lock.json'),
    JSON.stringify(lock),
  );
  const harnessUrl = new URL('./harness.mjs', import.meta.url).href;
  const versions = ['0.0.0-packed.0', '0.0.0-fixture'];
  const releases = await Promise.all(
    versions.map(async (version) => {
      const releaseDir = path.join(tmpRoot, version);
      const script = `
      import { createFixtureDependencyResolver } from ${JSON.stringify(harnessUrl)};
      const resolver = createFixtureDependencyResolver({
        workspaceRoot: ${JSON.stringify(workspaceRoot)},
        tmpRoot: ${JSON.stringify(releaseDir)},
        version: ${JSON.stringify(version)},
      });
      console.log(JSON.stringify(resolver.resolvePeerClosure(['@fixture/root'])));
    `;
      const { stdout } = await promisify(execFile)(process.execPath, [
        '--input-type=module',
        '-e',
        script,
      ]);
      return { version, releaseDir, dependencies: JSON.parse(stdout) };
    }),
  );
  for (const [manifestPath, original] of originals) {
    assert.equal(readFileSync(manifestPath, 'utf8'), original);
  }
  for (const { version, releaseDir, dependencies } of releases) {
    const consumerDir = path.join(releaseDir, 'consumer');
    mkdirSync(consumerDir);
    writeFileSync(
      path.join(consumerDir, 'package.json'),
      JSON.stringify({ private: true, dependencies }),
    );
    execNpmSync(
      [
        'install',
        '--offline',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--package-lock=false',
        '--legacy-peer-deps=false',
        '--strict-peer-deps',
      ],
      {
        cwd: consumerDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          npm_config_cache: path.join(tmpRoot, 'npm-cache'),
        },
      },
    );
    for (const name of names) {
      const manifest = JSON.parse(
        readFileSync(
          path.join(consumerDir, 'node_modules', name, 'package.json'),
          'utf8',
        ),
      );
      assert.equal(manifest.version, version);
      if (name === names[0])
        assert.equal(manifest.peerDependencies[names[1]], version);
      assert.equal(manifest.exports['.'].import, './index.js');
      assert.equal('@epam/source' in manifest.exports['.'], false);
    }
  }
});
