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
//   3. Broken relative links — every link to a file that no longer exists
//      (`docs/environment-variables-migration-guide.md` after its removal).
//   4. Phantom exports — a name a lib README imports from its own package that
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
      fail(path, '"description" repeats the package name instead of describing it');
    }

    if (pkg.license !== REQUIRED_LICENSE) {
      fail(path, `"license" must be "${REQUIRED_LICENSE}", found "${pkg.license ?? '(none)'}"`);
    }
  }
};

/* ── 3. Relative markdown links resolve ── */

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

/* ── 4. A lib README only imports names its package actually exports ── */

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
        if (name) names.add(name.split(/\s+as\s+/).pop().trim());
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
      const name = part.replace(/\btype\b/g, '').trim().split(/\s+as\s+/)[0];
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
  }
}

if (errors.length > 0) {
  console.error(`\nDocumentation validation failed (${errors.length} problem(s)):\n`);
  for (const error of errors) console.error(`  ${error}`);
  console.error(
    '\nSee the Docs section of AGENTS.md and .claude/rules/docs.md for the rules behind these checks.\n',
  );
  process.exit(1);
}

console.log(`Documentation validation passed (${files.length} markdown files).`);
console.log(
  'Checks: README coverage and H1/package identity, lib package metadata, relative links, README imports vs public exports.',
);
