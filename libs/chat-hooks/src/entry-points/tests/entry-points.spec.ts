import { readFileSync, readdirSync } from 'fs';
import { dirname, join, posix } from 'path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * Guards against `entry-points/*.ts` drifting from `index.ts` (design.md
 * Risk 1): a new export added to a domain folder but forgotten in its owning
 * entry-point barrel, or a barrel that re-exports a target `index.ts` doesn't.
 *
 * This statically parses each barrel's `export ... from '<specifier>'`
 * declarations (no module execution — a dynamic `import()` of the root
 * barrel would eagerly load every peer's real implementation, including
 * heavy/optional ones like the attachment-canvas PDF viewer, which is far
 * more than this check needs) and compares the resulting declaration set
 * between `index.ts` and the union of every `entry-points/*.ts` file. Each
 * entry-point barrel is a verbatim copy of the subset of `index.ts`'s
 * re-export statements it owns, so the two sets are expected to be exactly
 * equal — not merely subset/superset.
 */

const srcDir = join(__dirname, '..', '..');
const entryPointsDir = join(srcDir, 'entry-points');

interface ExportDecl {
  /** The re-exported module's path, normalized relative to `src/`. */
  target: string;
  /** `'*'` for `export * from '...'`, else the sorted local export names. */
  names: '*' | string[];
}

const parseExportDecls = (filePath: string): ExportDecl[] => {
  const text = readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const fileDir = dirname(filePath);
  const decls: ExportDecl[] = [];

  sourceFile.forEachChild((node) => {
    if (!ts.isExportDeclaration(node) || !node.moduleSpecifier) return;
    if (!ts.isStringLiteral(node.moduleSpecifier)) return;

    const specifier = node.moduleSpecifier.text;
    const target = specifier.startsWith('.')
      ? posix
          .relative(
            srcDir.replace(/\\/g, '/'),
            join(fileDir, specifier).replace(/\\/g, '/'),
          )
          .replace(/\\/g, '/')
      : specifier;

    if (!node.exportClause) {
      decls.push({ target, names: '*' });
      return;
    }
    if (ts.isNamedExports(node.exportClause)) {
      const names = node.exportClause.elements
        .map((element) => element.name.text)
        .sort();
      decls.push({ target, names });
    }
  });

  return decls;
};

const declKey = (decl: ExportDecl): string =>
  `${decl.target}::${decl.names === '*' ? '*' : decl.names.join(',')}`;

describe('entry-point barrels stay in sync with the root barrel', () => {
  const indexDecls = parseExportDecls(join(srcDir, 'index.ts'));
  const indexKeys = new Set(indexDecls.map(declKey));

  const entryPointFiles = readdirSync(entryPointsDir).filter((file) =>
    file.endsWith('.ts'),
  );
  expect(
    entryPointFiles.length,
    'expected 14 entry-point barrels under src/entry-points/',
  ).toBe(14);

  const entryDeclsByFile = new Map(
    entryPointFiles.map((file) => [
      file,
      parseExportDecls(join(entryPointsDir, file)),
    ]),
  );

  it('every entry-point barrel re-exports a target index.ts also re-exports, with the same shape', () => {
    for (const [file, decls] of entryDeclsByFile) {
      const unknown = decls.map(declKey).filter((key) => !indexKeys.has(key));
      expect(
        unknown,
        `"${file}" re-exports something index.ts doesn't (same target+shape): ${unknown.join(', ')}`,
      ).toEqual([]);
    }
  });

  it('the union of every entry-point barrel covers every re-export index.ts declares', () => {
    const unionKeys = new Set<string>();
    for (const decls of entryDeclsByFile.values()) {
      for (const decl of decls) unionKeys.add(declKey(decl));
    }

    const missing = [...indexKeys].filter((key) => !unionKeys.has(key));
    expect(
      missing,
      `index.ts re-exports not covered by any entry-point barrel: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('no re-export target is claimed by more than one entry-point barrel', () => {
    const owners = new Map<string, string[]>();
    for (const [file, decls] of entryDeclsByFile) {
      for (const decl of decls) {
        const key = declKey(decl);
        owners.set(key, [...(owners.get(key) ?? []), file]);
      }
    }

    const duplicates = [...owners.entries()].filter(
      ([, files]) => files.length > 1,
    );
    expect(
      duplicates,
      `re-export declared by more than one entry-point barrel: ${duplicates
        .map(([key, files]) => `${key} in [${files.join(', ')}]`)
        .join('; ')}`,
    ).toEqual([]);
  });
});
