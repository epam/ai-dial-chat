/**
 * Publishes a workspace library to npm.
 *
 * Usage:
 *   node tools/publish-lib.mjs <project-name> --version=<ver> [--tag=<tag>] [--dry=true]
 *
 * Arguments:
 *   <project-name>   Nx project name (scoped package name, e.g. @epam/ai-dial-conversation-input)
 *   --version        SemVer string to publish as (#.#.#, #.#.#-tag.#, or 'dev').
 *                     Defaults to the root package.json version when omitted.
 *   --tag            npm dist-tag (default: "dev") — never defaults to "latest"
 *   --dry            Pass "true" to perform a dry run without actually publishing
 *   --development    When true and --version is omitted, publish the next
 *                    development version from npm, e.g. #.#.#.N
 *
 * What the script does:
 *   1. Reads the Nx project graph to locate the project root and build output (dist/).
 *   2. Reads the source package.json from the project root.
 *   3. Writes a publish-ready package.json into dist/:
 *      - Sets version
 *      - Removes "private"
 *      - Removes the "@epam/source" export condition (internal monorepo source pointer)
 *      - Rewrites "./dist/..." paths to "./" since publishing from inside dist/
 *      - Replaces workspace-lib dependency placeholders ("*", "0.0.1") with the publish version
 *   4. Runs `npm publish` from the dist/ directory.
 *
 * Note: the source package.json is never modified.
 */

import mainPackageJson from '../package.json' with { type: 'json' };

import devkit from '@nx/devkit';
import { execFileSync, execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { parseArgs } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { readCachedProjectGraph, workspaceRoot } = devkit;

function invariant(condition, message) {
  if (!condition) {
    console.error(`\nERROR: ${message}\n`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Parse CLI arguments
// ---------------------------------------------------------------------------

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    version: { type: 'string' },
    tag: { type: 'string' },
    dry: { type: 'string' },
    development: { type: 'string' },
  },
  allowPositionals: true,
  strict: false,
});

const name = positionals[0];
// Fall back to the root package.json version when --version isn't provided,
// e.g. plain "npm run publish:npm" after the root version has been bumped for a release.
let version = values.version || mainPackageJson.version;
const dry = values.dry === 'true';
const development = values.development === 'true';
// Default tag to "dev" — never accidentally publish under "latest"
const tag = values.tag || 'dev';

console.info(
  `\nPublish run:\n  project : ${name}\n  version : ${version}\n  tag     : ${tag}\n  dry     : ${dry}\n  dev     : ${development}\n`,
);

// ---------------------------------------------------------------------------
// Validate inputs
// ---------------------------------------------------------------------------

invariant(
  name,
  'No project name provided.\nUsage: node tools/publish-lib.mjs <project-name> --version=<ver>',
);

// ---------------------------------------------------------------------------
// Resolve project from Nx graph
// ---------------------------------------------------------------------------

const graph = readCachedProjectGraph();
const project = graph.nodes[name];

invariant(
  project,
  `Could not find project "${name}" in the workspace.\nRun "npm exec nx show projects" to list available project names.`,
);

// Collect all workspace library package names so we can identify sibling deps
const workspacePackageNames = new Set();
for (const nodeName of Object.keys(graph.nodes)) {
  const root = graph.nodes[nodeName]?.data?.root;
  if (!root) continue;
  const pkgPath = path.join(workspaceRoot, root, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) workspacePackageNames.add(pkg.name);
    } catch {
      // ignore unreadable package.json
    }
  }
}

const isWorkspaceLib = (dep) => workspacePackageNames.has(dep);

function getDevelopmentVersion(packageName, baseVersion) {
  let publishedVersions;

  try {
    const stdout = execFileSync('npm', ['view', packageName, 'versions', '--json'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    publishedVersions = JSON.parse(stdout);
  } catch (err) {
    const stderr = String(err.stderr || '');
    if (stderr.includes('E404')) {
      console.warn(`${packageName} has no published versions yet; using ${baseVersion}.0.`);
      publishedVersions = [];
    } else {
      throw new Error(`Could not get published versions for ${packageName}.`);
    }
  }

  const versions = Array.isArray(publishedVersions)
    ? publishedVersions
    : publishedVersions
      ? [publishedVersions]
      : [];

  const lastNumber = versions
    .filter((publishedVersion) => publishedVersion.startsWith(`${baseVersion}.`))
    .map((publishedVersion) => publishedVersion.match(/\d+$/)?.[0])
    .filter(Boolean)
    .map((publishedVersion) => parseInt(publishedVersion, 10))
    .sort((a, b) => b - a)[0];

  return `${baseVersion}.${typeof lastNumber === 'number' ? lastNumber + 1 : 0}`;
}

// ---------------------------------------------------------------------------
// Resolve project root and build output directory
// ---------------------------------------------------------------------------

const projectRoot = project.data?.root; // e.g. "libs/conversation-input"
invariant(projectRoot, `Could not determine root for project "${name}".`);

const projectRootAbs = path.join(workspaceRoot, projectRoot);

// Vite lib builds in this workspace output to {projectRoot}/dist.
// Resolve Nx tokens manually since readCachedProjectGraph does not expand them.
let rawOutputPath = project.data?.targets?.build?.options?.outputPath;
let outputPath;

if (rawOutputPath) {
  outputPath = rawOutputPath
    .replace('{projectRoot}', projectRootAbs)
    .replace('{workspaceRoot}', workspaceRoot);
  if (!rawOutputPath.includes('{')) {
    outputPath = path.resolve(workspaceRoot, rawOutputPath);
  }
} else {
  // Convention fallback: Vite lib builds write to {projectRoot}/dist
  outputPath = path.join(projectRootAbs, 'dist');
}

invariant(
  existsSync(outputPath),
  `Build output not found at:\n  ${outputPath}\nRun "npm exec nx build ${name}" first.`,
);

// ---------------------------------------------------------------------------
// Read and transform the source package.json, write it into dist/
// ---------------------------------------------------------------------------

const sourcePkgPath = path.join(projectRootAbs, 'package.json');
invariant(existsSync(sourcePkgPath), `Source package.json not found at:\n  ${sourcePkgPath}`);

// Strip "./dist/" prefix from entry-point paths so they resolve correctly
// when npm publish runs from inside the dist/ directory.
const stripDistPrefix = (p) =>
  typeof p === 'string' && p.startsWith('./dist/') ? './' + p.slice(7) : p;

// Recursively rewrite all string values inside an exports map, and drop the
// "@epam/source" condition (an internal monorepo-only resolution hint).
const rewriteExportsObj = (obj) => {
  if (typeof obj === 'string') return stripDistPrefix(obj);
  if (Array.isArray(obj)) return obj.map(rewriteExportsObj);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([k]) => k !== '@epam/source')
        .map(([k, v]) => [k, rewriteExportsObj(v)]),
    );
  }
  return obj;
};

try {
  const json = JSON.parse(readFileSync(sourcePkgPath, 'utf-8'));

  if (development && !values.version) {
    version = getDevelopmentVersion(json.name, version);
    console.info(`Development version for ${json.name}: ${version}`);
  }

  // Accept #.#.#, #.#.#.N, #.#.#-pre.N, or the special token "dev".
  const validVersion = /^\d+\.\d+\.\d+(\.\d+|-[\w.]+)?$/;
  invariant(
    version && (validVersion.test(version) || version === 'dev'),
    `Version did not match Semantic Versioning.\nExpected: #.#.#  |  #.#.#.N  |  #.#.#-pre.N  |  dev\nGot: ${version}`,
  );

  // Set publish version
  json.version = version;

  // Remove "private" so npm allows publishing
  delete json.private;

  // Rewrite entry-point paths (main, module, types, exports)
  if (json.main) json.main = stripDistPrefix(json.main);
  if (json.module) json.module = stripDistPrefix(json.module);
  if (json.types) json.types = stripDistPrefix(json.types);
  if (json.exports) json.exports = rewriteExportsObj(json.exports);

  // Replace workspace-lib placeholders with the publish version
  const resolveDeps = (deps) => {
    if (!deps) return;
    for (const dep of Object.keys(deps)) {
      if (isWorkspaceLib(dep)) {
        deps[dep] = version;
      }
    }
  };
  resolveDeps(json.dependencies);
  resolveDeps(json.peerDependencies);

  // Remove dev-only nx configuration block — consumers don't need it
  delete json.nx;

  if (!dry) {
    try {
      execFileSync('npm', ['view', `${json.name}@${version}`, 'version'], {
        cwd: outputPath,
        stdio: 'ignore',
      });
      console.info(`${json.name}@${version} is already published, skipping.`);
      process.exit(0);
    } catch {
      // npm view exits non-zero when the version does not exist; publish below.
    }
  }

  const destPkgPath = path.join(outputPath, 'package.json');
  writeFileSync(destPkgPath, JSON.stringify(json, null, 2) + '\n');
  console.info(`Wrote publish-ready package.json → ${destPkgPath}`);
} catch (err) {
  console.error('Failed to prepare package.json for publishing:', err.message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Publish from the dist/ directory
// ---------------------------------------------------------------------------

const dryFlag = dry ? '--dry-run' : '';
const publishCmd = `npm publish --access public --tag ${tag} ${dryFlag}`.replace(/\s+/g, ' ').trim();

console.info(`\nRunning: ${publishCmd}\n  cwd: ${outputPath}\n`);
execSync(publishCmd, { cwd: outputPath, stdio: 'inherit' });
