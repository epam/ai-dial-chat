import { readFileSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const STATIC_RELATIVE_MODULE_REFERENCE =
  /^(?:import(?:[^'"\n]*\sfrom\s*)?|export[^'"\n]*\sfrom\s*)['"](\.[^'"]+)['"];?/gm;

export const collectStaticImportClosure = (entryPath: string): string[] => {
  const visited = new Set<string>();

  const visit = (filePath: string) => {
    if (visited.has(filePath)) return;
    visited.add(filePath);

    const contents = readFileSync(filePath, 'utf-8');
    for (const match of contents.matchAll(STATIC_RELATIVE_MODULE_REFERENCE)) {
      const importedPath = resolve(dirname(filePath), match[1]);
      if (extname(importedPath) === '.js') visit(importedPath);
    }
  };

  visit(entryPath);
  return [...visited];
};

export const measureFiles = (filePaths: string[]) =>
  filePaths.reduce(
    (total, filePath) => {
      const contents = readFileSync(filePath);
      return {
        raw: total.raw + statSync(filePath).size,
        gzip: total.gzip + gzipSync(contents).length,
      };
    },
    { raw: 0, gzip: 0 },
  );
