/**
 * Shared helpers for the packed-package consumer fixtures (see README.md in
 * this folder and `openspec/changes/modularize-chat-hooks-package-exports/
 * design.md` D5). Each fixture installs the *packed* `@epam/ai-dial-chat-hooks`
 * tarball — never the monorepo's `@epam/source` condition — into its own
 * isolated `node_modules`, so `npm install`'s peer-dependency resolution and
 * the package's real `exports`/`sideEffects` manifest are exercised exactly
 * as an external consumer would experience them.
 *
 * No function here has a top-level side effect on import — safe to import
 * from `run.mjs` or a future test file.
 */

import { execFileSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

/*
 * Invoking npm through its JavaScript CLI keeps version ranges such as
 * `>=0.25.0 <1` out of a command shell. On Windows, `shell: true` would parse
 * `<`, `>` and `||` inside peer ranges as control operators, while spawning a
 * `.cmd` shim directly is rejected by current Node releases.
 */
const npmCliPath =
  process.env.npm_execpath ??
  path.join(
    path.dirname(process.execPath),
    'node_modules',
    'npm',
    'bin',
    'npm-cli.js',
  );
const execNpmSync = (args, options) =>
  execFileSync(process.execPath, [npmCliPath, ...args], options);

/**
 * `execFileSync`'s default `maxBuffer` (1 MB) is too small for a verbose
 * multi-error Vite/npm failure — a real build failure with dozens of errors,
 * each carrying a colorized code frame, comfortably exceeds it, and
 * `execFileSync` then throws *without* the process's real stdout/stderr on
 * the error object at all. That silently defeats `formatExecError` and any
 * substring check run against its result (the negative fixture's
 * `failureMustName` check included) — used on every `execFileSync` call in
 * this file whose output size depends on the fixture under test rather than
 * being small and fixed.
 */
const LARGE_OUTPUT_MAX_BUFFER = 64 * 1024 * 1024;

/**
 * `execFileSync`'s thrown error's own `.message` is just `Command failed:
 * <cmd>` — the actual diagnostic is in `.stdout`/`.stderr` (npm and Vite
 * both write their real error text to one or the other depending on the
 * failure). Prefer whichever is non-empty, falling back to `.message` only
 * if the process never produced output at all (e.g. failed to spawn).
 */
export const formatExecError = (err) =>
  String(err.stdout || err.stderr || err.message);

const listFiles = (root, relativeDir = '') =>
  readdirSync(path.join(root, relativeDir), { withFileTypes: true }).flatMap(
    (entry) => {
      const relativePath = path.posix.join(
        relativeDir.replace(/\\/g, '/'),
        entry.name,
      );
      return entry.isDirectory()
        ? listFiles(root, relativePath)
        : [relativePath];
    },
  );

/**
 * Runs `tools/publish-lib.mjs --dry=true` (writes the publish-ready
 * package.json into `dist/`, does not actually publish) and then `npm pack`
 * from inside `dist/`, producing a real tarball other npm installs can
 * consume. Returns the absolute tarball path.
 */
export const packChatHooks = ({
  workspaceRoot,
  chatHooksRoot,
  tmpRoot,
  version,
}) => {
  const distDir = path.join(chatHooksRoot, 'dist');
  if (!existsSync(distDir)) {
    throw new Error(
      `Build output not found at:\n  ${distDir}\nRun "npm exec nx build @epam/ai-dial-chat-hooks" first.`,
    );
  }

  execFileSync(
    'node',
    [
      'tools/publish-lib.mjs',
      '@epam/ai-dial-chat-hooks',
      `--version=${version}`,
      '--dry=true',
    ],
    { cwd: workspaceRoot, stdio: 'pipe' },
  );

  mkdirSync(tmpRoot, { recursive: true });
  const packOutput = execNpmSync(
    ['pack', '--json', '--pack-destination', tmpRoot],
    {
      cwd: distDir,
      encoding: 'utf8',
    },
  );
  const [packResult] = JSON.parse(packOutput);
  const publishedManifest = JSON.parse(
    readFileSync(path.join(distDir, 'package.json'), 'utf8'),
  );
  const packedFiles = new Set(
    packResult.files.map(({ path: filePath }) => filePath.replace(/\\/g, '/')),
  );

  const collectExportTargets = (value, targets = []) => {
    if (typeof value === 'string') {
      targets.push(value.replace(/^\.\//, ''));
      return targets;
    }
    if (Array.isArray(value)) {
      for (const item of value) collectExportTargets(item, targets);
      return targets;
    }
    if (value && typeof value === 'object') {
      for (const nested of Object.values(value)) {
        collectExportTargets(nested, targets);
      }
    }
    return targets;
  };

  const exportTargets = collectExportTargets(publishedManifest.exports);
  const missingExportTargets = exportTargets.filter(
    (target) => !packedFiles.has(target),
  );
  const missingDistFiles = listFiles(distDir).filter(
    (filePath) => !packedFiles.has(filePath),
  );
  if (missingExportTargets.length > 0 || missingDistFiles.length > 0) {
    throw new Error(
      [
        missingExportTargets.length > 0
          ? `Packed artifact is missing package.json#exports targets:\n${missingExportTargets
              .map((target) => `  ${target}`)
              .join('\n')}`
          : '',
        missingDistFiles.length > 0
          ? `Packed artifact is missing files emitted to dist/:\n${missingDistFiles
              .map((filePath) => `  ${filePath}`)
              .join('\n')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return {
    tarballPath: path.join(tmpRoot, packResult.filename),
    distDir,
    packedFiles,
    publishedManifest,
  };
};

const packagePath = (dir, packageName) =>
  path.join(dir, 'node_modules', ...packageName.split('/'));
const packageNameFromSpecifier = (specifier) =>
  specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0];

/**
 * Verifies the package-level optional-peer contract against both the
 * installed manifest and the actual minimal fixture's dependency tree.
 */
export const verifyMinimalPeerIsolation = (dir) => {
  const installedManifest = JSON.parse(
    readFileSync(
      path.join(packagePath(dir, '@epam/ai-dial-chat-hooks'), 'package.json'),
      'utf8',
    ),
  );
  const peerDependencies = installedManifest.peerDependencies ?? {};
  const peerDependenciesMeta = installedManifest.peerDependenciesMeta ?? {};
  const errors = [];

  for (const peer of Object.keys(peerDependencies)) {
    if (peer === 'react') continue;
    if (peerDependenciesMeta[peer]?.optional !== true) {
      errors.push(`${peer} is not optional in the installed manifest`);
    }
    if (existsSync(packagePath(dir, peer))) {
      errors.push(`${peer} was installed for the React-only minimal fixture`);
    }
  }
  if ('fflate' in peerDependencies || 'fflate' in peerDependenciesMeta) {
    errors.push('fflate is still declared as a peer');
  }

  return {
    success: errors.length === 0,
    output: errors.join('\n'),
  };
};

/**
 * Checks the package's own rolled-up declaration imports without typechecking
 * every peer package's declarations. Several UI peers still publish React-18
 * global-JSX or extensionless Monaco imports that fail under React 19 with
 * `moduleResolution: bundler`; those upstream declarations are outside this
 * package contract, while a missing direct type-only peer is not.
 */
export const verifyDeclarationImports = (dir, subpath) => {
  const packageDir = packagePath(dir, '@epam/ai-dial-chat-hooks');
  const declarationName = subpath === '.' ? 'index.d.ts' : `${subpath}.d.ts`;
  const source = readFileSync(path.join(packageDir, declarationName), 'utf8');
  const specifiers = new Set(
    [...source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g)]
      .map((match) => match[1])
      .filter(
        (specifier) =>
          !specifier.startsWith('.') && !specifier.startsWith('node:'),
      ),
  );
  const missing = [...specifiers].filter(
    (specifier) =>
      !existsSync(
        path.join(
          packagePath(dir, packageNameFromSpecifier(specifier)),
          'package.json',
        ),
      ),
  );
  return {
    success: missing.length === 0,
    output: missing.length
      ? `Rolled declaration imports missing packages: ${missing.join(', ')}`
      : '',
  };
};

const sideEffectPatternMatches = (pattern, filePath) => {
  const normalizedPattern = pattern.replace(/^\.\//, '');
  const escaped = normalizedPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replaceAll('*', '.*')}$`).test(filePath);
};

/**
 * Confirms every emitted JavaScript file that contains an audited module-scope
 * effect is covered by the published sideEffects patterns. Entry facades are
 * allowed carriers because a side-effect-only subpath import must retain the
 * facade before it can reach its shared chunk.
 */
export const verifySideEffectManifest = (
  { distDir, packedFiles, publishedManifest },
  markers,
) => {
  const patterns = publishedManifest.sideEffects ?? [];
  const markerFiles = new Set();
  const missingMarkers = [];

  for (const marker of markers) {
    let found = false;
    for (const filePath of packedFiles) {
      if (!filePath.endsWith('.js')) continue;
      const source = readFileSync(path.join(distDir, filePath), 'utf8');
      if (source.includes(marker)) {
        markerFiles.add(filePath);
        found = true;
      }
    }
    if (!found) missingMarkers.push(marker);
  }

  const uncovered = [...markerFiles].filter(
    (filePath) =>
      !patterns.some((pattern) => sideEffectPatternMatches(pattern, filePath)),
  );
  const unmatchedPatterns = patterns.filter(
    (pattern) =>
      ![...packedFiles].some((filePath) =>
        sideEffectPatternMatches(pattern, filePath),
      ),
  );
  return {
    success:
      uncovered.length === 0 &&
      missingMarkers.length === 0 &&
      unmatchedPatterns.length === 0,
    output:
      uncovered.length > 0
        ? `sideEffects does not cover: ${uncovered.join(', ')}`
        : missingMarkers.length > 0
          ? `audited side-effect markers not found: ${missingMarkers.join(', ')}`
          : unmatchedPatterns.length > 0
            ? `sideEffects patterns match no packed file: ${unmatchedPatterns.join(', ')}`
            : '',
  };
};

/**
 * Creates (and returns the path to) an isolated fixture directory under
 * `tmpRoot`. `tmpRoot` (see `run.mjs`) is deliberately outside this
 * repository — Node/Rollup/tsc module resolution walks *every* ancestor
 * directory looking for a `node_modules` that has the specifier it wants, so
 * a fixture nested anywhere inside this checkout would silently resolve an
 * "uninstalled" peer from the workspace's own root `node_modules` (which
 * really does have every peer installed, for `apps/chat`) instead of
 * failing the way an external consumer's install actually would. This isn't
 * hypothetical: it's exactly what made an early version of the negative
 * fixture (task 6.5) pass without the peer ever being installed.
 */
export const createFixtureDir = (tmpRoot, name) => {
  const dir = path.join(tmpRoot, 'fixtures', name);
  mkdirSync(dir, { recursive: true });
  return dir;
};

/**
 * Every `@epam/ai-dial-*` peer is installed off the `development` npm
 * dist-tag, not `latest`/`*`. This whole package family releases stable
 * ("latest") tags on independent cadences that are *not* kept mutually
 * compatible — e.g. `@epam/ai-dial-chat-shared@1.0.6`'s own published peer
 * range on `@epam/ai-dial-ui-kit` is `^0.14.0-dev.15`, a range `ui-kit`'s
 * `latest` (`0.13.0`) never satisfies. The `development` tag is the one
 * mutually-compatible set across the family — confirmed by this workspace's
 * own two directly-published (non-workspace-symlinked) peers,
 * `@epam/ai-dial-react-file-manager` and `@epam/ai-dial-ui-kit`, both pinned
 * in the root `package.json` to a `-dev.N` prerelease of that same set.
 */
const EPAM_PEER_VERSION_SPEC = 'development';

/**
 * The publish transform pins workspace-library peers to the package version
 * being packed. Use the currently published coordinated development version
 * so npm's normal peer resolver can validate the tarball against the
 * `@epam/ai-dial-* @development` packages installed by the fixtures.
 */
export const resolveFixturePublishVersion = (packageName) => {
  const stdout = execNpmSync(
    ['view', `${packageName}@${EPAM_PEER_VERSION_SPEC}`, 'version', '--json'],
    { encoding: 'utf8' },
  ).trim();
  const parsed = JSON.parse(stdout);
  const version = Array.isArray(parsed) ? parsed.at(-1) : parsed;
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(
      `Could not resolve ${packageName}@${EPAM_PEER_VERSION_SPEC} version.`,
    );
  }
  return version;
};

/*
 * Only the `@epam/ai-dial-*` family shares the `development`-dist-tag
 * convention (see the comment above). Other `@epam/*` scoped packages this
 * closure can reach — e.g. `@epam/pdf-highlighter-kit`, a peer of
 * `@epam/ai-dial-quotations` — are ordinary third-party packages from this
 * fixture harness's point of view and don't publish that tag at all.
 */
const isEpamAiDialPeer = (name) => name.startsWith('@epam/ai-dial-');

const IGNORED_TRANSITIVE_PEERS = new Set([
  'react',
  'react-dom',
  'react/jsx-runtime',
]);

/**
 * `npm view <nameAndSpec> peerDependencies --json`, memoized per exact
 * `name@spec` string for the lifetime of this module (i.e. shared across
 * every fixture in one `run.mjs` invocation — most fixtures share most of
 * the family's packages, so this keeps the number of registry round trips
 * closer to "one per distinct package" than "one per fixture").
 *
 * `<spec>` is a range (a third-party peer's declared range, e.g. `^3.0.0`),
 * not always one resolved version — when more than one published version
 * matches, `npm view` returns an *array* of that field, one entry per
 * matching version, ordered oldest to newest; this takes the newest (last)
 * entry rather than naively `Object.entries`-ing the array itself (which
 * silently produces bogus numeric-index "dependency names").
 */
const peerDependenciesCache = new Map();
const fetchPeerDependencies = (nameAndSpec) => {
  if (peerDependenciesCache.has(nameAndSpec))
    return peerDependenciesCache.get(nameAndSpec);
  const stdout = execNpmSync(
    ['view', nameAndSpec, 'peerDependencies', '--json'],
    {
      encoding: 'utf8',
    },
  ).trim();
  const parsed = stdout ? JSON.parse(stdout) : {};
  const peerDeps = Array.isArray(parsed) ? (parsed.at(-1) ?? {}) : parsed;
  peerDependenciesCache.set(nameAndSpec, peerDeps);
  return peerDeps;
};

/**
 * Resolves the full transitive peerDependencies closure of `directPeers` —
 * not just `@epam/ai-dial-chat-hooks`'s own documented peers, but *their*
 * peers, recursively. Modern npm may auto-install peer dependencies, but the
 * fixtures declare the closure explicitly so npm resolves one deterministic,
 * mutually compatible set. Thus
 * `@epam/ai-dial-quotations` needing `@tabler/icons-react`, or
 * `@epam/ai-dial-chat-shared` needing `@epam/ai-dial-ui-kit`, are exactly as
 * mandatory as chat-hooks' own documented peers — omitting them from a
 * fixture doesn't test "chat-hooks' peer list is sufficient," it just
 * produces a build that fails on an unrelated, undocumented specifier.
 *
 * Every `@epam/ai-dial-*` package in the closure is pinned to the
 * `development` tag (see above); every other (third-party) package keeps
 * whichever version range the first peer that requires it declared — this
 * package family is not (yet) known to have two peers disagreeing on a
 * third-party range, so "first wins" is an acceptable simplification, not a
 * general-purpose resolver.
 *
 * Returns a plain `{ name: versionSpec }` object suitable for a
 * package.json `dependencies` field.
 */
export const resolvePeerClosure = (directPeers) => {
  const closure = {};
  const queue = directPeers.map((name) => ({ name, range: undefined }));
  const queued = new Set(directPeers);

  while (queue.length > 0) {
    const { name, range } = queue.shift();
    if (name in closure) continue;

    const versionSpec = isEpamAiDialPeer(name)
      ? EPAM_PEER_VERSION_SPEC
      : range || 'latest';
    closure[name] = versionSpec;

    const peerDeps = fetchPeerDependencies(`${name}@${versionSpec}`);
    for (const [depName, depRange] of Object.entries(peerDeps)) {
      if (
        IGNORED_TRANSITIVE_PEERS.has(depName) ||
        depName in closure ||
        queued.has(depName)
      ) {
        continue;
      }
      queued.add(depName);
      queue.push({ name: depName, range: depRange });
    }
  }

  return closure;
};

/**
 * Writes the fixture's own package.json declaring the packed tarball (via a
 * `file:` URL — Windows-safe, unlike a raw drive-letter path string), plus
 * `react`, its consumer-owned TypeScript declarations, and the full
 * transitive peerDependencies closure (see
 * `resolvePeerClosure`) of whichever direct peers this fixture documents.
 */
export const writeFixturePackageJson = (
  dir,
  { name, tarballPath, reactRange, reactTypesRange, peers },
) => {
  const dependencies = {
    react: reactRange,
    '@types/react': reactTypesRange,
    ...resolvePeerClosure(peers),
  };
  dependencies['@epam/ai-dial-chat-hooks'] = pathToFileURL(tarballPath).href;

  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      { name, private: true, type: 'module', dependencies },
      null,
      2,
    ) + '\n',
  );
};

/**
 * `npm install`s the fixture directory. Being outside this repo checkout
 * (see `createFixtureDir`) and having its own package.json with no
 * `workspaces` field, npm treats it as a standalone project with its own
 * `node_modules` — exactly the isolation the fixtures need.
 *
 * The install intentionally uses npm's normal peer-dependency handling. A
 * `--legacy-peer-deps` escape hatch would make the fixture pass even if a
 * feature peer accidentally stopped being optional, defeating the contract
 * this suite exists to verify.
 */
const npmInstallOnce = (dir) => {
  const output = execNpmSync(
    ['install', '--no-audit', '--no-fund', '--loglevel=error'],
    {
      cwd: dir,
      encoding: 'utf8',
      maxBuffer: LARGE_OUTPUT_MAX_BUFFER,
    },
  );
  const fixtureManifest = JSON.parse(
    readFileSync(path.join(dir, 'package.json'), 'utf8'),
  );
  const missingDependencies = Object.keys(fixtureManifest.dependencies).filter(
    (dependency) =>
      !existsSync(path.join(packagePath(dir, dependency), 'package.json')),
  );
  if (missingDependencies.length > 0) {
    throw new Error(
      `npm install returned success with incomplete packages: ${missingDependencies.join(', ')}`,
    );
  }
  return output;
};

/**
 * Retries once on failure. A registry install this size (a full peer
 * closure, potentially dozens of packages) occasionally hits a transient
 * network/registry hiccup that a second attempt clears — this is about
 * flakiness tolerance, not masking a real resolution failure (which fails
 * identically on both attempts and still surfaces via `formatExecError`).
 */
export const npmInstallFixture = (dir) => {
  try {
    return npmInstallOnce(dir);
  } catch {
    /*
     * npm can leave a partially populated tree after a transient failure.
     * Retrying against that tree is prone to Windows ENOTEMPTY races, so the
     * second attempt starts from the same clean state as the first.
     */
    rmSync(path.join(dir, 'node_modules'), {
      recursive: true,
      force: true,
      maxRetries: 3,
    });
    rmSync(path.join(dir, 'package-lock.json'), { force: true });
    return npmInstallOnce(dir);
  }
};

/**
 * Writes a minimal TypeScript consumer file that re-exports every named
 * export of the given subpath (`export * from '<specifier>'`), without
 * requiring per-hook call-site knowledge (some exports are hooks that need a
 * render context, others are plain types; a blanket re-export exercises both
 * uniformly).
 *
 * This must be `export * from`, not `import * as mod from '...'; export
 * default mod`: a bundler treats an entry's own `export * from` names as its
 * public API and never tree-shakes them, matching how the real
 * `entry-points/*.ts` barrels this fixture is standing in for are written.
 * The default-export-a-namespace-object form was tried first and silently
 * defeated the point of every fixture here — Rollup/Rolldown, honoring this
 * package's now-accurate `sideEffects` metadata, tree-shook the *entire*
 * unused namespace object (imports and all) out of the bundle, so even the
 * negative fixture (deliberately missing a required peer) "succeeded": the
 * import requiring that peer was never actually reached.
 */
export const writeEntryFile = (dir, subpath) => {
  const specifier =
    subpath === '.'
      ? '@epam/ai-dial-chat-hooks'
      : `@epam/ai-dial-chat-hooks/${subpath}`;
  writeFileSync(path.join(dir, 'entry.ts'), `export * from '${specifier}';\n`);
};

/** Writes a consumer entry that imports a subpath only for its module effects. */
export const writeSideEffectEntryFile = (dir, subpath) => {
  const specifier = `@epam/ai-dial-chat-hooks/${subpath}`;
  writeFileSync(path.join(dir, 'entry.ts'), `import '${specifier}';\n`);
};

/*
 * Some peer declarations still use React 18's global JSX namespace, while
 * the fixtures deliberately install React 19. Bridge that upstream spelling
 * to React 19's scoped namespace so `skipLibCheck` can remain disabled.
 */
const writeReactJsxCompatibility = (dir) => {
  writeFileSync(
    path.join(dir, 'react-jsx-compat.d.ts'),
    `import type { JSX as ReactJSX } from 'react';

declare global {
  namespace JSX {
    type ElementType = ReactJSX.ElementType;
    interface Element extends ReactJSX.Element {}
    interface ElementClass extends ReactJSX.ElementClass {}
    interface ElementAttributesProperty extends ReactJSX.ElementAttributesProperty {}
    interface ElementChildrenAttribute extends ReactJSX.ElementChildrenAttribute {}
    type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>;
    interface IntrinsicAttributes extends ReactJSX.IntrinsicAttributes {}
    interface IntrinsicClassAttributes<T> extends ReactJSX.IntrinsicClassAttributes<T> {}
    interface IntrinsicElements extends ReactJSX.IntrinsicElements {}
  }
}

export {};
`,
  );
};

/* Vite consumers can import peer-owned style declarations during typecheck. */
const writeAssetModuleDeclarations = (dir) => {
  writeFileSync(
    path.join(dir, 'asset-modules.d.ts'),
    `declare module '*.css';
declare module '*.less';
declare module '*.scss';
`,
  );
};

/*
 * The currently published catalog declarations contain a monorepo-relative
 * import (`../../../publish-panel/src/index.ts`) instead of the published
 * `@epam/ai-dial-publish-panel` specifier. Recreate only that missing bridge
 * inside the isolated consumer; the real peer must still be installed.
 */
const writePublishedPeerCompatibility = (dir) => {
  if (
    !existsSync(packagePath(dir, '@epam/ai-dial-catalog')) ||
    !existsSync(packagePath(dir, '@epam/ai-dial-publish-panel'))
  ) {
    return;
  }

  const publishPanelSourceDir = path.join(
    dir,
    'node_modules',
    'publish-panel',
    'src',
  );
  mkdirSync(publishPanelSourceDir, { recursive: true });
  writeFileSync(
    path.join(publishPanelSourceDir, 'index.ts'),
    `export * from '@epam/ai-dial-publish-panel';\n`,
  );
};

/** Runs `tsc --noEmit` against the fixture's entry file. Returns `{ success, output }`. */
export const typecheckFixture = (workspaceRoot, dir) => {
  writeReactJsxCompatibility(dir);
  writeAssetModuleDeclarations(dir);
  writePublishedPeerCompatibility(dir);
  writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          types: [],
          paths: {
            'monaco-editor/esm/vs/editor/editor.api': [
              './node_modules/monaco-editor/esm/vs/editor/editor.api.d.ts',
            ],
          },
        },
        include: ['entry.ts', 'asset-modules.d.ts', 'react-jsx-compat.d.ts'],
      },
      null,
      2,
    ) + '\n',
  );

  try {
    const tscCli = path.join(
      workspaceRoot,
      'node_modules',
      'typescript',
      'bin',
      'tsc',
    );
    const output = execFileSync(
      process.execPath,
      [tscCli, '--noEmit', '-p', 'tsconfig.json'],
      {
        cwd: dir,
        encoding: 'utf8',
        maxBuffer: LARGE_OUTPUT_MAX_BUFFER,
      },
    );
    return { success: true, output };
  } catch (err) {
    return { success: false, output: formatExecError(err) };
  }
};

/**
 * Bundles the fixture's entry file with Vite's library mode (the same
 * bundler every real consumer in this workspace uses) and returns
 * `{ success, output, bundlePath }`. `react`/`react-dom`/`react/jsx-runtime`
 * are always externalized, matching how a real host app treats them.
 *
 * Vite (not a bare Rollup/Rolldown CLI invocation) is required here because
 * some peers' compiled output imports CSS at module scope (e.g. a markdown
 * renderer's stylesheet reachable from the root entry) — only Vite's own
 * CSS-handling plugin, not the standalone `rolldown` binary, understands
 * that import.
 */
export const bundleFixture = (
  workspaceRoot,
  dir,
  { outDir = 'dist-check' } = {},
) => {
  /*
   * Fixture directories live outside this repo (see createFixtureDir), so
   * plain `import 'vite'` would fail — nothing in the fixture's own
   * ancestor chain has a node_modules with `vite` installed (that is
   * exactly the isolation this harness needs from the *package under
   * test*'s peers, but `vite.config.mjs` still needs to load the actual
   * `vite` module to call `defineConfig`). An absolute `file:` URL loads it
   * directly from this workspace's own install, bypassing ancestor lookup
   * for this one import only — the fixture's own dependencies still resolve
   * from its own (isolated) node_modules exactly as before.
   */
  const viteEntryUrl = pathToFileURL(
    path.join(
      workspaceRoot,
      'node_modules',
      'vite',
      'dist',
      'node',
      'index.js',
    ),
  ).href;
  writeFileSync(
    path.join(dir, 'vite.config.mjs'),
    [
      `import { defineConfig } from '${viteEntryUrl}';`,
      '',
      'export default defineConfig({',
      '  build: {',
      `    outDir: '${outDir}',`,
      '    emptyOutDir: true,',
      "    lib: { entry: 'entry.ts', formats: ['es'], fileName: () => 'out.js' },",
      "    rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime'] },",
      '  },',
      "  logLevel: 'warn',",
      '});',
      '',
    ].join('\n'),
  );

  const bundlePath = path.join(dir, outDir, 'out.js');
  try {
    const viteCli = path.join(
      workspaceRoot,
      'node_modules',
      'vite',
      'bin',
      'vite.js',
    );
    const output = execFileSync(
      process.execPath,
      [
        viteCli,
        'build',
        '--config',
        'vite.config.mjs',
        '--configLoader',
        'native',
      ],
      {
        cwd: dir,
        encoding: 'utf8',
        maxBuffer: LARGE_OUTPUT_MAX_BUFFER,
      },
    );
    return { success: true, output, bundlePath };
  } catch (err) {
    return { success: false, output: formatExecError(err), bundlePath };
  }
};

/** Reads the emitted production bundle's source, for content assertions (task 6.6). */
export const readBundle = (bundlePath) => readFileSync(bundlePath, 'utf8');

/** Best-effort recursive delete — Windows can transiently lock files a just-exited child held open. */
export const cleanupDir = (dir) => {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    // Leaving a stale .tmp fixture dir behind is harmless; it's re-created (and
    // its contents overwritten) on the next run.
  }
};
