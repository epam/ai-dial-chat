#!/usr/bin/env node
/**
 * Packs the built `@epam/ai-dial-attachment-canvas` package through the very
 * transform `tools/publish-lib.mjs` uses for a real `npm publish` — writing a
 * publish-ready `package.json` into `dist/` — then runs `npm pack` from inside
 * `dist/` and installs the resulting tarball into this fixture's own
 * `node_modules`, isolated from the workspace's own
 * `node_modules/@epam/ai-dial-attachment-canvas` symlink (which npm workspaces
 * points at `libs/attachment-canvas` source, not the published artifact).
 *
 * This is the only way this fixture proves the real npm `exports` map,
 * externalized peers, and split CSS resolve correctly outside the workspace's
 * own alias graph (design.md's Decision 6) — every in-repo consumer resolves
 * `@epam/ai-dial-attachment-canvas` straight to source and never touches the
 * published `exports` map at all.
 *
 * The transform is imported, never reimplemented: this script used to carry its
 * own partial copy, which silently drifted — it stripped `./dist/` prefixes and
 * dropped `private`/`nx`/`@epam/source`, but never resolved workspace-lib
 * version specs the way `preparePublishPackageJson` does. That gap is invisible
 * while siblings are peers (`--legacy-peer-deps` skips them) and becomes an
 * `ETARGET` the moment one becomes a dependency, because npm then looks for a
 * placeholder version on the registry.
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
const projectRoot = 'libs/attachment-canvas';
const libRoot = resolve(workspaceRoot, projectRoot);
const distDir = resolve(libRoot, 'dist');

if (!existsSync(distDir)) {
  console.error(
    `Build output not found at ${distDir}.\nRun "npm exec nx build @epam/ai-dial-attachment-canvas" first.`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Rewrite dist/package.json into a publish-ready shape.
// ---------------------------------------------------------------------------

/*
 * `publish-lib.mjs` gets the workspace package names from the cached Nx project
 * graph; reading the manifests directly keeps this fixture off Nx's API for
 * what is a one-line question.
 */
const workspacePackageNames = new Set(
  readdirSync(resolve(workspaceRoot, 'libs'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(workspaceRoot, 'libs', entry.name, 'package.json'))
    .filter(existsSync)
    .map((manifest) => JSON.parse(readFileSync(manifest, 'utf-8')).name)
    .filter(Boolean),
);

const rawSource = readFileSync(resolve(libRoot, 'package.json'), 'utf-8');
const sourcePackageJson = JSON.parse(rawSource);

/*
 * The fixture publishes nothing, so any valid version works — the source
 * version keeps the packed tarball named as it is today, and is what sibling
 * tarballs would have to agree on if this fixture ever packs them too.
 */
const publishReadyPackageJson = preparePublishPackageJson(sourcePackageJson, {
  version: sourcePackageJson.version,
  projectRoot,
  isWorkspaceLib: (dependency) => workspacePackageNames.has(dependency),
  rawSource,
});

writeFileSync(
  resolve(distDir, 'package.json'),
  JSON.stringify(publishReadyPackageJson, null, 2) + '\n',
);

// ---------------------------------------------------------------------------
// npm pack from inside dist/, then install the tarball into this fixture's
// own node_modules — never the workspace root's.
// ---------------------------------------------------------------------------

// On Windows, `npm` resolves to `npm.cmd`, a batch file the OS can only
// execute through a shell (`spawnSync` fails with EINVAL otherwise) — every
// argument here is a fixed literal or an absolute path this script itself
// computed, never external input, so shell-string concatenation is safe.
const packOutput = execFileSync(
  'npm',
  ['pack', '--json', '--pack-destination', fixtureRoot],
  { cwd: distDir, encoding: 'utf-8', shell: process.platform === 'win32' },
);
const [{ filename: tarballName }] = JSON.parse(packOutput);
const tarballPath = resolve(fixtureRoot, tarballName);

const installedPackageDir = resolve(
  fixtureRoot,
  'node_modules/@epam/ai-dial-attachment-canvas',
);
rmSync(installedPackageDir, { recursive: true, force: true });
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
      tarballPath,
    ],
    {
      cwd: fixtureRoot,
      encoding: 'utf-8',
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );
} finally {
  rmSync(tarballPath, { force: true });
}

console.info(
  `Installed the packed @epam/ai-dial-attachment-canvas tarball → ${installedPackageDir}`,
);
