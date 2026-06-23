#!/usr/bin/env node
// Validates AI-assistant configuration so broken or internally inconsistent
// rules, skills, commands, settings, and MCP config cannot land unnoticed.
// Shared by the pre-commit gate and the Claude PostToolUse hook.
//
// Usage: node scripts/validate-agent-docs.mjs <file...>
//        node scripts/validate-agent-docs.mjs
// Exit 0 = clean. Exit 1 = problems listed on stderr.
//
// With no file arguments, every tracked agent-config location is validated.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { parse } from 'yaml';
import * as prettier from 'prettier';

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

const AGENT_CONFIG_DIRECTORIES = [
  '.agents/skills',
  '.claude/commands',
  '.claude/rules',
  '.claude/skills',
  '.cursor/rules',
];
const AGENT_CONFIG_FILES = [
  '.claude/settings.json',
  '.mcp.json',
  'AGENTS.md',
  'CLAUDE.md',
  'openspec/config.yaml',
];
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.nx',
  'coverage',
  'dist',
  'node_modules',
  'tmp',
]);

const listFiles = (directory) => {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) return [];

    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? listFiles(path) : [path];
  });
};

const allAgentConfigFiles = () => [
  ...AGENT_CONFIG_FILES.filter(existsSync),
  ...AGENT_CONFIG_DIRECTORIES.flatMap(listFiles).filter((file) =>
    ['.md', '.mdc'].includes(extname(file)),
  ),
];

const lineNumberAt = (src, index) => src.slice(0, index).split(/\r?\n/).length;

const classify = (f) =>
  f.endsWith('.json')
    ? 'json'
    : f.endsWith('config.yaml')
      ? 'config'
      : f.includes('/.claude/skills/') ||
          f.includes('.claude/skills/') ||
          f.includes('/.agents/skills/') ||
          f.includes('.agents/skills/')
        ? 'skill'
        : f.includes('/.claude/commands/') || f.includes('.claude/commands/')
          ? 'command'
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

const checkFileReferences = (src, file) => {
  for (const match of src.matchAll(/^@([^\s]+)\s*$/gm)) {
    const referencedPath = match[1];
    if (!existsSync(resolve(referencedPath))) {
      fail(
        file,
        `line ${lineNumberAt(src, match.index)} references missing file \`${referencedPath}\``,
      );
    }
  }
};

const checkNxCommands = (src, file) => {
  // `.agents/skills` is managed by the Nx plugin and intentionally keeps its
  // package-manager-neutral examples. Enforce the repository convention only
  // in project-owned instructions.
  if (file.includes('.agents/skills/')) return;

  for (const match of src.matchAll(/\bnpx nx\b/g)) {
    fail(
      file,
      `line ${lineNumberAt(src, match.index)} uses \`npx nx\`; use \`npm exec nx\``,
    );
  }
};

const checkMcpVersions = (config, file) => {
  for (const [name, server] of Object.entries(config.mcpServers ?? {})) {
    for (const argument of server.args ?? []) {
      if (typeof argument === 'string' && argument.endsWith('@latest')) {
        fail(
          file,
          `MCP server \`${name}\` uses floating package version \`${argument}\`; pin an exact version`,
        );
      }
    }
  }
};

const readTailwindBreakpoints = () => {
  const configPath = 'tailwind.config.js';
  if (!existsSync(configPath)) return new Set();

  const src = readFileSync(configPath, 'utf8');
  const screensBlock = /screens:\s*\{([\s\S]*?)\n\s*\},/.exec(src)?.[1] ?? '';
  return new Set(
    [...screensBlock.matchAll(/^\s*([A-Za-z][\w-]*):/gm)].map(
      (match) => match[1],
    ),
  );
};

const checkSourceBreakpoints = () => {
  const allowedBreakpoints = readTailwindBreakpoints();
  if (allowedBreakpoints.size === 0) return;

  const sourceFiles = ['apps', 'libs']
    .flatMap(listFiles)
    .filter((file) =>
      ['.css', '.js', '.jsx', '.scss', '.ts', '.tsx'].includes(extname(file)),
    );
  const projectBreakpointPattern =
    /\b(mobile|desktop|[A-Za-z][\w-]*(?:_tablet|_desktop)):/g;

  for (const file of sourceFiles) {
    const src = readFileSync(file, 'utf8');
    for (const match of src.matchAll(projectBreakpointPattern)) {
      if (!allowedBreakpoints.has(match[1])) {
        fail(
          file,
          `line ${lineNumberAt(src, match.index)} uses unknown Tailwind breakpoint \`${match[1]}:\``,
        );
      }
    }
  }
};

const checkUniqueClaudeSkillNames = (skillNames) => {
  const seen = new Map();
  for (const { file, name } of skillNames) {
    if (!file.includes('.claude/skills/')) continue;

    const previousFile = seen.get(name);
    if (previousFile) {
      fail(file, `skill name \`${name}\` duplicates ${previousFile}`);
    } else {
      seen.set(name, file);
    }
  }
};

const files =
  process.argv.length > 2 ? process.argv.slice(2) : allAgentConfigFiles();
const skillNames = [];

for (const file of files) {
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    continue; // deleted/missing path — nothing to validate
  }

  await checkFormatting(src, file);

  const kind = classify(file);

  if (kind === 'json') {
    try {
      const config = JSON.parse(src);
      if (file.endsWith('.mcp.json')) checkMcpVersions(config, file);
    } catch (e) {
      fail(file, `JSON: ${e.message}`);
    }
    continue;
  }

  if (kind === 'config') {
    try {
      parse(src);
    } catch (e) {
      fail(file, `YAML: ${e.message}`);
    }
    continue;
  }

  checkFileReferences(src, file);
  checkNxCommands(src, file);

  const fm = frontmatter(src, file);
  if (fm === undefined) continue; // malformed — already reported
  if (fm === null) continue; // no frontmatter — valid for rules/docs

  if (kind === 'skill') {
    if (!fm.name) fail(file, 'skill frontmatter missing `name`');
    if (!fm.description) fail(file, 'skill frontmatter missing `description`');
    if (fm.name) skillNames.push({ file, name: fm.name });
  }

  if (kind === 'command') {
    if (!fm.name) fail(file, 'command frontmatter missing `name`');
    if (!fm.description)
      fail(file, 'command frontmatter missing `description`');
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

checkUniqueClaudeSkillNames(skillNames);
checkSourceBreakpoints();

if (errors.length) {
  console.error(
    'Agent-config validation failed:\n' +
      errors.map((e) => `  ${e}`).join('\n'),
  );
  process.exit(1);
}
