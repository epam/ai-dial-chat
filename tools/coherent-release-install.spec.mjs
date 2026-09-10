import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  cleanupDir,
  createFixtureDir,
  createFixtureDependencyResolver,
  execNpmSync,
  FIXTURE_PACKAGE_VERSION,
  npmInstallFixture,
  typecheckFixture,
} from '../libs/chat-hooks/e2e-fixtures/harness.mjs';
import { ALL_OPTIONAL_PEERS } from '../libs/chat-hooks/e2e-fixtures/fixtures.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(here, '..');
const keepFixtures = process.env.KEEP_FIXTURES === '1';
const IN_SCOPE_PACKAGES = [
  { name: '@epam/ai-dial-chat-shared', projectRoot: 'libs/chat-shared' },
  { name: '@epam/ai-dial-chat-hooks', projectRoot: 'libs/chat-hooks' },
  { name: '@epam/ai-dial-catalog', projectRoot: 'libs/catalog' },
  { name: '@epam/ai-dial-publish-panel', projectRoot: 'libs/publish-panel' },
];
let tmpRoot;
let dependencyResolver;
let reactVersion;
let reactTypesVersion;
before(() => {
  tmpRoot = mkdtempSync(
    path.join(os.tmpdir(), 'ai-dial-chat-coherent-release-'),
  );
  dependencyResolver = createFixtureDependencyResolver({
    workspaceRoot,
    tmpRoot,
    version: FIXTURE_PACKAGE_VERSION,
  });
  const workspaceLock = JSON.parse(
    readFileSync(path.join(workspaceRoot, 'package-lock.json'), 'utf8'),
  );
  reactVersion =
    workspaceLock.packages?.['node_modules/react']?.version ??
    (() => {
      throw new Error('package-lock.json has no exact root version for react');
    })();
  reactTypesVersion =
    workspaceLock.packages?.['node_modules/@types/react']?.version ??
    (() => {
      throw new Error(
        'package-lock.json has no exact root version for @types/react',
      );
    })();
});
after(() => {
  if (!keepFixtures) cleanupDir(tmpRoot);
  else console.info(`KEEP_FIXTURES=1 set — fixtures left at: ${tmpRoot}`);
});
const packageDirIn = (dir, packageName) =>
  path.join(dir, 'node_modules', ...packageName.split('/'));
test('coherent release: all four in-scope packages install at the same packed version and typecheck together', () => {
  const dir = createFixtureDir(tmpRoot, 'coherent-set');
  const directPeers = [
    ...IN_SCOPE_PACKAGES.map(({ name }) => name),
    ...ALL_OPTIONAL_PEERS,
  ];
  const dependencies = {
    react: reactVersion,
    '@types/react': reactTypesVersion,
    ...dependencyResolver.resolvePeerClosure(directPeers),
  };
  const manifest = {
    name: 'coherent-set-fixture',
    private: true,
    type: 'module',
    dependencies,
  };
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  assertCoherentTarballs(dependencies);
  npmInstallFixture(dir);
  for (const { name } of IN_SCOPE_PACKAGES) {
    const installedManifest = JSON.parse(
      readFileSync(path.join(packageDirIn(dir, name), 'package.json'), 'utf8'),
    );
    assert.equal(
      installedManifest.version,
      FIXTURE_PACKAGE_VERSION,
      `${name} must install at the coherent set's exact packed version`,
    );
  }
  writeFileSync(
    path.join(dir, 'entry.ts'),
    [
      "import { FilterTab } from '@epam/ai-dial-chat-shared';",
      "import { safeDecodeURIComponent } from '@epam/ai-dial-chat-hooks/utils';",
      "import { CredentialsLevel } from '@epam/ai-dial-catalog';",
      "import { derivePublishState } from '@epam/ai-dial-publish-panel';",
      '',
      'export const coherentSetCheck = {',
      '  FilterTab,',
      '  safeDecodeURIComponent,',
      '  CredentialsLevel,',
      '  derivePublishState,',
      '};',
      '',
    ].join('\n'),
  );
  const tsc = typecheckFixture(workspaceRoot, dir);
  assert.equal(
    tsc.success,
    true,
    `coherent-set consumer must typecheck against the four in-scope packages' real public API:\n${tsc.output}`,
  );
});

// Read the manifests actually packed, not the workspace manifests rewritten later.
const assertCoherentTarballs = (dependencies) => {
  const manifests = new Map();
  for (const [name, spec] of Object.entries(dependencies)) {
    if (!name.startsWith('@epam/ai-dial-') || !spec.startsWith('file:'))
      continue;
    const tarball = spec.startsWith('file:///')
      ? fileURLToPath(spec)
      : spec.slice(5);
    manifests.set(
      name,
      JSON.parse(
        execFileSync('tar', ['-xOf', tarball, 'package/package.json'], {
          encoding: 'utf8',
        }),
      ),
    );
  }
  for (const [name, manifest] of manifests) {
    for (const [peer, version] of Object.entries({
      ...manifest.dependencies,
      ...manifest.peerDependencies,
    })) {
      if (!manifests.has(peer)) continue;
      assert.equal(
        manifests.get(peer).version,
        version,
        name + ' -> ' + peer + ' requires ' + version,
      );
    }
  }
};

test('mixed release: existing local tarballs identify an incompatible internal peer edge', () => {
  const peers = [
    ...IN_SCOPE_PACKAGES.map((item) => item.name),
    ...ALL_OPTIONAL_PEERS,
  ];
  const coherent = dependencyResolver.resolvePeerClosure(peers);
  assertCoherentTarballs(coherent);
  const oldDir = createFixtureDir(tmpRoot, 'old-shared');
  cpSync(path.join(workspaceRoot, 'libs/chat-shared/dist'), oldDir, {
    recursive: true,
  });
  const manifestPath = path.join(oldDir, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.version = '0.0.0-packed.previous';
  writeFileSync(manifestPath, JSON.stringify(manifest));
  const [{ filename }] = JSON.parse(
    execNpmSync(['pack', '--json', '--pack-destination', tmpRoot], {
      cwd: oldDir,
      encoding: 'utf8',
    }),
  );
  const mixed = {
    ...coherent,
    '@epam/ai-dial-chat-shared': 'file:' + path.join(tmpRoot, filename),
  };
  assert.throws(
    () => assertCoherentTarballs(mixed),
    /requires 0\.0\.0-packed\.0/,
  );
});
