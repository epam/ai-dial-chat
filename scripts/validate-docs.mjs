#!/usr/bin/env node
//
// Validates the hand-written documentation that nothing else checks:
// the root README, the app READMEs, every lib README, and docs/**.
//
// These files go stale silently — no build breaks when a README documents a
// component that was renamed two releases ago, or links to a doc that was
// deleted. Every check here corresponds to a drift class that actually reached
// the main line:
//
//   1. README coverage/identity — a lib without a README, or whose H1 names a
//      package it no longer is (`@epam/chat-api-client` after the rename).
//   2. Package metadata — the `description` / `license` fields `.claude/rules/libs.md`
//      requires but nothing enforced.
//   3. Unresolvable stylesheet exports — nine libs shipped
//      `"./styles.css": "./dist/style.css"` while Vite emits `index.css`, and
//      no in-repo consumer noticed because they all alias to `src/index.ts`.
//   4. A package declared a dependency by one lib and a required peer by
//      another — `@epam/ai-dial-ui-kit` was, and hosts needed a `resolutions`
//      pin to collapse the two copies npm installed.
//   5. A shipped version spec with no upper bound — it accepts the next
//      breaking major, so `@epam/ai-dial-ui-kit: "*"` in 11 libs and
//      `@epam/pdf-highlighter-kit: ">=0.0.14"` constrained nothing at all.
//   6. One external package declared at two different ranges — the host
//      installs one copy either way, so `@epam/ai-dial-ui-kit` sat at
//      `^0.14.0-dev.15`, `-dev.30` and `-dev.37` at once, each lib pinning
//      whatever the kit was when it was scaffolded.
//   7. Test tooling on a host's install list — `chat-shared` published
//      `vitest: "~4.1.0"` as a required peer, so embedding a chat column
//      asked the host to install a test runner.
//   8. A `peerDependenciesMeta` key with no matching peer — npm ignores it, so
//      `@mcp-ui/client` read as a deliberate optional peer of `chat-hooks`
//      while being declared nowhere and imported regardless.
//   9. A README citing a range its manifest no longer declares — that number is
//      what a host copies, and `chat-hooks` advertised
//      `@epam/pdf-highlighter-kit ^0.0.18` and `react-file-manager ^0.2.0-dev.10`
//      after both manifests had moved on.
//  10. Broken relative links — every link to a file that no longer exists
//      (`docs/environment-variables-migration-guide.md` after its removal).
//  11. Phantom exports — a name a lib README imports from its own package that
//      the package does not export (`EntityBadge`, `StageType`, `QrPlaceholder`,
//      `ConversationGroupProps`).
//
// Usage:
//   node scripts/validate-docs.mjs          # validate everything
//   node scripts/validate-docs.mjs <file>…  # validate specific markdown files
//
// Exit 0 = clean. Exit 1 = problems listed on stderr.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

const REQUIRED_LICENSE = 'Apache-2.0';

/*
 * Link targets that are illustrative patterns rather than real paths — prose
 * like "embed with ![alt](./auth-diagrams/NN-name.svg)". Matched literally.
 */
const LINK_PLACEHOLDERS = [/\bNN-/, /<[^>]+>/, /\{[^}]+\}/, /\bXX\b/];

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.nx',
  'coverage',
  'dist',
  'node_modules',
  'out-tsc',
  'tmp',
]);

const listMarkdown = (directory) => {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) return [];

    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return listMarkdown(path);
    return extname(path) === '.md' ? [path] : [];
  });
};

const projectDirs = (parent) =>
  existsSync(parent)
    ? readdirSync(parent, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !IGNORED_DIRECTORIES.has(e.name))
        .map((e) => `${parent}/${e.name}`)
    : [];

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
};

const allDocFiles = () => [
  ...['README.md'].filter(existsSync),
  ...[...projectDirs('apps'), ...projectDirs('libs')]
    .map((d) => `${d}/README.md`)
    .filter(existsSync),
  ...listMarkdown('docs'),
];

/* ── 1. Every publishable project has a README whose H1 names the package ── */

const checkReadmeCoverage = () => {
  for (const dir of [...projectDirs('apps'), ...projectDirs('libs')]) {
    const pkg = readJson(`${dir}/package.json`);
    /* No package.json means it is not a project — e.g. libs/ai-dial-kit leftovers. */
    if (!pkg?.name) continue;

    const readme = `${dir}/README.md`;
    if (!existsSync(readme)) {
      fail(readme, 'missing README.md (required for every app and lib)');
      continue;
    }

    if (!dir.startsWith('libs/')) continue;

    const h1 = readFileSync(readme, 'utf8').match(/^#\s+(.+?)\s*$/m)?.[1];
    if (h1 !== pkg.name) {
      fail(
        readme,
        `H1 is "${h1 ?? '(none)'}" but package.json name is "${pkg.name}" — the heading must be the package name`,
      );
    }
  }
};

/* ── 2. Lib package.json carries the metadata the docs rules require ── */

const checkLibPackageMetadata = () => {
  for (const dir of projectDirs('libs')) {
    const path = `${dir}/package.json`;
    const pkg = readJson(path);
    if (!pkg?.name) continue;

    if (!pkg.description?.trim()) {
      fail(path, 'missing "description" (see .claude/rules/libs.md)');
    } else if (pkg.description.trim() === pkg.name) {
      fail(
        path,
        '"description" repeats the package name instead of describing it',
      );
    }

    if (pkg.license !== REQUIRED_LICENSE) {
      fail(
        path,
        `"license" must be "${REQUIRED_LICENSE}", found "${pkg.license ?? '(none)'}"`,
      );
    }
  }
};

/* ── 3. A publishable lib's stylesheet export matches what the build emits ── */

/*
 * Nothing in this workspace resolves a lib through its own exports map — every
 * in-repo consumer aliases the bare specifier to src/index.ts — and npm
 * publishes an exports map without checking that any of it resolves. So a
 * stylesheet export naming a file the build never emits is invisible here and
 * broken in every downstream host: nine libs shipped
 * "./styles.css": "./dist/style.css" while Vite emits index.css.
 *
 * This runs on source alone (no dist required), so it gates a PR. The
 * build-output equivalent lives in tools/publish-lib.mjs and gates a release.
 */
const STYLES_EXPORT_KEY = './styles.css';
const STYLES_EXPORT_TARGET = './dist/index.css';

const isPublishable = (pkg) => (pkg?.nx?.tags ?? []).includes('publishable');

const hasStylesheet = (directory) => {
  if (!existsSync(directory)) return false;

  return readdirSync(directory, { withFileTypes: true }).some((entry) => {
    if (entry.isDirectory()) {
      return (
        !IGNORED_DIRECTORIES.has(entry.name) &&
        hasStylesheet(`${directory}/${entry.name}`)
      );
    }
    return ['.css', '.scss'].includes(extname(entry.name));
  });
};

/*
 * A lib also emits dist/index.css when it has no stylesheet of its own: the
 * build appends the Tailwind utilities its components reference, so that
 * `import '@epam/<pkg>/styles.css'` carries their layout into a host that does
 * not compile Tailwind over node_modules (see tools/vite-lib-tailwind-utilities.mjs).
 */
const hasComponentSource = (directory) => {
  if (!existsSync(directory)) return false;

  return readdirSync(directory, { withFileTypes: true }).some((entry) => {
    if (entry.isDirectory()) {
      return (
        !IGNORED_DIRECTORIES.has(entry.name) &&
        entry.name !== 'tests' &&
        hasComponentSource(`${directory}/${entry.name}`)
      );
    }
    return (
      extname(entry.name) === '.tsx' && !/\.(spec|test)\.tsx$/.test(entry.name)
    );
  });
};

const checkLibStylesExport = () => {
  for (const dir of projectDirs('libs')) {
    const path = `${dir}/package.json`;
    const pkg = readJson(path);
    if (!pkg?.name || !isPublishable(pkg)) continue;

    const exports = pkg.exports ?? {};
    const cssKeys = Object.keys(exports).filter((key) => key.endsWith('.css'));
    const shipsStyles =
      hasStylesheet(`${dir}/src`) || hasComponentSource(`${dir}/src`);

    if (!shipsStyles) {
      /*
       * A lib with neither a stylesheet nor a component emits no CSS at all,
       * so any CSS export it declares points at a file that will not be there.
       */
      for (const key of cssKeys) {
        fail(
          path,
          `exports "${key}" but src/ holds neither a stylesheet nor a component — the build emits no stylesheet for this lib`,
        );
      }
      continue;
    }

    if (cssKeys.length === 0) {
      fail(
        path,
        `emits a stylesheet but declares no "${STYLES_EXPORT_KEY}" export — hosts cannot import its CSS (see .claude/rules/libs.md)`,
      );
      continue;
    }

    for (const key of cssKeys) {
      if (key !== STYLES_EXPORT_KEY) {
        fail(
          path,
          `exports the stylesheet as "${key}" — every lib must use "${STYLES_EXPORT_KEY}" so hosts have one pattern`,
        );
      } else if (exports[key] !== STYLES_EXPORT_TARGET) {
        fail(
          path,
          `"${key}" points at "${exports[key]}" but Vite lib builds emit "${STYLES_EXPORT_TARGET}" (build.lib.fileName is 'index' — there is no style.css)`,
        );
      }
    }
  }
};

/* ── 4. One package, one role across every publishable lib ── */

/*
 * A package declared a `dependency` by one lib and a required peer by another
 * lets npm install a second, divergent copy beside the host's own, and the
 * host's only fix is a `resolutions` pin. That is not hypothetical:
 * `conversation-panel` was the lone lib with `@epam/ai-dial-ui-kit` in
 * `dependencies` while 26 peered it, and every embedding host had to pin the
 * kit to collapse the copies.
 *
 * Optional peers are deliberately excluded from the comparison — `chat-hooks`
 * and `chat-shared` use them to scope installs per entry point, so a feature
 * package being an optional peer there and a dependency of the lib that
 * actually composes it is the intended shape, not a conflict.
 */
const checkDependencyRoleConsistency = () => {
  const asDependency = new Map();
  const asRequiredPeer = new Map();

  const record = (map, name, lib) => {
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(lib);
  };

  for (const dir of projectDirs('libs')) {
    const pkg = readJson(`${dir}/package.json`);
    if (!pkg?.name || !isPublishable(pkg)) continue;

    const meta = pkg.peerDependenciesMeta ?? {};
    for (const name of Object.keys(pkg.dependencies ?? {})) {
      record(asDependency, name, pkg.name);
    }
    for (const name of Object.keys(pkg.peerDependencies ?? {})) {
      if (meta[name]?.optional) continue;
      if (name === 'react' || name === 'react-dom') continue;
      record(asRequiredPeer, name, pkg.name);
    }
  }

  for (const [name, dependents] of asDependency) {
    const peers = asRequiredPeer.get(name);
    if (!peers) continue;

    fail(
      `libs/*/package.json`,
      `"${name}" is a dependency of ${dependents.join(', ')} but a required peer of ${peers.join(', ')} — ` +
        'npm may then install two divergent copies and hosts need a "resolutions" pin. ' +
        'Pick one role for the package (see .claude/rules/libs.md)',
    );
  }
};

/* ── 5. No published lib ships a version spec without an upper bound ── */

/*
 * A spec with no upper bound accepts the next breaking major, so it constrains
 * nothing that matters — npm will not warn, and the host discovers the
 * mismatch at runtime. `"*"` is the obvious form; `">=0.0.14"` is the same
 * defect written longhand, which is how `@epam/pdf-highlighter-kit` sat in
 * `chat-hooks` while every lib that actually used it wanted `^0.0.18`.
 *
 * A sibling under `libs/` is exempt: `tools/publish-lib.mjs` rewrites
 * workspace-lib specs to the release version, so such a placeholder is never
 * what reaches npm. Everything else ships exactly as written.
 */
const UNBOUNDED_RANGE = /^\s*(\*|x|latest|>=?[^<]*)$/i;

const checkNoUnboundedVersions = () => {
  const workspacePackages = new Set(
    projectDirs('libs')
      .map((dir) => readJson(`${dir}/package.json`)?.name)
      .filter(Boolean),
  );

  for (const dir of projectDirs('libs')) {
    const path = `${dir}/package.json`;
    const pkg = readJson(path);
    if (!pkg?.name || !isPublishable(pkg)) continue;

    for (const field of ['dependencies', 'peerDependencies']) {
      for (const [name, range] of Object.entries(pkg[field] ?? {})) {
        if (workspacePackages.has(name)) continue;
        if (range !== '' && !UNBOUNDED_RANGE.test(range)) continue;

        fail(
          path,
          `"${field}.${name}" is "${range}", which has no upper bound and so accepts the next breaking major — ` +
            'declare the range this lib is actually built against (see .claude/rules/libs.md)',
        );
      }
    }
  }
};

/* ── 6. One external package, one version range across every lib ── */

/*
 * A host ends up with one copy of a third-party package however many libs name
 * it, so two libs naming it at different ranges either agree by luck or push
 * the host back to a "resolutions" pin — the same defect as a split role
 * (check 4), written in version specs instead. `@epam/ai-dial-ui-kit` was
 * declared at `^0.14.0-dev.15`, `^0.14.0-dev.30` and `^0.14.0-dev.37`
 * simultaneously, and `react` at `^19.0.0`, `^19.2.6` and `^19.2.7`: in both
 * cases the range was whatever the newest lib happened to be scaffolded
 * against, not a statement about what the lib needs.
 *
 * A sibling under `libs/` is exempt for the same reason as check 5 — its spec
 * is a placeholder `tools/publish-lib.mjs` rewrites to the release version.
 */
const checkConsistentExternalRanges = () => {
  const workspacePackages = new Set(
    projectDirs('libs')
      .map((dir) => readJson(`${dir}/package.json`)?.name)
      .filter(Boolean),
  );

  /* package name -> range -> the libs declaring it at that range */
  const declarations = new Map();

  for (const dir of projectDirs('libs')) {
    const pkg = readJson(`${dir}/package.json`);
    if (!pkg?.name || !isPublishable(pkg)) continue;

    for (const field of ['dependencies', 'peerDependencies']) {
      for (const [name, range] of Object.entries(pkg[field] ?? {})) {
        if (workspacePackages.has(name)) continue;

        const byRange = declarations.get(name) ?? new Map();
        byRange.set(range, [...(byRange.get(range) ?? []), dir]);
        declarations.set(name, byRange);
      }
    }
  }

  for (const [name, byRange] of declarations) {
    if (byRange.size < 2) continue;

    const spread = [...byRange]
      .map(([range, dirs]) => `"${range}" in ${dirs.join(', ')}`)
      .join('; ');

    fail(
      'libs/*/package.json',
      `"${name}" is declared at ${byRange.size} different ranges — ${spread}. ` +
        'A host installs one copy whatever the libs ask for, so pick the single ' +
        'range every lib is built against (see .claude/rules/libs.md)',
    );
  }
};

/* ── 7. No test tooling ships in a published lib's manifest ── */

/*
 * `dependencies` and `peerDependencies` are the host's install list: a runner
 * named there is either installed into every consuming application or warned
 * about on every install. `chat-shared` published `vitest: "~4.1.0"` as a
 * required peer, so an embedding host was told it had to install a test runner
 * to render a chat column (issue #8719).
 *
 * Test tooling belongs in `devDependencies`, which never reaches a consumer's
 * tree.
 */
const TEST_TOOLING = [
  /^vitest$/,
  /^@vitest\//,
  /^jest$/,
  /^ts-jest$/,
  /^jest-environment-/,
  /^@testing-library\//,
  /^@playwright\/test$/,
  /^playwright(-core)?$/,
  /^(jsdom|happy-dom)$/,
  /^(mocha|chai|sinon|enzyme|karma)$/,
  /^@types\/(jest|mocha|chai|sinon)$/,
];

const checkNoTestToolingInManifest = () => {
  for (const dir of projectDirs('libs')) {
    const manifest = `${dir}/package.json`;
    const pkg = readJson(manifest);
    if (!pkg?.name || !isPublishable(pkg)) continue;

    for (const field of ['dependencies', 'peerDependencies']) {
      for (const name of Object.keys(pkg[field] ?? {})) {
        if (!TEST_TOOLING.some((pattern) => pattern.test(name))) continue;

        fail(
          manifest,
          `"${field}" declares the test tool "${name}", which puts a runner on ` +
            'the install list of every consuming host — move it to "devDependencies" ' +
            '(see .claude/rules/libs.md)',
        );
      }
    }
  }
};

/* ── 8. Every peerDependenciesMeta key names a declared peer ── */

/*
 * `peerDependenciesMeta` only annotates `peerDependencies`; a key with no
 * matching peer is metadata npm silently ignores. It reads as a deliberate
 * "optional" while declaring nothing, so the package the lib actually imports
 * ends up on no install list at all — `chat-hooks` marked `@mcp-ui/client`
 * optional in the meta block without ever listing it as a peer, and its code
 * imported it regardless (issue #8719).
 *
 * Either declare the peer (marking it optional when an entry point can do
 * without it) or move it to `dependencies` — never leave a meta-only orphan.
 */
const checkPeerMetaMatchesPeers = () => {
  for (const dir of projectDirs('libs')) {
    const manifest = `${dir}/package.json`;
    const pkg = readJson(manifest);
    if (!pkg?.name || !isPublishable(pkg)) continue;

    const peers = pkg.peerDependencies ?? {};
    for (const name of Object.keys(pkg.peerDependenciesMeta ?? {})) {
      if (name in peers) continue;

      fail(
        manifest,
        `"peerDependenciesMeta.${name}" annotates a peer that "peerDependencies" ` +
          'does not declare, so npm ignores it and nothing installs the package. ' +
          'Declare the peer or make it a dependency (see .claude/rules/libs.md)',
      );
    }
  }
};

/* ── 9. A lib README cites the ranges its own manifest declares ── */

/*
 * The range printed in a README is the number a host copies into its manifest,
 * so a stale one is worse than none at all. Only a version written next to the
 * package name — `\`pkg\` ^1.2.3`, `\`pkg\` (\`^1.2.3\`)`, or `"pkg": "^1.2.3"`
 * in an install snippet — is checked. Prose that names no package ("requires
 * UI Kit ^0.14.2 or later") is left to the author, and a bare package name with
 * no version cited is fine: nothing to drift.
 */
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* A dotted version, so prose like `\`pkg\` 2 components` is not read as one. */
const CITED_VERSION = String.raw`["\`]?([~^><=]*\d+(?:\.\d+)+[\w.\-+]*)["\`]?`;

const checkReadmeVersionCitations = (src, file, libDir) => {
  const pkg = readJson(`${libDir}/package.json`);
  if (!pkg?.name) return;

  const declared = { ...pkg.dependencies, ...pkg.peerDependencies };

  for (const [name, range] of Object.entries(declared)) {
    const cited = new RegExp(
      String.raw`["\`]` +
        escapeRegExp(name) +
        String.raw`["\`]\s*:?\s*\(?\s*` +
        CITED_VERSION,
      'g',
    );

    for (const match of src.matchAll(cited)) {
      if (match[1] === range) continue;

      fail(
        file,
        `line ${lineAt(src, match.index)}: cites "${name}" as ${match[1]}, but ` +
          `${libDir}/package.json declares ${range} — a README must quote the ` +
          'manifest range verbatim (see .claude/rules/libs.md)',
      );
    }
  }
};

/* ── 10. Relative markdown links resolve ── */

const isPlaceholderLink = (target) =>
  LINK_PLACEHOLDERS.some((pattern) => pattern.test(target));

const checkLinks = (src, file) => {
  const dir = dirname(file);

  for (const match of src.matchAll(/\]\(([^)\s]+?)(?:\s+"[^"]*")?\)/g)) {
    const raw = match[1];
    if (/^(?:https?:|mailto:|tel:|#)/.test(raw)) continue;

    const target = raw.split('#')[0];
    if (!target || isPlaceholderLink(target)) continue;

    if (!existsSync(resolve(dir, target))) {
      fail(file, `broken link at line ${lineAt(src, match.index)}: ${raw}`);
    }
  }
};

const lineAt = (src, index) => src.slice(0, index).split(/\r?\n/).length;

/* ── 11. A lib README only imports names its package actually exports ── */

/*
 * Resolves the names reachable through a lib's public entry point: named
 * re-exports plus the declarations behind every `export * from './x'`, followed
 * recursively so nested barrels (`index.ts` -> `protocol.ts` ->
 * `protocol/overlay-protocol.ts`) resolve. Returns `undefined` when the surface
 * cannot be decided statically — a star-export of another package — so the
 * caller skips rather than reporting a false positive.
 */
const publicExports = (libDir) => {
  const entry = ['.ts', '.tsx']
    .map((ext) => join(libDir, 'src', `index${ext}`))
    .find(existsSync);
  if (!entry) return undefined;

  const names = new Set();
  const visited = new Set();
  let isDecidable = true;

  const addBraced = (source) => {
    for (const m of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
      for (const part of m[1].split(',')) {
        const name = part.replace(/\btype\b/g, '').trim();
        if (name)
          names.add(
            name
              .split(/\s+as\s+/)
              .pop()
              .trim(),
          );
      }
    }
  };

  const visit = (file) => {
    if (visited.has(file)) return;
    visited.add(file);

    const src = readFileSync(file, 'utf8');
    addBraced(src);

    for (const d of src.matchAll(
      /export\s+(?:declare\s+)?(?:const|function|class|enum|interface|type)\s+([A-Za-z0-9_$]+)/g,
    )) {
      names.add(d[1]);
    }

    for (const m of src.matchAll(/export\s+\*\s+from\s+'([^']+)'/g)) {
      const spec = m[1];
      if (!spec.startsWith('.')) {
        isDecidable = false;
        continue;
      }

      /*
       * Extensionless specifier resolution, file before directory — the same
       * order the bundler uses, which matters where a `x.ts` and an `x/` sit
       * side by side (a layout .claude/rules/all-ts.md forbids for this reason).
       */
      const target = ['.ts', '.tsx', '/index.ts', '/index.tsx']
        .map((ext) => resolve(dirname(file), spec + ext))
        .find(existsSync);
      if (target) visit(target);
    }
  };

  visit(resolve(entry));

  return isDecidable ? names : undefined;
};

/*
 * Public `dial-*` class names are a host-facing contract that nothing else
 * verifies: a renamed class still compiles, still passes its guard test if the
 * test reads the constant, and silently stops matching the host's stylesheet.
 * So the constants record and the README must agree in both directions.
 *
 * Only the lib's own prefixes are checked, so a README may freely mention
 * `dial-kit-*`, a typography class, or another lib's class.
 */
const PUBLIC_CLASS_LITERAL = /'(dial-[a-z0-9]+(?:-[a-z0-9]+)*)'/g;
const CLASS_TOKEN = /dial-[a-z0-9]+(?:-[a-z0-9]+)*/g;

const declaredPublicClasses = (libDir) => {
  const path = `${libDir}/src/constants/public-class-names.ts`;
  if (!existsSync(path)) return null;

  const names = new Set();
  for (const match of readFileSync(path, 'utf8').matchAll(PUBLIC_CLASS_LITERAL)) {
    names.add(match[1]);
  }
  return names.size > 0 ? names : null;
};

/* `dial-ci-action-row` and `dial-catalog-card` both yield `dial-<seg>-`. */
const ownPrefixes = (names) =>
  new Set([...names].map((name) => name.split('-').slice(0, 2).join('-') + '-'));

const checkPublicClassNames = (src, file, libDir) => {
  const declared = declaredPublicClasses(libDir);
  if (!declared) return;

  for (const name of declared) {
    if (!src.includes(name)) {
      fail(
        file,
        `does not document "${name}", which ${libDir}/src/constants/public-class-names.ts declares`,
      );
    }
  }

  const prefixes = [...ownPrefixes(declared)];
  const reported = new Set();
  for (const match of src.matchAll(CLASS_TOKEN)) {
    const name = match[0];
    if (declared.has(name) || reported.has(name)) continue;
    /* Inside a longer identifier — the package name `@epam/ai-dial-<lib>`. */
    if (src[match.index - 1] === '-') continue;
    if (!prefixes.some((prefix) => name.startsWith(prefix))) continue;

    reported.add(name);
    fail(
      file,
      `line ${lineAt(src, match.index)}: documents "${name}", which ${libDir}/src/constants/public-class-names.ts does not declare`,
    );
  }
};

const checkReadmeImports = (src, file, libDir) => {
  const pkg = readJson(`${libDir}/package.json`);
  if (!pkg?.name) return;

  const exported = publicExports(libDir);
  /* Undecidable surface (star-export of another package) — skip rather than lie. */
  if (!exported || exported.size === 0) return;

  const quoted = pkg.name.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&');
  const importRe = new RegExp(
    `import(?:\\s+type)?\\s*\\{([^}]*)\\}\\s*from\\s*'${quoted}'`,
    'g',
  );

  for (const match of src.matchAll(importRe)) {
    for (const part of match[1].split(',')) {
      const name = part
        .replace(/\btype\b/g, '')
        .trim()
        .split(/\s+as\s+/)[0];
      if (!name || exported.has(name)) continue;

      fail(
        file,
        `line ${lineAt(src, match.index)}: imports "${name}" from ${pkg.name}, which does not export it`,
      );
    }
  }
};

/* ── Run ── */

const explicitFiles = process.argv.length > 2;
const files = explicitFiles ? process.argv.slice(2) : allDocFiles();

if (!explicitFiles) {
  checkReadmeCoverage();
  checkLibPackageMetadata();
  checkLibStylesExport();
  checkDependencyRoleConsistency();
  checkNoUnboundedVersions();
  checkConsistentExternalRanges();
  checkNoTestToolingInManifest();
  checkPeerMetaMatchesPeers();
}

for (const file of files) {
  if (!existsSync(file) || statSync(file).isDirectory()) {
    fail(file, 'not a readable file');
    continue;
  }

  const src = readFileSync(file, 'utf8');
  checkLinks(src, file);

  const libDir = relative(process.cwd(), resolve(dirname(file)))
    .split(/[\\/]/)
    .slice(0, 2)
    .join('/');
  if (libDir.startsWith('libs/') && file.endsWith('README.md')) {
    checkReadmeImports(src, file, libDir);
    checkPublicClassNames(src, file, libDir);
    checkReadmeVersionCitations(src, file, libDir);
  }
}

if (errors.length > 0) {
  console.error(
    `\nDocumentation validation failed (${errors.length} problem(s)):\n`,
  );
  for (const error of errors) console.error(`  ${error}`);
  console.error(
    '\nSee the Docs section of AGENTS.md and .claude/rules/docs.md for the rules behind these checks.\n',
  );
  process.exit(1);
}

console.log(
  `Documentation validation passed (${files.length} markdown files).`,
);
console.log(
  'Checks: README coverage and H1/package identity, lib package metadata, lib stylesheet exports, dependency/peer role consistency, unbounded version specs, one range per external package, no test tooling in a published manifest, peer metadata matching declared peers, README version citations, relative links, README imports vs public exports, public dial-* class names vs their README.',
);
