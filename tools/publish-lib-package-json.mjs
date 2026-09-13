/**
 * Pure package.json transformation used by `tools/publish-lib.mjs` to turn a
 * workspace library's source package.json into the publish-ready manifest
 * written into `dist/` before `npm publish` runs from there.
 *
 * Split out of `publish-lib.mjs` so it can be unit tested directly — the CLI
 * script itself runs Nx project-graph resolution and npm/process side effects
 * as soon as it is loaded, which makes it unsafe to `import` in a test.
 */

import path from 'path';

// Throws rather than exiting the process, so this pure transformation stays
// unit-testable (per this file's own docstring); `publish-lib.mjs`'s caller
// catches the thrown error, prints it, and exits.
function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Accept #.#.#, #.#.#-pre.N, or the special token "dev".
const VALID_VERSION = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

// Strip "./dist/" prefix from entry-point paths so they resolve correctly
// when npm publish runs from inside the dist/ directory.
export const stripDistPrefix = (p) =>
  typeof p === 'string' && p.startsWith('./dist/') ? './' + p.slice(7) : p;

// Counts how many times a top-level key literal appears in the *raw* JSON
// text. `JSON.parse` silently keeps only the last of any duplicate key, so a
// duplicate is invisible once the manifest has been parsed into an object —
// this must run against the source text before parsing to catch it at all.
export const countRawJsonKeyOccurrences = (rawSource, key) => {
  const tokens = rawSource.match(/"(?:\\.|[^"\\])*"|[{}\[\]:]/g) ?? [];
  let depth = 0;
  let count = 0;
  tokens.forEach((token, index) => {
    if (token === '{' || token === '[') depth++;
    else if (token === '}' || token === ']') depth--;
    else if (
      depth === 1 &&
      token.startsWith('"') &&
      tokens[index + 1] === ':' &&
      JSON.parse(token) === key
    )
      count++;
  });
  return count;
};

// Recursively rewrite all string values inside an exports map, and drop the
// "@epam/source" condition (an internal monorepo-only resolution hint).
export const rewriteExportsObj = (obj) => {
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

/**
 * Mutates `json` (a parsed source package.json) into the publish-ready shape
 * and returns it: sets the version, drops "private", sets "repository",
 * rewrites "./dist/..." paths off main/module/types/exports/sideEffects, and
 * replaces workspace-lib dependency placeholders with the publish version.
 *
 * @param json parsed source package.json
 * @param options.version publish version (already resolved/validated by the caller's flow)
 * @param options.projectRoot Nx project root, e.g. "libs/chat-hooks" (workspace-relative, any separator)
 * @param options.isWorkspaceLib (depName: string) => boolean
 * @param options.rawSource the source package.json's raw text, before `JSON.parse` — when given,
 *   used to reject a manifest with more than one "sideEffects" key rather than silently
 *   publishing whichever value `JSON.parse` happened to keep
 */
export const preparePublishPackageJson = (
  json,
  { version, projectRoot, isWorkspaceLib, rawSource },
) => {
  invariant(
    version && (VALID_VERSION.test(version) || version === 'dev'),
    `Version did not match Semantic Versioning.\nExpected: #.#.#  |  #.#.#-pre.N  |  dev\nGot: ${version}`,
  );

  if (rawSource != null) {
    const sideEffectsKeyCount = countRawJsonKeyOccurrences(
      rawSource,
      'sideEffects',
    );
    invariant(
      sideEffectsKeyCount <= 1,
      `package.json declares ${sideEffectsKeyCount} "sideEffects" keys — expected at most one. ` +
        'JSON.parse silently keeps only the last duplicate, hiding the wrong contract from anyone reading the file top-to-bottom.',
    );
  }

  // Set publish version
  json.version = version;

  // Remove "private" so npm allows publishing
  delete json.private;

  // npm's automatic provenance (enabled by the release workflow's
  // "id-token: write" permission) validates "repository.url" against the
  // "repository" claim in the OIDC token, which reflects the actual
  // publishing repo (e.g. a fork) — publish fails with E422 if it's missing
  // or wrong, so derive it from the CI env instead of hardcoding it.
  const repoUrl =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
      ? `git+${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}.git`
      : 'git+https://github.com/epam/ai-dial-chat.git';
  json.repository = {
    type: 'git',
    url: repoUrl,
    directory: projectRoot.split(path.sep).join('/'),
  };

  // Rewrite entry-point paths (main, module, types, exports, sideEffects)
  if (json.main) json.main = stripDistPrefix(json.main);
  if (json.module) json.module = stripDistPrefix(json.module);
  if (json.types) json.types = stripDistPrefix(json.types);
  if (json.exports) json.exports = rewriteExportsObj(json.exports);
  if (Array.isArray(json.sideEffects)) {
    json.sideEffects = json.sideEffects.map(stripDistPrefix);
  }

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

  return json;
};
