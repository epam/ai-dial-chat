/* ESLint formatter for GitHub Actions: stylish output for the log, plus
   `::warning`/`::error` annotations and a Step Summary table so every
   warning is visible on the PR, not only those inside a failed run's log. */
import { appendFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

const workspaceRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const escapeData = (value) =>
  value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

const escapeProperty = (value) =>
  escapeData(value).replace(/:/g, '%3A').replace(/,/g, '%2C');

const escapeCell = (value) =>
  value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

const toAnnotation = (file, message) => {
  const level = message.severity === 2 ? 'error' : 'warning';
  const properties = [
    `file=${escapeProperty(file)}`,
    `line=${message.line ?? 1}`,
    `col=${message.column ?? 1}`,
    message.endLine && `endLine=${message.endLine}`,
    message.endColumn && `endColumn=${message.endColumn}`,
    `title=${escapeProperty(message.ruleId ?? 'eslint')}`,
  ].filter(Boolean);
  return `::${level} ${properties.join(',')}::${escapeData(message.message)}`;
};

const toSummary = (project, rows, errorCount, warningCount) =>
  [
    `<details><summary><b>${project}</b>: ${errorCount} error(s), ${warningCount} warning(s)</summary>`,
    '',
    '| Location | Severity | Rule | Message |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    '</details>',
    '',
    '',
  ].join('\n');

export default async (results) => {
  const stylish = await new ESLint().loadFormatter('stylish');
  const output = [await stylish.format(results)];

  if (process.env.GITHUB_ACTIONS !== 'true') return output.join('\n');

  const annotations = [];
  const rows = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const result of results) {
    const file = relative(workspaceRoot, result.filePath).replaceAll('\\', '/');
    for (const message of result.messages) {
      if (message.severity === 2) errorCount += 1;
      else warningCount += 1;
      annotations.push(toAnnotation(file, message));
      rows.push(
        `| \`${file}:${message.line ?? 1}\` | ${message.severity === 2 ? 'error' : 'warning'} | \`${message.ruleId ?? 'eslint'}\` | ${escapeCell(message.message)} |`,
      );
    }
  }

  if (rows.length && process.env.GITHUB_STEP_SUMMARY) {
    const project =
      relative(workspaceRoot, process.cwd()).replaceAll('\\', '/') || '.';
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      toSummary(project, rows, errorCount, warningCount),
    );
  }

  return [...output, ...annotations].join('\n');
};
