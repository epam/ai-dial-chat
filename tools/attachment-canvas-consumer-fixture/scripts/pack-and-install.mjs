#!/usr/bin/env node
/**
 * Packs the built `@epam/ai-dial-attachment-canvas` package the same way
 * `tools/publish-lib.mjs` prepares it for a real `npm publish` — writing a
 * publish-ready `package.json` into `dist/` (`"./dist/"` export prefixes
 * stripped, the `"@epam/source"` condition removed, `"private"`/`"nx"`
 * dropped) — then runs `npm pack` from inside `dist/` and installs the
 * resulting tarball into this fixture's own `node_modules`, isolated from
 * the workspace's own `node_modules/@epam/ai-dial-attachment-canvas`
 * symlink (which npm workspaces points at `libs/attachment-canvas` source,
 * not the published artifact).
 *
 * This is the only way this fixture proves the real npm `exports` map,
 * externalized peers, and split CSS resolve correctly outside the
 * workspace's own alias graph (design.md's Decision 6) — every in-repo
 * consumer resolves `@epam/ai-dial-attachment-canvas` straight to source
 * and never touches the published `exports` map at all.
 *
 * Usage: node scripts/pack-and-install.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(__dirname, '..');
const workspaceRoot = resolve(fixtureRoot, '../..');
const libRoot = resolve(workspaceRoot, 'libs/attachment-canvas');
const distDir = resolve(libRoot, 'dist');

if (!existsSync(distDir)) {
  console.error(
    `Build output not found at ${distDir}.\nRun "npm exec nx build @epam/ai-dial-attachment-canvas" first.`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Rewrite dist/package.json into a publish-ready shape (mirrors
// tools/publish-lib.mjs's transform, without its npm-publish/network step).
// ---------------------------------------------------------------------------

const stripDistPrefix = (value) =>
  typeof value === 'string' && value.startsWith('./dist/')
    ? './' + value.slice('./dist/'.length)
    : value;

const rewriteExports = (value) => {
  if (typeof value === 'string') return stripDistPrefix(value);
  if (Array.isArray(value)) return value.map(rewriteExports);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== '@epam/source')
        .map(([key, entry]) => [key, rewriteExports(entry)]),
    );
  }
  return value;
};

const sourcePackageJson = JSON.parse(
  readFileSync(resolve(libRoot, 'package.json'), 'utf-8'),
);

const publishReadyPackageJson = {
  ...sourcePackageJson,
  main: stripDistPrefix(sourcePackageJson.main),
  module: stripDistPrefix(sourcePackageJson.module),
  types: stripDistPrefix(sourcePackageJson.types),
  exports: rewriteExports(sourcePackageJson.exports),
};
delete publishReadyPackageJson.private;
delete publishReadyPackageJson.nx;

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
      '--offline',
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
