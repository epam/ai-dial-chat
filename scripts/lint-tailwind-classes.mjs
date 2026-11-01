#!/usr/bin/env node

/* Claude Code PostToolUse hook: after an Edit/Write to a .ts/.tsx file under
   apps/ or libs/, run only `tailwindcss/enforces-canonical-classname` on it.
   Exit 2 sends the messages back to the agent so it rewrites v3 spellings
   in the same turn instead of waiting for `lint:check` or CI. */
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { ESLint } from 'eslint';

const RULE_ID = 'tailwindcss/enforces-canonical-classname';
const workspaceRoot = resolve(import.meta.dirname, '..');

const readFilePath = () => {
  try {
    return JSON.parse(readFileSync(0, 'utf8')).tool_input?.file_path ?? '';
  } catch {
    return '';
  }
};

const filePath = readFilePath();
const relativePath = relative(workspaceRoot, filePath).replaceAll('\\', '/');

if (!/^(apps|libs)\/.+\.tsx?$/.test(relativePath)) process.exit(0);

const eslint = new ESLint({
  cwd: workspaceRoot,
  ruleFilter: ({ ruleId }) => ruleId === RULE_ID,
});
const [result] = await eslint.lintFiles([filePath]);
const problems = (result?.messages ?? []).filter(
  (message) => message.ruleId === RULE_ID,
);

if (!problems.length) process.exit(0);

console.error(
  [
    `${relativePath}: non-canonical Tailwind classes (lint error):`,
    ...problems.map(
      (message) => `  ${message.line}:${message.column}  ${message.message}`,
    ),
  ].join('\n'),
);
process.exit(2);
