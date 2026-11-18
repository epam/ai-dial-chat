/*
 * Knip preprocessor (`knip --preprocessor ./tools/knip/drop-root-manifest-repeats.mjs`).
 *
 * The root package.json installs one version of every package for the whole
 * workspace, so it repeats dependencies that apps and libs declare in their
 * own manifests. Knip reports each repeat as unused in the root because no
 * root file imports it. This drops those root findings only; the owning
 * workspace's manifest still reports the dependency when it is unused there,
 * and a root dependency that no workspace declares is still reported.
 *
 * Knip's `ignoreDependencies` cannot do this: an ignore set on the root
 * workspace also silences the same package in every other workspace.
 */
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT_WORKSPACE = '.';
const WORKSPACE_MANIFEST_PATTERNS = [
  'apps/*/package.json',
  'libs/*/package.json',
  'tools/publish-lib/package.json',
];
const MANIFEST_DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];
const DEPENDENCY_ISSUE_TYPES = [
  'dependencies',
  'devDependencies',
  'optionalPeerDependencies',
];

/** Every package name any workspace manifest under `cwd` declares. */
export const readWorkspaceDeclaredDependencies = (cwd) =>
  new Set(
    WORKSPACE_MANIFEST_PATTERNS.flatMap((pattern) =>
      globSync(pattern, { cwd }),
    ).flatMap((manifestPath) => {
      const manifest = JSON.parse(
        readFileSync(join(cwd, manifestPath), 'utf8'),
      );
      return MANIFEST_DEPENDENCY_FIELDS.flatMap((field) =>
        Object.keys(manifest[field] ?? {}),
      );
    }),
  );

/**
 * Removes root-manifest dependency findings for packages in `declared`,
 * keeping `counters` in step with `issues`. Mutates and returns `options`.
 */
export const dropRootManifestRepeats = (options, declared) => {
  for (const type of DEPENDENCY_ISSUE_TYPES) {
    const records = options.issues[type] ?? {};

    for (const [filePath, issuesBySymbol] of Object.entries(records)) {
      for (const [key, issue] of Object.entries(issuesBySymbol)) {
        if (issue.workspace === ROOT_WORKSPACE && declared.has(issue.symbol)) {
          delete issuesBySymbol[key];
          options.counters[type] -= 1;
        }
      }

      if (Object.keys(issuesBySymbol).length === 0) {
        delete records[filePath];
      }
    }
  }

  return options;
};

export default (options) =>
  dropRootManifestRepeats(
    options,
    readWorkspaceDeclaredDependencies(options.cwd),
  );
