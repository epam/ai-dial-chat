#!/usr/bin/env node

import { spawn } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = dirname(scriptDirectory);
const separatorIndex = process.argv.indexOf('--');

if (separatorIndex < 3 || separatorIndex === process.argv.length - 1) {
  console.error(
    'Usage: node scripts/run-quiet.mjs <label> -- <command> [arguments...]',
  );
  process.exit(2);
}

const label = process.argv[2];
const command = process.argv[separatorIndex + 1];
const commandArguments = process.argv.slice(separatorIndex + 2);
const safeLabel = label.replace(/[^a-zA-Z0-9._-]+/g, '-');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logDirectory = join(workspaceRoot, 'tmp', 'agent-logs');
const logPath = join(logDirectory, `${timestamp}-${safeLabel}.log`);
const displayLogPath = relative(workspaceRoot, logPath).replaceAll('\\', '/');
const maximumFailureLines = 120;

mkdirSync(logDirectory, { recursive: true });

const packageByCommand = {
  nx: 'nx',
  prettier: 'prettier',
  vitest: 'vitest',
};

const resolvePackageBinary = (binaryName) => {
  const packageName = packageByCommand[binaryName];
  if (!packageName) return null;

  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const binaryPath =
    typeof packageJson.bin === 'string'
      ? packageJson.bin
      : packageJson.bin?.[binaryName];

  if (!binaryPath) return null;

  const resolvedBinaryPath = resolve(dirname(packageJsonPath), binaryPath);
  return existsSync(resolvedBinaryPath) ? resolvedBinaryPath : null;
};

const packageBinary = resolvePackageBinary(command);
const executable = packageBinary ? process.execPath : command;
const executableArguments = packageBinary
  ? [packageBinary, ...commandArguments]
  : commandArguments;
const startedAt = performance.now();
const logStream = createWriteStream(logPath, { flags: 'wx' });
const tailLines = [];
let incompleteLine = '';
let suppressedCarriageReturnDiagnostics = 0;

const rememberLine = (line) => {
  if (line.includes('Delete `␍`')) {
    suppressedCarriageReturnDiagnostics += 1;
    return;
  }

  tailLines.push(line);
  if (tailLines.length > maximumFailureLines) {
    tailLines.splice(0, tailLines.length - maximumFailureLines);
  }
};

const rememberOutput = (chunk) => {
  logStream.write(chunk);

  const lines = `${incompleteLine}${chunk.toString('utf8')}`.split(/\r?\n/);
  incompleteLine = lines.pop() ?? '';
  lines.forEach(rememberLine);
};

const formatDuration = () =>
  `${((performance.now() - startedAt) / 1000).toFixed(1)}s`;
const stripAnsi = (value) =>
  value.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g,
    '',
  );

console.log(`RUN ${label} (full log: ${displayLogPath})`);

const child = spawn(executable, executableArguments, {
  cwd: workspaceRoot,
  env: {
    ...process.env,
    FORCE_COLOR: '0',
    NO_COLOR: '1',
  },
  stdio: ['inherit', 'pipe', 'pipe'],
});

child.stdout.on('data', rememberOutput);
child.stderr.on('data', rememberOutput);

child.on('error', (error) => {
  logStream.end();
  console.error(`FAIL ${label} (${formatDuration()}): ${error.message}`);
  console.error(`Full log: ${displayLogPath}`);
  process.exitCode = 1;
});

child.on('close', (code, signal) => {
  if (incompleteLine) rememberLine(incompleteLine);
  logStream.end();

  if (code === 0) {
    console.log(`PASS ${label} (${formatDuration()})`);
    return;
  }

  const status = signal ? `signal ${signal}` : `exit ${code ?? 1}`;
  console.error(`FAIL ${label} (${status}, ${formatDuration()})`);

  const seenLines = new Set();
  const uniqueTailLines = tailLines.filter((line) => {
    const normalizedLine = stripAnsi(line).trimEnd();
    if (!normalizedLine || seenLines.has(normalizedLine)) return false;
    seenLines.add(normalizedLine);
    return true;
  });
  const excerpt = stripAnsi(uniqueTailLines.join('\n')).trim();
  if (suppressedCarriageReturnDiagnostics > 0) {
    console.error(
      `Suppressed ${suppressedCarriageReturnDiagnostics} repetitive CRLF formatting diagnostics.`,
    );
  }
  if (excerpt) {
    console.error(
      `--- failure excerpt (up to ${maximumFailureLines} lines) ---`,
    );
    console.error(excerpt);
    console.error('--- end excerpt ---');
  }

  console.error(`Full log: ${displayLogPath}`);
  process.exitCode = code ?? 1;
});
