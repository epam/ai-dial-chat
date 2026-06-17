#!/usr/bin/env node
// Validates AI-assistant config files so a broken rule/skill/config.yaml/AGENTS.md
// can never land unnoticed. Shared by the pre-commit gate and the Claude PostToolUse hook.
//
// Usage: node scripts/validate-agent-docs.mjs <file...>
// Exit 0 = clean. Exit 1 = problems listed on stderr.
//
// Three checks
//   1. formatting     — prettier (skips files matched by .prettierignore)
//   2. YAML parse      — config.yaml and every Markdown frontmatter block parse cleanly
//   3. required keys   — skills need name+description; rule `paths` (if present) must be a list

import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import * as prettier from 'prettier';

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

const classify = (f) =>
  f.endsWith('config.yaml')
    ? 'config'
    : f.includes('/.claude/skills/') || f.includes('.claude/skills/')
      ? 'skill'
      : f.includes('/.claude/rules/') || f.includes('.claude/rules/')
        ? 'rule'
        : 'doc'; // AGENTS.md / CLAUDE.md

// Returns the parsed frontmatter object, null when there is none (valid for
// rules/docs), or undefined when the block is malformed (error already recorded).
const frontmatter = (src, file) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src);
  if (!match) {
    if (src.startsWith('---')) {
      fail(file, 'unterminated frontmatter block');
      return undefined;
    }
    return null; // no frontmatter at all — fine for rules/docs
  }
  try {
    return parse(match[1]) ?? {};
  } catch (e) {
    fail(file, `frontmatter YAML: ${e.message}`);
    return undefined;
  }
};

const checkFormatting = async (src, file) => {
  const info = await prettier.getFileInfo(file, {
    ignorePath: '.prettierignore',
    resolveConfig: true,
  });
  if (info.ignored || !info.inferredParser) return; // prettier wouldn't format it
  const config = (await prettier.resolveConfig(file)) ?? {};
  let formatted = false;
  try {
    formatted = await prettier.check(src, { ...config, filepath: file });
  } catch (e) {
    fail(file, `prettier could not parse: ${e.message}`);
    return;
  }
  if (!formatted) fail(file, 'prettier --check failed (run `npm run format`)');
};

for (const file of process.argv.slice(2)) {
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    continue; // deleted/missing path — nothing to validate
  }

  await checkFormatting(src, file);

  const kind = classify(file);

  if (kind === 'config') {
    try {
      parse(src);
    } catch (e) {
      fail(file, `YAML: ${e.message}`);
    }
    continue;
  }

  const fm = frontmatter(src, file);
  if (fm === undefined) continue; // malformed — already reported
  if (fm === null) continue; // no frontmatter — valid for rules/docs

  if (kind === 'skill') {
    if (!fm.name) fail(file, 'skill frontmatter missing `name`');
    if (!fm.description) fail(file, 'skill frontmatter missing `description`');
  }

  // Cross-agent scoping keys share one canonical frontmatter block (see findings.md
  // "cross-agent rules sharing"). Each agent reads its own key; we enforce the shape
  // the plan decided on so the dialects stay in sync. Checks fire only when a key exists.
  if (fm.paths !== undefined && !Array.isArray(fm.paths)) {
    fail(file, '`paths` (Claude) must be a list'); // YAML list of globs
  }
  if (fm.globs !== undefined && typeof fm.globs !== 'string') {
    fail(file, '`globs` (Cursor) must be a comma-separated string');
  }
  if (fm.applyTo !== undefined && typeof fm.applyTo !== 'string') {
    fail(file, '`applyTo` (Copilot) must be a comma-separated string');
  }
  if (fm.alwaysApply !== undefined && typeof fm.alwaysApply !== 'boolean') {
    fail(file, '`alwaysApply` (Cursor) must be a boolean');
  }
}

if (errors.length) {
  console.error(
    'Agent-config validation failed:\n' +
      errors.map((e) => `  ${e}`).join('\n'),
  );
  process.exit(1);
}
