#!/usr/bin/env node
/*
 * Lists every place in libs/* where a color does not come from a `*Colors`
 * prop through a CSS custom property. It only finds candidates — every hit
 * still has to be read in context (see SKILL.md).
 *
 *   node .claude/skills/lib-colors/scan-colors.mjs                    # all libs
 *   node .claude/skills/lib-colors/scan-colors.mjs skill-editor chat-shared
 *   node .claude/skills/lib-colors/scan-colors.mjs --base origin/development
 *   node .claude/skills/lib-colors/scan-colors.mjs --json
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const LIBS_DIR = join(ROOT, 'libs');
const KIT_CSS = join(ROOT, 'node_modules/@epam/ai-dial-ui-kit/dist/index.css');

/* Generated client and pure-data libs render nothing. */
const SKIPPED_LIBS = new Set(['chat-api-client']);

const args = process.argv.slice(2);
const isJson = args.includes('--json');
const baseIndex = args.indexOf('--base');
const base = baseIndex === -1 ? null : args[baseIndex + 1];
const libFilter = args.filter(
  (arg, i) =>
    !arg.startsWith('--') && (baseIndex === -1 || i !== baseIndex + 1),
);

const COLOR_PROPERTY_RE =
  /^(color|background|background-color|border(-(top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?(-color)?|outline(-color)?|fill|stroke|caret-color|text-decoration-color|accent-color|box-shadow|column-rule-color)$/;

const COLOR_DECL_IN_KIT_RE =
  /(?:^|;)\s*(?:color|background-color|border(?:-[a-z-]+)?-color|outline-color|fill|stroke|--tw-ring-color|--tw-shadow-color|text-decoration-color|caret-color|accent-color)\s*:/;

const TAILWIND_PALETTE_RE =
  /^(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}$|^(white|black)$/;

const COLOR_UTILITY_PREFIX_RE =
  /^(text|bg|border(?:-[xytrblse])?|outline|ring|fill|stroke|divide|placeholder|decoration|caret|accent|from|via|to|shadow)-(.+)$/;

/* Not theme colors, so they may stay hardcoded. */
const NEUTRAL_VALUES = new Set(['transparent', 'inherit', 'current', 'none']);

const loadKitColorClasses = () => {
  const classes = new Set();
  if (!existsSync(KIT_CSS)) return classes;
  const css = readFileSync(KIT_CSS, 'utf8');
  for (const match of css.matchAll(/\.((?:[a-z0-9-]|\\.)+)\{([^{}]*)\}/g)) {
    const name = match[1].replace(/\\(.)/g, '$1');
    if (name.includes(':')) continue;
    if (COLOR_DECL_IN_KIT_RE.test(match[2])) classes.add(name);
  }
  return classes;
};

/* The kit CSS only holds classes the kit itself uses; the workspace Tailwind
   theme declares the full color set (`--background-color-error` → `bg-error`). */
const THEME_CSS = join(ROOT, 'tools/tailwind/theme.css');
const THEME_NAMESPACES = {
  color: [
    'text',
    'bg',
    'border',
    'outline',
    'ring',
    'fill',
    'stroke',
    'divide',
    'decoration',
    'caret',
    'accent',
    'from',
    'via',
    'to',
    'shadow',
    'placeholder',
  ],
  'background-color': ['bg'],
  'text-color': ['text'],
  'border-color': ['border', 'divide'],
  'outline-color': ['outline'],
  'ring-color': ['ring'],
  fill: ['fill'],
  stroke: ['stroke'],
};

const loadThemeColorClasses = (classes) => {
  if (!existsSync(THEME_CSS)) return classes;
  const css = readFileSync(THEME_CSS, 'utf8');
  for (const match of css.matchAll(/--([a-z0-9-]+)\s*:/g)) {
    for (const [namespace, prefixes] of Object.entries(THEME_NAMESPACES)) {
      if (!match[1].startsWith(`${namespace}-`)) continue;
      const name = match[1].slice(namespace.length + 1);
      for (const prefix of prefixes) classes.add(`${prefix}-${name}`);
    }
  }
  return classes;
};

const KIT_COLOR_CLASSES = loadThemeColorClasses(loadKitColorClasses());

const isColorUtility = (rawToken) => {
  const token = rawToken.replace(/^!/, '').split(':').pop().replace(/^!|!$/g, '');
  const match = COLOR_UTILITY_PREFIX_RE.exec(token);
  if (!match) return false;
  const value = match[2].replace(/\/\d+$/, '');
  if (NEUTRAL_VALUES.has(value)) return false;
  if (KIT_COLOR_CLASSES.has(token)) return true;
  if (TAILWIND_PALETTE_RE.test(value)) return true;
  return /^\[(#|var\(|rgb|hsl|color-mix|oklch)/.test(value);
};

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
      /\.(tsx|ts|scss|css)$/.test(entry) &&
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
  const output = execFileSync(
    'git',
    ['diff', '--name-only', `${base}...HEAD`],
    {
      encoding: 'utf8',
    },
  );
  const uncommitted = execFileSync('git', ['diff', '--name-only', 'HEAD'], {
    encoding: 'utf8',
  });
  return new Set(
    `${output}\n${uncommitted}`
      .split('\n')
      .filter(Boolean)
      .map((file) => join(ROOT, file)),
  );
};

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/* Blanks comments but keeps their newlines, so line numbers stay exact. */
const stripComments = (text) =>
  text.replace(
    /\/\*[\s\S]*?\*\/|(^|[^:'"`])\/\/[^\n]*/g,
    (c, prefix = '') => prefix + c.slice(prefix.length).replace(/[^\n]/g, ' '),
  );

/* Line by line rather than by string literal: an apostrophe in JSX text would
   otherwise shift the quote pairing and misplace or hide hits. */
const scanTsx = (file, text, findings) => {
  stripComments(text)
    .split('\n')
    .forEach((lineText, index) => {
      for (const raw of lineText.split(/[\s'"`{},;]+/)) {
        const token = raw.replace(/[)>]+$/, '');
        if (token && isColorUtility(token)) {
          findings.push({
            file,
            line: index + 1,
            signal: 'tailwind-color-class',
            detail: token,
          });
        }
      }
    });
};

/* The first `var()` is the outermost one, also inside a shorthand like `1px solid var(--x, …)`. */
const firstVarName = (value) => /var\(\s*(--[\w-]+)/.exec(value)?.[1];

const scanStyles = (file, text, findings, readVars) => {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, (c) =>
    c.replace(/[^\n]/g, ' '),
  );
  for (const match of clean.matchAll(/(^|[;{\s])([a-z-]+)\s*:\s*([^;{}]+);/g)) {
    const property = match[2];
    const value = match[3].trim();
    if (!COLOR_PROPERTY_RE.test(property)) continue;
    const line = lineOf(clean, match.index + match[1].length);
    const outerVar = firstVarName(value);
    if (outerVar) {
      readVars.push({ file, line, name: outerVar });
      continue;
    }
    /* No var at all: a literal color, possibly inside a shorthand or gradient. */
    const hasLiteralColor =
      /#[0-9a-f]{3,8}\b|\b(rgb|rgba|hsl|hsla|oklch|color-mix)\(/i.test(value) ||
      /\b(white|black|red|blue|green|gray|grey|orange|yellow|purple)\b/i.test(
        value,
      );
    if (hasLiteralColor) {
      findings.push({
        file,
        line,
        signal: 'literal-color',
        detail: `${property}: ${value}`,
      });
    }
  }
};

const collectSetVars = (text) => {
  const names = new Set();
  for (const call of text.matchAll(/buildCssVars\(\s*\{([\s\S]*?)\}\s*\)/g)) {
    for (const key of call[1].matchAll(/['"](--[\w-]+)['"]\s*:/g))
      names.add(key[1]);
  }
  /* Vars set directly on a style object, e.g. `{ '--x': value }`. */
  for (const key of text.matchAll(/['"](--[\w-]+)['"]\s*:/g)) names.add(key[1]);
  return names;
};

const libs = readdirSync(LIBS_DIR).filter(
  (lib) =>
    !SKIPPED_LIBS.has(lib) &&
    existsSync(join(LIBS_DIR, lib, 'src')) &&
    (libFilter.length === 0 || libFilter.includes(lib)),
);
const onlyFiles = changedFiles();
const report = [];

for (const lib of libs) {
  const files = walk(join(LIBS_DIR, lib, 'src'));
  const findings = [];
  const readVars = [];
  const setVars = new Set();

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (/\.(tsx|ts)$/.test(file)) {
      for (const name of collectSetVars(text)) setVars.add(name);
      if (file.endsWith('.tsx')) scanTsx(file, text, findings);
    } else {
      scanStyles(file, text, findings, readVars);
    }
  }

  /* An outer var no TS in the lib ever sets is a theme token, not a prop. */
  for (const read of readVars) {
    if (!setVars.has(read.name)) {
      findings.push({
        file: read.file,
        line: read.line,
        signal: 'var-not-set-from-props',
        detail: read.name,
      });
    }
  }

  const scoped = onlyFiles
    ? findings.filter((f) => onlyFiles.has(f.file))
    : findings;
  for (const finding of scoped) {
    report.push({
      lib,
      ...finding,
      file: relative(ROOT, finding.file).split(sep).join('/'),
    });
  }
}

if (isJson) {
  console.log(JSON.stringify(report, null, 2));
} else if (report.length === 0) {
  console.log(`No candidates in ${libs.length} lib(s).`);
} else {
  const bySignal = Map.groupBy
    ? Map.groupBy(report, (f) => f.signal)
    : report.reduce(
        (map, f) => map.set(f.signal, [...(map.get(f.signal) ?? []), f]),
        new Map(),
      );
  for (const [signal, items] of bySignal) {
    console.log(`\n## ${signal} (${items.length})`);
    for (const f of items) console.log(`${f.file}:${f.line}  ${f.detail}`);
  }
  const perLib = report.reduce(
    (acc, f) => ({ ...acc, [f.lib]: (acc[f.lib] ?? 0) + 1 }),
    {},
  );
  console.log('\n## per lib');
  for (const [lib, count] of Object.entries(perLib).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`${String(count).padStart(4)}  ${lib}`);
  }
  if (KIT_COLOR_CLASSES.size === 0) {
    console.log(
      '\n(kit CSS not found — only Tailwind palette and arbitrary colors were matched)',
    );
  }
}
