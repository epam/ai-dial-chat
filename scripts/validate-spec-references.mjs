#!/usr/bin/env node
/*
 * Catches OpenSpec spec drift on every PR instead of in periodic audits.
 *
 * Every inline `code` span in openspec/specs/<capability>/spec.md is
 * classified and — only where the check is cheap and high-confidence — verified
 * against the working tree:
 *
 *   ERROR (exit 1)
 *     - A repo-relative path under a known root (apps/, libs/, tools/, scripts/,
 *       docs/, openspec/, .github/) that does not exist. Globs (`*`, `**`,
 *       `{a,b}`), placeholders (`<lib>`, `{lang}`, `...`) and trailing `/` are
 *       allowed; `path:12` and `path#L12` suffixes are stripped first. Build
 *       and test output (any `dist`, `out-tsc`, `coverage`… segment) is not
 *       checked, since it exists only after a build.
 *     - A translation key `namespace.key` whose top-level namespace exists in
 *       apps/chat/src/i18n/locales/en.json but whose full key does not. Only
 *       checked when the line presents it as a key (mentions i18n, translation,
 *       locale, key, label or string, or the span is a `t('…')` call).
 *
 *   WARNING (never fails)
 *     - A path carrying a `:<line>` / `#L<line>` suffix: line numbers rot on
 *       the next edit; reference the file (and a symbol) instead.
 *     - A PascalCase / camelCase identifier found nowhere under apps/ libs/
 *       tools/ scripts/. Warning-only because env vars, DIAL Core fields and
 *       external APIs legitimately appear in specs without a local definition.
 *     - An allowlist entry that no longer matches anything.
 *
 * Historical references are skipped: a span is not checked when its line
 * contains one of the words in HISTORICAL_LINE (removed, no longer, previously,
 * superseded, formerly, replaced by, renamed). Everything else that is
 * intentionally unverifiable goes in openspec/spec-references.allow.json:
 *
 *   { "entries": [
 *       { "reference": "apps/chat/src/legacy/*", "spec": "my-capability",
 *         "reason": "why this reference must stay as written" } ] }
 *
 * `reference` matches the normalized token (`*` is a wildcard); `spec` is an
 * optional capability name or `*` pattern; `reason` is required.
 *
 * openspec/changes/** is historical and never scanned.
 *
 * Usage: node scripts/validate-spec-references.mjs [--json] [--no-identifiers]
 * Tests: scripts/validate-spec-references.spec.mjs (`npm run validate:specs:test`)
 */
import { existsSync, globSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PATH_ROOTS = [
  'apps',
  'libs',
  'tools',
  'scripts',
  'docs',
  'openspec',
  '.github',
];
export const IDENTIFIER_ROOTS = ['apps', 'libs', 'tools', 'scripts'];
export const SKIP_DIRECTORIES = new Set([
  '.git',
  '.nx',
  'coverage',
  'dist',
  'node_modules',
  'out-tsc',
  'tmp',
  'test-results',
  'playwright-report',
  'storybook-static',
]);
/*
 * Build and test output (`apps/chat/dist`, a lib's `dist/index.css`) is real
 * only after a build, so a clean CI checkout cannot verify it while a local
 * tree can — the result would depend on the machine. Such paths are skipped.
 */
export const isBuildOutputPath = (normalizedPath) =>
  normalizedPath.split('/').some((segment) => SKIP_DIRECTORIES.has(segment));
export const ALLOWLIST_FILE = 'openspec/spec-references.allow.json';
export const I18N_FILE = 'apps/chat/src/i18n/locales/en.json';

/*
 * A span is not checked when the sentence containing it matches this: it names
 * something that used to exist, or states that something does not / must not.
 */
export const HISTORICAL_SENTENCE = new RegExp(
  [
    'removed',
    'no longer',
    'previously',
    'supersede[sd]?',
    'former(?:ly)?',
    'legacy',
    'replaced by',
    'renamed',
    'relocated',
    'moved from',
    'used to',
    'deleted',
    'never',
    'there (?:is|are) no',
    'do(?:es)? not exist',
    'SHALL NOT (?:exist|introduce|add)',
  ]
    .map((word) => `\\b${word}\\b`)
    .join('|'),
  'i',
);

/* Words in the sentence that mark a dotted span as a translation key. */
const I18N_CONTEXT =
  /\bi18n\b|\btranslation keys?\b|\blocales?\b|en\.json|\bt\(/i;

const SOURCE_EXTENSION =
  /\.(tsx?|mts|cts|jsx?|mjs|cjs|json|scss|css|ya?ml|html)$/i;
const IDENTIFIER_PATTERN = /[A-Za-z_$][\w$]*/g;

/* ---------- span extraction ---------- */

/* Code spans on one line as { text, start, end } (multi-backtick aware). */
export const lineSpans = (lineText) => {
  const spans = [];
  let cursor = 0;
  while (cursor < lineText.length) {
    const open = lineText.indexOf('`', cursor);
    if (open === -1) break;
    let width = 1;
    while (lineText[open + width] === '`') width += 1;
    let close = -1;
    let search = open + width;
    while (search < lineText.length) {
      const candidate = lineText.indexOf('`', search);
      if (candidate === -1) break;
      let run = 1;
      while (lineText[candidate + run] === '`') run += 1;
      if (run === width) {
        close = candidate;
        break;
      }
      search = candidate + run;
    }
    if (close === -1) {
      cursor = open + width;
      continue;
    }
    const text = lineText.slice(open + width, close).trim();
    if (text) spans.push({ text, start: open, end: close + width });
    cursor = close + width;
  }
  return spans;
};

/* A new block starts at a blank line, heading, list item or table row. */
const BLOCK_START = /^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|\|)/;
/* A heading or table row is a block of its own. */
const SINGLE_LINE_BLOCK = /^\s*(?:#{1,6}\s|\|)/;
/* Sentence boundaries: end punctuation before whitespace, or a table cell. */
const SENTENCE_BOUNDARY = /[.!?](?=\s)|\|/g;

const sentenceAround = (text, from, to) => {
  let start = 0;
  let end = text.length;
  for (const match of text.matchAll(SENTENCE_BOUNDARY)) {
    if (match.index < from) start = match.index + 1;
    else if (match.index >= to) {
      end = match.index + (match[0] === '|' ? 0 : 1);
      break;
    }
  }
  return text.slice(start, end).trim();
};

/*
 * Returns every single-line inline code span outside fenced blocks as
 * { text, line, lineText, sentence }. `sentence` is the sentence containing
 * the span, joined across the hard-wrapped lines of its paragraph.
 */
export const extractSpans = (markdown) => {
  const spans = [];
  let fence = null;
  let block = null;
  const flush = () => {
    if (!block) return;
    const joined = block.lines.map((l) => l.text).join(' ');
    for (const line of block.lines)
      for (const span of lineSpans(line.text))
        spans.push({
          text: span.text,
          line: line.number,
          lineText: line.text,
          sentence: sentenceAround(
            joined,
            line.offset + span.start,
            line.offset + span.end,
          ),
        });
    block = null;
  };
  markdown.split(/\r?\n/).forEach((text, index) => {
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(text);
    if (fenceMatch) {
      flush();
      const marker = fenceMatch[1];
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length)
        fence = null;
      return;
    }
    if (fence) return;
    if (!text.trim() || BLOCK_START.test(text)) flush();
    if (!text.trim()) return;
    if (!block) block = { lines: [], length: 0 };
    block.lines.push({ text, number: index + 1, offset: block.length });
    block.length += text.length + 1;
    if (SINGLE_LINE_BLOCK.test(text)) flush();
  });
  flush();
  return spans;
};

/* A span is historical when its sentence matches HISTORICAL_SENTENCE. */
export const isHistorical = (span) =>
  HISTORICAL_SENTENCE.test(span.sentence ?? span.lineText);

/* ---------- path normalization ---------- */

/*
 * Normalizes a path-looking span. Returns null when it is not a repo path.
 * { path, hasLineSuffix, isPattern } — `path` has `./`, `:line`, `#Lline`,
 * trailing punctuation and trailing `/` removed; placeholders are turned into
 * glob wildcards so they can be matched.
 */
export const normalizePath = (text) => {
  const first = text.trim().split(/\s+/)[0].replace(/^\.\//, '');
  const root = PATH_ROOTS.find((r) => first.startsWith(`${r}/`));
  if (!root) return null;
  let path = first.replace(/[),;'"]+$/, '').replace(/\.$/, '');
  let hasLineSuffix = false;
  const anchor = /#L\d+(?:-L?\d+)?$/.exec(path);
  if (anchor) {
    hasLineSuffix = true;
    path = path.slice(0, anchor.index);
  }
  path = path.replace(/::.*$/, ''); // `file.ts::symbol(...)`
  const line = /:\d+(?:[-,]\d+)*(?::\d+)?$/.exec(path);
  if (line) {
    hasLineSuffix = true;
    path = path.slice(0, line.index);
  }
  path = path.replace(/#.*$/, '').replace(/\/+$/, '');
  const pattern = path
    .replace(/<[^>]*>/g, '*')
    .replace(/\{([^{},]*)\}/g, '*')
    .replace(/\/\.\.\.(?=\/|$)/g, '/**')
    .replace(/\.\.\.$/, '*');
  return {
    path: pattern,
    hasLineSuffix,
    isPattern: /[*?{]/.test(pattern),
  };
};

/* ---------- classification ---------- */

export const isQualifiedIdentifier = (token) =>
  token.length >= 4 &&
  /^[A-Za-z_$][\w$]*$/.test(token) &&
  (/[a-z][A-Z]/.test(token) || /^[A-Z][a-z0-9]+[A-Z]/.test(token));

const I18N_KEY = /^[a-zA-Z][\w-]*(?:\.[\w-]+)+$/;
const FILE_EXTENSION =
  /\.(tsx?|jsx?|mjs|cjs|json|scss|css|ya?ml|md|html|svg|png)$/i;

/*
 * Classifies a span: { kind: 'path' | 'i18n' | 'identifier', ... } or null.
 * `i18nNamespaces` is the set of top-level keys in en.json.
 */
export const classifySpan = (span, i18nNamespaces = new Set()) => {
  const text = span.text.replace(/[;,.]+$/, '');
  if (!text) return null;

  const path = normalizePath(text);
  if (path) return { kind: 'path', token: path.path, ...path };

  const call = /^t\(\s*['"]([^'"]+)['"]/.exec(text);
  const key = call ? call[1] : text;
  if (
    I18N_KEY.test(key) &&
    !FILE_EXTENSION.test(key) &&
    i18nNamespaces.has(key.split('.')[0]) &&
    (call || I18N_CONTEXT.test(span.sentence ?? span.lineText))
  ) {
    return { kind: 'i18n', token: key };
  }

  /* Only a bare identifier, a dotted chain, or a call / generic of one. */
  const bare = text.replace(/\(.*\)$|<.*>$|\[\]$/, '');
  if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(bare)) return null;
  const tokens = bare.split('.').filter(isQualifiedIdentifier);
  return tokens.length ? { kind: 'identifier', tokens } : null;
};

/* ---------- allowlist ---------- */

const wildcardToRegExp = (pattern) =>
  new RegExp(
    `^${pattern
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')}$`,
  );

/* Returns { entries, errors }; each entry gains a `used` flag. */
export const parseAllowlist = (json, file = ALLOWLIST_FILE) => {
  const errors = [];
  const raw = Array.isArray(json?.entries) ? json.entries : null;
  if (!raw)
    return { entries: [], errors: [`${file}: expected { "entries": [...] }`] };
  const entries = [];
  raw.forEach((entry, index) => {
    if (typeof entry?.reference !== 'string' || !entry.reference) {
      errors.push(`${file}: entries[${index}] needs a "reference" string`);
      return;
    }
    if (typeof entry.reason !== 'string' || !entry.reason.trim()) {
      errors.push(
        `${file}: entries[${index}] (${entry.reference}) needs a "reason"`,
      );
      return;
    }
    const specs = entry.spec === undefined ? [] : [entry.spec].flat();
    if (specs.some((spec) => typeof spec !== 'string' || !spec)) {
      errors.push(
        `${file}: entries[${index}] (${entry.reference}) "spec" must be a string or string[]`,
      );
      return;
    }
    entries.push({
      ...entry,
      referenceMatcher: wildcardToRegExp(entry.reference),
      specMatchers: specs.map(wildcardToRegExp),
      used: false,
    });
  });
  return { entries, errors };
};

export const findAllowlistEntry = (entries, capability, token) => {
  const entry = entries.find(
    (e) =>
      e.referenceMatcher.test(token) &&
      (e.specMatchers.length === 0 ||
        e.specMatchers.some((matcher) => matcher.test(capability))),
  );
  if (entry) entry.used = true;
  return entry ?? null;
};

/* ---------- repository indexes ---------- */

const walk = (directory, onFile) => {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRECTORIES.has(entry.name)) walk(path, onFile);
    } else onFile(path, entry.name);
  }
};

export const flattenKeys = (object, prefix = '', out = new Set()) => {
  for (const [key, value] of Object.entries(object)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flattenKeys(value, full, out);
    else out.add(full);
  }
  return out;
};

/* A key exists as a leaf, a group (prefix), or an i18next plural/context. */
export const i18nKeyExists = (keys, key) =>
  keys.has(key) ||
  [...keys].some((k) => k.startsWith(`${key}.`) || k.startsWith(`${key}_`));

/* Extensionless module specifiers resolve the way the bundler would. */
export const MODULE_SUFFIXES = [
  '',
  '.ts',
  '.tsx',
  '.mts',
  '.js',
  '.mjs',
  '.jsx',
  '.json',
  '/index.ts',
  '/index.tsx',
];

export const pathExists = (repoRoot, normalized) => {
  if (!normalized.isPattern)
    return MODULE_SUFFIXES.some((suffix) =>
      existsSync(join(repoRoot, `${normalized.path}${suffix}`)),
    );
  try {
    return (
      globSync(normalized.path, {
        cwd: repoRoot,
        exclude: (name) => SKIP_DIRECTORIES.has(name),
      }).length > 0
    );
  } catch {
    return true; // an unparsable pattern is not a high-confidence finding
  }
};

const buildIdentifierIndex = (repoRoot) => {
  const identifiers = new Set();
  for (const root of IDENTIFIER_ROOTS) {
    walk(join(repoRoot, root), (path, name) => {
      if (!SOURCE_EXTENSION.test(name)) return;
      let text;
      try {
        text = readFileSync(path, 'utf8');
      } catch {
        return;
      }
      if (text.length > 5_000_000) return;
      for (const match of text.matchAll(IDENTIFIER_PATTERN))
        identifiers.add(match[0]);
    });
  }
  return identifiers;
};

export const listSpecFiles = (repoRoot) => {
  const specsRoot = join(repoRoot, 'openspec/specs');
  if (!existsSync(specsRoot)) return [];
  return readdirSync(specsRoot, { withFileTypes: true })
    .filter(
      (e) => e.isDirectory() && existsSync(join(specsRoot, e.name, 'spec.md')),
    )
    .map((e) => ({
      capability: e.name,
      file: `openspec/specs/${e.name}/spec.md`,
    }))
    .sort((a, b) => a.capability.localeCompare(b.capability));
};

/*
 * Returns the deduplicated path references of one spec (historical lines
 * excluded) — shared with scripts/spec-impact.mjs.
 */
export const specPathReferences = (markdown) => {
  const seen = new Map();
  for (const span of extractSpans(markdown)) {
    if (isHistorical(span)) continue;
    const normalized = normalizePath(span.text.replace(/[;,.]+$/, ''));
    if (normalized && !seen.has(normalized.path))
      seen.set(normalized.path, normalized);
  }
  return [...seen.values()];
};

/* ---------- validation ---------- */

/*
 * Checks one spec. `context` = { repoRoot, i18nKeys, i18nNamespaces,
 * identifiers (Set | null), allowlist }. Returns findings
 * { severity, capability, file, line, kind, token, message }.
 */
export const checkSpec = ({ capability, file, markdown }, context) => {
  const findings = [];
  const reported = new Set();
  const add = (severity, span, kind, token, message) => {
    /* Identifier warnings are reported once per spec; the rest once per line. */
    const key = `${severity}:${kind}:${token}${kind === 'identifier' ? '' : `:${span.line}`}`;
    if (reported.has(key)) return;
    reported.add(key);
    findings.push({
      severity,
      capability,
      file,
      line: span.line,
      kind,
      token,
      message,
    });
  };

  for (const span of extractSpans(markdown)) {
    if (isHistorical(span)) continue;
    const ref = classifySpan(span, context.i18nNamespaces);
    if (!ref) continue;

    if (ref.kind === 'path') {
      if (ref.hasLineSuffix)
        add(
          'warning',
          span,
          'line-number',
          span.text,
          `\`${span.text}\` carries a line number — avoid line numbers in specs; name the file and symbol`,
        );
      if (findAllowlistEntry(context.allowlist, capability, ref.path)) continue;
      if (isBuildOutputPath(ref.path)) continue;
      if (!pathExists(context.repoRoot, ref))
        add(
          'error',
          span,
          'path',
          ref.path,
          `path \`${ref.path}\` does not exist${ref.isPattern ? ' (no file matches the pattern)' : ''}`,
        );
    } else if (ref.kind === 'i18n') {
      if (findAllowlistEntry(context.allowlist, capability, ref.token))
        continue;
      if (!i18nKeyExists(context.i18nKeys, ref.token))
        add(
          'error',
          span,
          'i18n',
          ref.token,
          `translation key \`${ref.token}\` is not in ${I18N_FILE}`,
        );
    } else if (ref.kind === 'identifier' && context.identifiers) {
      for (const token of ref.tokens) {
        if (context.identifiers.has(token)) continue;
        if (findAllowlistEntry(context.allowlist, capability, token)) continue;
        add(
          'warning',
          span,
          'identifier',
          token,
          `identifier \`${token}\` is not found under ${IDENTIFIER_ROOTS.join('/, ')}/`,
        );
      }
    }
  }
  return findings;
};

export const run = ({ repoRoot, identifiers: checkIdentifiers = true }) => {
  const configErrors = [];
  let allowlist = [];
  const allowlistPath = join(repoRoot, ALLOWLIST_FILE);
  if (existsSync(allowlistPath)) {
    try {
      const parsed = parseAllowlist(
        JSON.parse(readFileSync(allowlistPath, 'utf8')),
      );
      allowlist = parsed.entries;
      configErrors.push(...parsed.errors);
    } catch (e) {
      configErrors.push(`${ALLOWLIST_FILE}: invalid JSON: ${e.message}`);
    }
  }

  let i18nKeys = new Set();
  let i18nNamespaces = new Set();
  try {
    const en = JSON.parse(readFileSync(join(repoRoot, I18N_FILE), 'utf8'));
    i18nKeys = flattenKeys(en);
    i18nNamespaces = new Set(Object.keys(en));
  } catch {
    /* no locale file: i18n checks are skipped */
  }

  const context = {
    repoRoot,
    i18nKeys,
    i18nNamespaces,
    identifiers: checkIdentifiers ? buildIdentifierIndex(repoRoot) : null,
    allowlist,
  };

  const specs = listSpecFiles(repoRoot);
  const findings = specs.flatMap((spec) =>
    checkSpec(
      { ...spec, markdown: readFileSync(join(repoRoot, spec.file), 'utf8') },
      context,
    ),
  );
  const unused = allowlist
    .filter((e) => !e.used)
    .map((e) => ({
      severity: 'warning',
      capability: null,
      file: ALLOWLIST_FILE,
      line: null,
      kind: 'allowlist',
      token: e.reference,
      message: `allowlist entry \`${e.reference}\`${e.spec ? ` (spec ${[e.spec].flat().join(', ')})` : ''} matches nothing — remove it`,
    }));
  return {
    specs: specs.length,
    configErrors,
    findings: [...findings, ...unused],
  };
};

/* ---------- reporting ---------- */

export const formatReport = ({ specs, configErrors, findings }) => {
  const lines = [];
  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');
  const byFile = new Map();
  for (const finding of findings) {
    if (!byFile.has(finding.file)) byFile.set(finding.file, []);
    byFile.get(finding.file).push(finding);
  }
  for (const [file, group] of byFile) {
    lines.push(file);
    group
      .sort((a, b) =>
        a.severity === b.severity
          ? (a.line ?? 0) - (b.line ?? 0)
          : a.severity === 'error'
            ? -1
            : 1,
      )
      .forEach((f) =>
        lines.push(
          `  ${f.line ? `${file}:${f.line}` : file}: ${f.severity}: ${f.message}`,
        ),
      );
  }
  configErrors.forEach((e) => lines.push(`error: ${e}`));
  lines.push(
    '',
    `spec references: ${specs} specs, ${errors.length + configErrors.length} error(s), ${warnings.length} warning(s)`,
  );
  if (errors.length || configErrors.length)
    lines.push(
      'Fix the spec (the code is the source of truth), or add a justified entry to',
      `${ALLOWLIST_FILE}. See .claude/rules/docs.md "Spec references".`,
    );
  return lines.join('\n');
};

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const args = new Set(process.argv.slice(2));
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const result = run({ repoRoot, identifiers: !args.has('--no-identifiers') });
  const failed =
    result.configErrors.length > 0 ||
    result.findings.some((f) => f.severity === 'error');
  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    (failed ? console.error : console.log)(formatReport(result));
  }
  process.exit(failed ? 1 : 0);
}
