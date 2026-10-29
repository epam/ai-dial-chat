#!/usr/bin/env node
/*
 * Lists user-visible text that does not go through translation: in libs/*,
 * text that is not a `*Labels` prop with an English default; in apps/chat,
 * text that is not `t()` with a key from `translation-keys.ts`. It only
 * finds candidates — every hit still has to be read in context (see SKILL.md).
 *
 *   node .claude/skills/i18n-strings/scan.mjs                    # all libs + apps/chat
 *   node .claude/skills/i18n-strings/scan.mjs catalog chat       # some libs, `chat` = apps/chat
 *   node .claude/skills/i18n-strings/scan.mjs --base origin/development
 *   node .claude/skills/i18n-strings/scan.mjs --json
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const LIBS_DIR = join(ROOT, 'libs');
const APP_DIR = join(ROOT, 'apps/chat/src');
const APP = 'chat';

/* Generated client and pure-logic libs render no text. */
const SKIPPED_LIBS = new Set(['chat-api-client']);

const args = process.argv.slice(2);
const isJson = args.includes('--json');
const baseIndex = args.indexOf('--base');
const base = baseIndex === -1 ? null : args[baseIndex + 1];
const scopeFilter = args.filter(
  (arg, i) =>
    !arg.startsWith('--') && (baseIndex === -1 || i !== baseIndex + 1),
);

/* Props and attributes whose value a user reads or hears. */
const TEXT_ATTRS = [
  'title',
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'placeholder',
  'alt',
  'label',
  'tooltip',
  'ariaLabel',
  'description',
  'message',
  'caption',
  'emptyText',
  'emptyStateText',
  'confirmLabel',
  'cancelLabel',
  'heading',
  'subtitle',
];
const LITERAL_ATTR_RE = new RegExp(
  `(?:^|\\s)(${TEXT_ATTRS.join('|')})=(?:"([^"]*[A-Za-z][^"]*)"|\\{\\s*(['"\`])([^'"\`]*[A-Za-z][^'"\`]*)\\3\\s*\\})`,
  'g',
);
/* `{'Save'}` / `{"Save"}` as a JSX child. */
const JSX_STRING_CHILD_RE = />\s*\{\s*(['"`])([^'"`]*[A-Za-z][^'"`]*)\1\s*\}/g;
/* `>Save</`, `>Save {` or `} items <`. A `<` glued to a word (`Promise<T>`) is
   a generic, not JSX, and `=>` is an arrow, not a tag end. */
const JSX_INLINE_TEXT_RE =
  /(?:(?<!=)>|\})([^<>{}]*[A-Za-z][^<>{}]*?)(?=<\/|\s*\{|\s+<)/g;
const RAW_KEY_RE = /\bt\(\s*['"`]/g;
/* App only: `message: 'Name must not be blank.'` in an object (a label map,
   an error, a notification). In a lib the same shape is an English default. */
const LITERAL_TEXT_FIELD_RE = new RegExp(
  `(?:^|[\\s{,])(${TEXT_ATTRS.filter((a) => !a.includes('-')).join('|')}|text|errorMessage|[a-z]\\w*(?:Label|Title|Text|Message|Placeholder|Tooltip))\\s*:\\s*(['"\`])([A-Z][^'"\`]*\\s[^'"\`]*)\\2`,
  'g',
);
const I18N_IMPORT_RE = /from\s+['"](react-i18next|i18next)['"]/;

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (
        ['node_modules', 'dist', 'tests', '__tests__', 'stories'].includes(
          entry,
        )
      )
        continue;
      walk(full, out);
    } else if (
      /\.(tsx|ts)$/.test(entry) &&
      !/\.(spec|test|stories)\.[jt]sx?$/.test(entry) &&
      !entry.endsWith('.d.ts')
    ) {
      out.push(full);
    }
  }
  return out;
};

const changedFiles = () => {
  if (!base) return null;
  const run = (gitArgs) =>
    execFileSync('git', gitArgs, { encoding: 'utf8' }).split('\n');
  return new Set(
    [
      ...run(['diff', '--name-only', `${base}...HEAD`]),
      ...run(['diff', '--name-only', 'HEAD']),
    ]
      .filter(Boolean)
      .map((file) => join(ROOT, file)),
  );
};

/* Blanks comments but keeps their newlines, so line numbers stay exact. */
const stripComments = (text) =>
  text.replace(
    /\/\*[\s\S]*?\*\/|(^|[^:'"`])\/\/[^\n]*/g,
    (c, prefix = '') => prefix + c.slice(prefix.length).replace(/[^\n]/g, ' '),
  );

/* Text a person reads: has a letter, is not an identifier, path, class list or entity. */
const isProse = (raw) => {
  const text = raw.trim();
  if (!/[A-Za-z]/.test(text)) return false;
  if (/^&[a-z]+;$/.test(text)) return false;
  if (/^[\w.-]+$/.test(text) && !/^[A-Z][a-z]+$/.test(text)) return false;
  /* Code fragments: template literals, interpolation, operators, calls. */
  if (/[=;()[\]`$"|]|^\s*[.:,&?]/.test(text)) return false;
  if (/^[a-z]+(-[a-z0-9]+)+(\s+[a-z]+(-[a-z0-9]+)*)*$/.test(text)) return false;
  return true;
};

/* A line holding only prose between JSX lines (multi-line text children). */
const isStandaloneJsxText = (lines, index) => {
  const text = lines[index].trim();
  if (!/^[A-Z][^{}<>=;`'"]*[A-Za-z.!?:…)]$/.test(text) || !/\s/.test(text))
    return false;
  const previous = lines
    .slice(0, index)
    .reverse()
    .find((line) => line.trim() !== '');
  const next = lines.slice(index + 1).find((line) => line.trim() !== '');
  return (
    previous != null &&
    /(>|\})\s*$/.test(previous) &&
    next != null &&
    /^\s*(<|\{)/.test(next)
  );
};

const scanFile = (file, text, isApp, findings) => {
  const lines = stripComments(text).split('\n');
  const push = (line, signal, detail) =>
    findings.push({ file, line, signal, detail: detail.trim().slice(0, 80) });

  if (!isApp && I18N_IMPORT_RE.test(text)) {
    push(
      text.split('\n').findIndex((l) => I18N_IMPORT_RE.test(l)) + 1,
      'i18n-in-lib',
      'imports react-i18next / i18next',
    );
  }

  lines.forEach((lineText, index) => {
    const line = index + 1;
    const isTsx = file.endsWith('.tsx');

    if (isApp) {
      for (const match of lineText.matchAll(RAW_KEY_RE)) {
        push(line, 'raw-translation-key', lineText.slice(match.index));
      }
      for (const match of lineText.matchAll(LITERAL_TEXT_FIELD_RE)) {
        if (!match[3].includes('${')) {
          push(line, 'literal-text-field', `${match[1]}: '${match[3]}'`);
        }
      }
    }
    if (!isTsx) return;

    for (const match of lineText.matchAll(LITERAL_ATTR_RE)) {
      const value = match[2] ?? match[4];
      /* A template built from props (`${labels.x} ${n}`) is not a literal. */
      if (!value.includes('${')) {
        push(line, 'literal-text-attr', `${match[1]}="${value}"`);
      }
    }
    for (const match of lineText.matchAll(JSX_STRING_CHILD_RE)) {
      if (isProse(match[2])) push(line, 'jsx-literal-text', match[2]);
    }
    /* Skip TS type positions (`FC<Props>`, `Record<A, B>`), which share `<…>`. */
    if (
      !/^\s*(import|export\s+(type|interface)|type\s|interface\s)/.test(
        lineText,
      )
    ) {
      for (const match of lineText.matchAll(JSX_INLINE_TEXT_RE)) {
        /* Inside a quoted string (`'Version {version} is …'`), not JSX. */
        const quotesBefore = (
          lineText.slice(0, match.index).match(/['"`]/g) ?? []
        ).length;
        if (quotesBefore % 2 === 1) continue;
        if (isProse(match[1]) && /\s|^[A-Z]/.test(match[1].trim())) {
          push(line, 'jsx-literal-text', match[1]);
        }
      }
    }
    if (isStandaloneJsxText(lines, index)) {
      push(line, 'jsx-literal-text', lineText);
    }
  });
};

/* `*Labels` / `*Texts` fields of a lib the app renders but never fills in. */
const scanUntranslatedLabels = (lib, libFiles, appText, findings) => {
  const pkg = JSON.parse(
    readFileSync(join(LIBS_DIR, lib, 'package.json'), 'utf8'),
  ).name;
  if (!appText.includes(pkg)) return;
  for (const file of libFiles) {
    const text = readFileSync(file, 'utf8');
    const re =
      /export interface (\w*(?:Labels|Texts|AriaLabels))\b[^{]*\{([\s\S]*?)\n\}/g;
    for (const match of text.matchAll(re)) {
      const bodyStart = match.index + match[0].indexOf('{');
      for (const field of match[2].matchAll(/^\s+(\w+)\??\s*:([^\n]*)/gm)) {
        const name = field[1];
        /* Only text: `string`, or a formatter returning one. */
        if (!/\bstring\b|=>\s*string/.test(field[2])) continue;
        if (new RegExp(`\\b${name}\\b`).test(appText)) continue;
        findings.push({
          file,
          line: text.slice(0, bodyStart + field.index).split('\n').length + 1,
          signal: 'label-not-translated',
          detail: `${match[1]}.${name}`,
        });
      }
    }
  }
};

const libs = readdirSync(LIBS_DIR).filter(
  (lib) =>
    !SKIPPED_LIBS.has(lib) &&
    existsSync(join(LIBS_DIR, lib, 'src')) &&
    (scopeFilter.length === 0 || scopeFilter.includes(lib)),
);
const isAppInScope = scopeFilter.length === 0 || scopeFilter.includes(APP);
const appFiles = walk(APP_DIR);
const appText = appFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const onlyFiles = changedFiles();
const report = [];

const collect = (scope, findings) => {
  const scoped = onlyFiles
    ? findings.filter((f) => onlyFiles.has(f.file))
    : findings;
  for (const finding of scoped) {
    report.push({
      scope,
      ...finding,
      file: relative(ROOT, finding.file).split(sep).join('/'),
    });
  }
};

for (const lib of libs) {
  const files = walk(join(LIBS_DIR, lib, 'src'));
  const findings = [];
  for (const file of files) {
    scanFile(file, readFileSync(file, 'utf8'), false, findings);
  }
  scanUntranslatedLabels(lib, files, appText, findings);
  collect(lib, findings);
}

if (isAppInScope) {
  const findings = [];
  for (const file of appFiles) {
    scanFile(file, readFileSync(file, 'utf8'), true, findings);
  }
  collect(`apps/${APP}`, findings);
}

if (isJson) {
  console.log(JSON.stringify(report, null, 2));
} else if (report.length === 0) {
  console.log('No candidates.');
} else {
  const bySignal = new Map();
  for (const f of report) {
    bySignal.set(f.signal, [...(bySignal.get(f.signal) ?? []), f]);
  }
  for (const [signal, items] of bySignal) {
    console.log(`\n## ${signal} (${items.length})`);
    for (const f of items) console.log(`${f.file}:${f.line}  ${f.detail}`);
  }
  const perScope = report.reduce(
    (acc, f) => ({ ...acc, [f.scope]: (acc[f.scope] ?? 0) + 1 }),
    {},
  );
  console.log('\n## per scope');
  for (const [scope, count] of Object.entries(perScope).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`${String(count).padStart(4)}  ${scope}`);
  }
}
