#!/usr/bin/env node
/*
 * Advisory spec-impact report: lists OpenSpec capabilities whose referenced
 * files changed in a diff while their spec.md did not. It never fails — a code
 * change does not always need a spec change — it only points a reviewer at the
 * specs most likely to have drifted.
 *
 * A spec "references" a file when one of its inline `code` spans is a
 * repo-relative path (the same extraction scripts/validate-spec-references.mjs
 * uses, historical sentences excluded). A directory or glob reference matches
 * every file beneath it. Three kinds of reference are ignored as too broad to
 * be a signal: a directory or glob with fewer than MIN_SEGMENTS literal path
 * segments (`apps/chat/src`, `libs/*`), a hub file cited by more than
 * HUB_THRESHOLD specs (en.json, translation-keys.ts, app.tsx), and anything
 * under openspec/. A spec counts as updated when its own spec.md, or a delta
 * spec for the same capability under openspec/changes/, is in the diff.
 *
 * Usage: node scripts/spec-impact.mjs [--base <ref>] [--limit <n>] [--json]
 *   --base   git ref to diff against (default origin/development); the diff is
 *            `git diff --name-only <base>...HEAD`
 *   --limit  maximum specs listed (default 30), ranked by changed files
 * Under GitHub Actions (GITHUB_ACTIONS=true) it emits ::warning annotations on
 * each spec and appends a Markdown table to $GITHUB_STEP_SUMMARY.
 * Tests: scripts/spec-impact.spec.mjs (`npm run validate:specs:test`)
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  listSpecFiles,
  specPathReferences,
} from './validate-spec-references.mjs';

export const DEFAULT_BASE = 'origin/development';
export const DEFAULT_LIMIT = 30;
export const MIN_SEGMENTS = 4;
export const HUB_THRESHOLD = 20;

const escapeRegExp = (text) => text.replace(/[.+^$()|[\]\\]/g, '\\$&');

/* Glob → RegExp; a match also covers everything beneath a matched directory. */
export const globToRegExp = (pattern) => {
  let source = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '*' && pattern[i + 1] === '*') {
      source += '.*';
      i += 1;
      if (pattern[i + 1] === '/') i += 1;
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else if (char === '{' && pattern.indexOf('}', i) !== -1) {
      const close = pattern.indexOf('}', i);
      source += `(?:${pattern
        .slice(i + 1, close)
        .split(',')
        .map(escapeRegExp)
        .join('|')})`;
      i = close;
    } else source += escapeRegExp(char);
  }
  return new RegExp(`^${source}(?:/.*)?$`);
};

/* Number of literal path segments before the first wildcard. */
export const literalSegments = (path) => {
  const segments = path.split('/');
  const wildcard = segments.findIndex((segment) => /[*?{]/.test(segment));
  return wildcard === -1 ? segments.length : wildcard;
};

/* A non-pattern reference whose last segment has an extension is a file. */
export const isFileReference = (ref) =>
  !ref.isPattern && /\.[A-Za-z0-9]+$/.test(ref.path.split('/').pop());

/* References cited by more than `threshold` specs. */
export const hubReferences = (specs, threshold = HUB_THRESHOLD) => {
  const counts = new Map();
  for (const spec of specs)
    for (const path of new Set(spec.references.map((ref) => ref.path)))
      counts.set(path, (counts.get(path) ?? 0) + 1);
  return new Set(
    [...counts].filter(([, count]) => count > threshold).map(([path]) => path),
  );
};

/*
 * Turns normalized references into matchers, dropping the ones too broad to
 * signal anything. Returns [{ reference, test(file) }].
 */
export const buildMatchers = (references, hubs = new Set()) =>
  references
    .filter((ref) => !ref.path.startsWith('openspec/'))
    .filter((ref) => !hubs.has(ref.path))
    .filter(
      (ref) =>
        isFileReference(ref) || literalSegments(ref.path) >= MIN_SEGMENTS,
    )
    .map((ref) => {
      if (ref.isPattern) {
        const regExp = globToRegExp(ref.path);
        return { reference: ref.path, test: (file) => regExp.test(file) };
      }
      if (isFileReference(ref))
        return { reference: ref.path, test: (file) => file === ref.path };
      /* A directory, or an extensionless module specifier's file. */
      const module = new RegExp(
        `^${escapeRegExp(ref.path)}(?:\\.[a-z]+|/index\\.[a-z]+)?$`,
      );
      return {
        reference: ref.path,
        test: (file) => module.test(file) || file.startsWith(`${ref.path}/`),
      };
    });

/* True when the diff updates the capability's spec or a delta spec for it. */
export const specUpdated = (capability, changedFiles) =>
  changedFiles.some(
    (file) =>
      file === `openspec/specs/${capability}/spec.md` ||
      (file.startsWith('openspec/changes/') &&
        file.endsWith(`/specs/${capability}/spec.md`)),
  );

/*
 * specs: [{ capability, file, references }]. Returns the specs whose
 * referenced files changed without a spec update, most-changed first:
 * [{ capability, file, changedFiles: [...], references: [...] }].
 */
export const computeImpact = (
  specs,
  changedFiles,
  { hubThreshold = HUB_THRESHOLD } = {},
) => {
  const hubs = hubReferences(specs, hubThreshold);
  return specs
    .filter((spec) => !specUpdated(spec.capability, changedFiles))
    .map((spec) => {
      const matchers = buildMatchers(spec.references, hubs);
      const hits = new Set();
      const references = new Set();
      for (const file of changedFiles) {
        for (const matcher of matchers) {
          if (!matcher.test(file)) continue;
          hits.add(file);
          references.add(matcher.reference);
        }
      }
      return {
        capability: spec.capability,
        file: spec.file,
        changedFiles: [...hits].sort(),
        references: [...references].sort(),
      };
    })
    .filter((impact) => impact.changedFiles.length > 0)
    .sort(
      (a, b) =>
        b.changedFiles.length - a.changedFiles.length ||
        a.capability.localeCompare(b.capability),
    );
};

const preview = (files, max = 3) =>
  files.length > max
    ? `${files.slice(0, max).join(', ')} (+${files.length - max} more)`
    : files.join(', ');

const shownSuffix = ({ total, limit }) =>
  total > limit ? ` (top ${limit} shown)` : '';

export const formatPlain = (impacts, meta) => {
  if (impacts.length === 0)
    return `spec impact vs ${meta.base}: no spec references a changed file without its spec changing.`;
  return [
    `spec impact vs ${meta.base}: ${meta.total} spec(s) reference changed files but were not updated${shownSuffix(meta)}.`,
    'Advisory only: confirm each spec still describes the code, or update it in this change.',
    '',
    ...impacts
      .slice(0, meta.limit)
      .map(
        (impact) =>
          `${impact.file}: ${impact.changedFiles.length} changed file(s): ${preview(impact.changedFiles)}`,
      ),
  ].join('\n');
};

/* Workflow commands need %, CR and LF escaped in the message. */
export const escapeAnnotation = (text) =>
  text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

export const formatAnnotations = (impacts, limit) =>
  impacts
    .slice(0, limit)
    .map(
      (impact) =>
        `::warning file=${impact.file}::${escapeAnnotation(
          `Spec may be stale: ${impact.changedFiles.length} file(s) it references changed in this PR (${preview(impact.changedFiles)}) but the spec did not.`,
        )}`,
    )
    .join('\n');

export const formatSummary = (impacts, meta) => {
  if (impacts.length === 0)
    return [
      '## Spec impact (advisory)',
      '',
      `No spec references a file changed since \`${meta.base}\` without its spec changing.`,
      '',
    ].join('\n');
  return [
    '## Spec impact (advisory)',
    '',
    `${meta.total} spec(s) reference files changed in this PR but were not updated${shownSuffix(meta)}. Confirm each still describes the code, or update it in this change.`,
    '',
    '| Spec | Changed referenced files | Examples |',
    '| --- | ---: | --- |',
    ...impacts.slice(0, meta.limit).map((impact) => {
      const examples = impact.changedFiles
        .slice(0, 3)
        .map(
          (file) => `\`${file.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')}\``,
        )
        .join(', ');
      const more =
        impact.changedFiles.length > 3
          ? ` +${impact.changedFiles.length - 3} more`
          : '';
      return `| \`${impact.file}\` | ${impact.changedFiles.length} | ${examples}${more} |`;
    }),
    '',
  ].join('\n');
};

export const parseArgs = (argv) => {
  const options = { base: DEFAULT_BASE, limit: DEFAULT_LIMIT, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base' && argv[i + 1]) options.base = argv[(i += 1)];
    else if (arg.startsWith('--base=')) options.base = arg.slice(7);
    else if (arg === '--limit' && argv[i + 1])
      options.limit = Number(argv[(i += 1)]) || DEFAULT_LIMIT;
    else if (arg === '--json') options.json = true;
  }
  return options;
};

const changedFilesSince = (repoRoot, base) =>
  execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const options = parseArgs(process.argv.slice(2));
  const inActions = process.env.GITHUB_ACTIONS === 'true';
  try {
    const changedFiles = changedFilesSince(repoRoot, options.base);
    const specs = listSpecFiles(repoRoot).map((spec) => ({
      ...spec,
      references: specPathReferences(
        readFileSync(join(repoRoot, spec.file), 'utf8'),
      ),
    }));
    const impacts = computeImpact(specs, changedFiles);
    const meta = {
      base: options.base,
      limit: options.limit,
      total: impacts.length,
    };
    if (options.json) {
      const report = { ...meta, changedFiles: changedFiles.length, impacts };
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      console.log(formatPlain(impacts, meta));
      if (inActions && impacts.length)
        console.log(formatAnnotations(impacts, options.limit));
    }
    if (inActions && process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `${formatSummary(impacts, meta)}\n`,
      );
  } catch (error) {
    /* Advisory: a missing base ref or shallow clone must never fail the job. */
    const reason = String(error.stderr || error.message)
      .trim()
      .split('\n')[0];
    const message = `spec impact skipped: could not diff against ${options.base} (${reason})`;
    console.log(
      inActions ? `::warning::${escapeAnnotation(message)}` : message,
    );
  }
  process.exit(0);
}
