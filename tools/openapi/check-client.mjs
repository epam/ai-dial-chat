import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const roots = [
  'libs/chat-api-client/src/generated/src/apis',
  'libs/chat-api-client/src/generated/src/models',
];

const findTypeScriptFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return findTypeScriptFiles(path);
      }
      return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
    }),
  );
  return nested.flat();
};

const files = (await Promise.all(roots.map(findTypeScriptFiles))).flat();
const violations = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const lines = source.split('\n');
  lines.forEach((line, index) => {
    if (/\bany\b/.test(line)) {
      violations.push(`${file}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error(
    [
      'Generated OpenAPI client contains endpoint-level any types.',
      'Fix Swagger DTOs/annotations or generator postprocessing, then run npm run openapi.',
      '',
      ...violations,
    ].join('\n'),
  );
  process.exitCode = 1;
}
