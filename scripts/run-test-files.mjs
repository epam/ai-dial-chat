#!/usr/bin/env node

import { existsSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = dirname(scriptDirectory);
const quietRunner = join(scriptDirectory, 'run-quiet.mjs');
const configNames = [
  'vite.config.mts',
  'vite.config.ts',
  'vitest.config.ts',
  'vitest.config.mts',
  'vitest.config.js',
];
const requestedPaths = process.argv.slice(2);

if (requestedPaths.length === 0) {
  console.error(
    'Usage: npm run test:file -- <workspace-relative-test-path> [more paths...]',
  );
  process.exit(2);
}

const toPosixPath = (value) => value.replaceAll('\\', '/');

const assertWorkspaceFile = (requestedPath) => {
  const absolutePath = resolve(workspaceRoot, requestedPath);
  const workspacePath = relative(workspaceRoot, absolutePath);

  if (
    workspacePath.startsWith('..') ||
    isAbsolute(workspacePath) ||
    !existsSync(absolutePath) ||
    !statSync(absolutePath).isFile()
  ) {
    throw new Error(
      `Test path must name an existing file inside the workspace: ${requestedPath}`,
    );
  }

  return absolutePath;
};

const findTestConfig = (absolutePath) => {
  let directory = dirname(absolutePath);

  while (directory !== workspaceRoot) {
    for (const configName of configNames) {
      const configPath = join(directory, configName);
      if (existsSync(configPath)) return configPath;
    }
    directory = dirname(directory);
  }

  throw new Error(
    `No Vite/Vitest config found for ${toPosixPath(relative(workspaceRoot, absolutePath))}`,
  );
};

const filesByConfig = new Map();

try {
  for (const requestedPath of requestedPaths) {
    const absolutePath = assertWorkspaceFile(requestedPath);
    const configPath = findTestConfig(absolutePath);
    const files = filesByConfig.get(configPath) ?? [];
    files.push(absolutePath);
    filesByConfig.set(configPath, files);
  }
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

for (const [configPath, absolutePaths] of filesByConfig) {
  const projectRoot = dirname(configPath);
  const projectName = toPosixPath(relative(workspaceRoot, projectRoot));
  const configArgument = toPosixPath(relative(workspaceRoot, configPath));
  const testArguments = absolutePaths.map((absolutePath) =>
    toPosixPath(relative(projectRoot, absolutePath)),
  );
  const result = spawnSync(
    process.execPath,
    [
      quietRunner,
      `test:file:${projectName}`,
      '--',
      'vitest',
      'run',
      '--config',
      configArgument,
      '--reporter=minimal',
      ...testArguments,
    ],
    {
      cwd: workspaceRoot,
      stdio: 'inherit',
    },
  );

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
