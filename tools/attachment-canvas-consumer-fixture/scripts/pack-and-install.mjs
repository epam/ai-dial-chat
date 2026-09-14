#!/usr/bin/env node
/**
 * Packs the built `@epam/ai-dial-attachment-canvas` package — and every
 * workspace lib it depends on — through the very transform
 * `tools/publish-lib.mjs` uses for a real `npm publish`, then installs all of
 * the resulting tarballs into this fixture's own `node_modules`, isolated from
 * the workspace's own `node_modules/@epam/*` symlinks (which npm workspaces
 * points at `libs/*` source, not the published artifacts).
 *
 * This is the only way this fixture proves the real npm `exports` map,
 * externalized peers, and split CSS resolve correctly outside the workspace's
 * own alias graph (design.md's Decision 6) — every in-repo consumer resolves
 * `@epam/ai-dial-attachment-canvas` straight to source and never touches the
 * published `exports` map at all.
 *
 * Two things here are easy to get wrong, and both have bitten:
 *
 * 1. The transform is imported, never reimplemented. This script used to carry
 *    its own partial copy, which silently drifted — it stripped `./dist/`
 *    prefixes and dropped `private`/`nx`/`@epam/source`, but never resolved
 *    workspace-lib version specs.
 * 2. Workspace deps are packed too, and every tarball goes to one
 *    `npm install`. A published package names its siblings at the release
 *    version, which exists on the registry; a locally packed one names a
 *    version that does not. Handing npm the sibling's own tarball in the same
 *    invocation satisfies the spec from the local tree instead — without it,
 *    the install dies with `ETARGET` the moment a sibling stops being a peer.
 *    (Peers alone would never surface this: `--legacy-peer-deps` skips them.)
 *
 * Usage: node scripts/pack-and-install.mjs
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { preparePublishPackageJson } from '../../publish-lib-package-json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(__dirname, '..');
const workspaceRoot = resolve(fixtureRoot, '../..');
const ROOT_PACKAGE = '@epam/ai-dial-attachment-canvas';

/*
 * One version for every lib packed here, so each manifest's resolved sibling
 * specs match the sibling tarballs sitting beside it. The fixture publishes
 * nothing, so the value only has to be valid semver.
 */
const FIXTURE_VERSION = '0.0.0-fixture';

const shell = process.platform === 'win32';

/*
 * `publish-lib.mjs` gets the workspace package names from the cached Nx project
 * graph; reading the manifests directly keeps this fixture off Nx's API for
 * what is a one-line question.
 */
const libDirByPackage = new Map(
  readdirSync(resolve(workspaceRoot, 'libs'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `libs/${entry.name}`)
    .filter((projectRoot) =>
      existsSync(resolve(workspaceRoot, projectRoot, 'package.json')),
    )
    .map((projectRoot) => [
      JSON.parse(
        readFileSync(
          resolve(workspaceRoot, projectRoot, 'package.json'),
          'utf-8',
        ),
      ).name,
      projectRoot,
    ])
    .filter(([name]) => Boolean(name)),
);

const isWorkspaceLib = (dependency) => libDirByPackage.has(dependency);

const readManifest = (projectRoot) =>
  readFileSync(resolve(workspaceRoot, projectRoot, 'package.json'), 'utf-8');

/*
 * The packages npm will actually have to resolve: the root package plus the
 * transitive closure of its workspace `dependencies`. Peers are not followed —
 * `--legacy-peer-deps` leaves them for the host to provide, which is the whole
 * point of a peer.
 */
const collectPackClosure = (packageName, collected = new Map()) => {
  if (collected.has(packageName)) return collected;

  const projectRoot = libDirByPackage.get(packageName);
  collected.set(packageName, projectRoot);

  const { dependencies } = JSON.parse(readManifest(projectRoot));
  for (const dependency of Object.keys(dependencies ?? {})) {
    if (isWorkspaceLib(dependency)) collectPackClosure(dependency, collected);
  }
  return collected;
};

const packClosure = collectPackClosure(ROOT_PACKAGE);

for (const [packageName, projectRoot] of packClosure) {
  if (!existsSync(resolve(workspaceRoot, projectRoot, 'dist'))) {
    console.error(
      `Build output not found for ${packageName} at ${projectRoot}/dist.\n` +
        `Run "npm exec nx build ${packageName}" first.`,
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Rewrite each dist/package.json into a publish-ready shape, then npm pack it.
// ---------------------------------------------------------------------------

// On Windows, `npm` resolves to `npm.cmd`, a batch file the OS can only
// execute through a shell (`spawnSync` fails with EINVAL otherwise) — every
// argument here is a fixed literal or an absolute path this script itself
// computed, never external input, so shell-string concatenation is safe.
const packPublishReady = (projectRoot) => {
  const distDir = resolve(workspaceRoot, projectRoot, 'dist');
  const rawSource = readManifest(projectRoot);

  writeFileSync(
    resolve(distDir, 'package.json'),
    JSON.stringify(
      preparePublishPackageJson(JSON.parse(rawSource), {
        version: FIXTURE_VERSION,
        projectRoot,
        isWorkspaceLib,
        rawSource,
      }),
      null,
      2,
    ) + '\n',
  );

  const packOutput = execFileSync(
    'npm',
    ['pack', '--json', '--pack-destination', fixtureRoot],
    { cwd: distDir, encoding: 'utf-8', shell },
  );
  const [{ filename }] = JSON.parse(packOutput);
  return resolve(fixtureRoot, filename);
};

const tarballPaths = [...packClosure.values()].map(packPublishReady);

// ---------------------------------------------------------------------------
// Install every tarball in one invocation, into this fixture's own
// node_modules — never the workspace root's.
// ---------------------------------------------------------------------------

for (const packageName of packClosure.keys()) {
  rmSync(resolve(fixtureRoot, 'node_modules', packageName), {
    recursive: true,
    force: true,
  });
}

try {
  execFileSync(
    'npm',
    [
      'install',
      '--no-save',
      '--ignore-scripts',
      '--legacy-peer-deps',
      '--package-lock=false',
      '--prefer-offline',
      ...tarballPaths,
    ],
    {
      cwd: fixtureRoot,
      encoding: 'utf-8',
      stdio: 'inherit',
      shell,
    },
  );
} finally {
  for (const tarballPath of tarballPaths) {
    rmSync(tarballPath, { force: true });
  }
}

console.info(
  `Installed packed tarballs → ${[...packClosure.keys()].join(', ')}`,
);
