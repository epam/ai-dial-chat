import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * `entry-points.spec.ts` already guards that `index.ts` and every
 * `entry-points/*.ts` barrel re-export the exact same declarations. This
 * file is a narrower, purpose-named regression guard for
 * `extract-reusable-chat-workflows`: it names the two new reusable-workflow
 * exports explicitly, so a future rename/removal fails here with a message
 * that says which workflow broke, rather than only the generic barrel-drift
 * message the other spec would give.
 *
 * Statically parses `export * from '<specifier>'` declarations (no module
 * execution — see `entry-points.spec.ts`'s own doc comment for why a dynamic
 * `import()` of these barrels is avoided).
 */

const srcDir = join(__dirname, '..', '..');
const entryPointsDir = join(srcDir, 'entry-points');

const parseReExportTargets = (filePath: string): string[] => {
  const text = readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const targets: string[] = [];

  sourceFile.forEachChild((node) => {
    if (!ts.isExportDeclaration(node) || !node.moduleSpecifier) return;
    if (!ts.isStringLiteral(node.moduleSpecifier)) return;
    if (node.exportClause) return; // only bare `export * from '...'`
    targets.push(node.moduleSpecifier.text);
  });

  return targets;
};

const indexTargets = parseReExportTargets(join(srcDir, 'index.ts'));
const skillEditorTargets = parseReExportTargets(
  join(entryPointsDir, 'skill-editor.ts'),
);
const fileManagerTargets = parseReExportTargets(
  join(entryPointsDir, 'file-manager.ts'),
);

describe('reusable-workflow exports (extract-reusable-chat-workflows)', () => {
  it('exports useSkillArchiveImport from the package root', () => {
    expect(indexTargets).toContain(
      './skill/useSkillArchiveImport/useSkillArchiveImport',
    );
  });

  it('exports useSkillArchiveImport from the ./skill-editor entry', () => {
    expect(skillEditorTargets).toContain(
      '../skill/useSkillArchiveImport/useSkillArchiveImport',
    );
  });

  it('exports useFileAttachmentPicker from the package root', () => {
    expect(indexTargets).toContain(
      './files/useFileAttachmentPicker/useFileAttachmentPicker',
    );
  });

  it('exports useFileAttachmentPicker from the ./file-manager entry', () => {
    expect(fileManagerTargets).toContain(
      '../files/useFileAttachmentPicker/useFileAttachmentPicker',
    );
  });

  it('declares every named export the useSkillArchiveImport module makes public', () => {
    const modulePath = join(
      srcDir,
      'skill',
      'useSkillArchiveImport',
      'useSkillArchiveImport.ts',
    );
    const text = readFileSync(modulePath, 'utf-8');
    for (const name of [
      'useSkillArchiveImport',
      'SkillArchiveImportStatus',
      'SkillArchiveImportErrorKind',
      'SkillArchiveSelectionRejectionReason',
      'classifySkillArchiveImportError',
      'UseSkillArchiveImportOptions',
      'UseSkillArchiveImportResult',
    ]) {
      expect(text).toContain(`export`);
      expect(
        new RegExp(`export (const|enum|interface) ${name}\\b`).test(text),
      ).toBe(true);
    }
  });

  it('declares every named export the useFileAttachmentPicker module makes public', () => {
    const modulePath = join(
      srcDir,
      'files',
      'useFileAttachmentPicker',
      'useFileAttachmentPicker.ts',
    );
    const text = readFileSync(modulePath, 'utf-8');
    for (const name of [
      'useFileAttachmentPicker',
      'UseFileAttachmentPickerOptions',
      'UseFileAttachmentPickerResult',
    ]) {
      expect(new RegExp(`export (const|interface) ${name}\\b`).test(text)).toBe(
        true,
      );
    }
  });
});

describe('prompt workflow introduces no eager file-manager/editor/canvas dependency', () => {
  const promptsManifest = JSON.parse(
    readFileSync(
      join(dirname(srcDir), '..', 'prompts', 'package.json'),
      'utf-8',
    ),
  ) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

  const FORBIDDEN_PACKAGES = [
    '@epam/ai-dial-react-file-manager',
    '@epam/ai-dial-skill-editor',
    '@epam/ai-dial-attachment-canvas',
    '@monaco-editor/react',
    'monaco-editor',
    '@uiw/react-md-editor',
    'ag-grid-community',
  ];

  it.each(FORBIDDEN_PACKAGES)(
    '@epam/ai-dial-prompts does not declare %s as a dependency or peer',
    (packageName) => {
      expect(promptsManifest.dependencies ?? {}).not.toHaveProperty(
        packageName,
      );
      expect(promptsManifest.peerDependencies ?? {}).not.toHaveProperty(
        packageName,
      );
    },
  );
});

describe('no cross-package proxy exports for the reusable workflows', () => {
  /*
   * `libs/skills` and `libs/prompts` must not forward chat-hooks' new
   * exports (or each other's), and chat-hooks must not forward skills'/
   * prompts' — every new export has exactly one owning package.
   */
  const readIndex = (libDir: string) =>
    readFileSync(
      join(dirname(srcDir), '..', libDir, 'src', 'index.ts'),
      'utf-8',
    );

  it('libs/skills does not re-export chat-hooks reusable-workflow symbols', () => {
    const text = readIndex('skills');
    expect(text).not.toContain('useSkillArchiveImport');
    expect(text).not.toContain('useFileAttachmentPicker');
  });

  it('libs/prompts does not re-export chat-hooks reusable-workflow symbols', () => {
    const text = readIndex('prompts');
    expect(text).not.toContain('useSkillArchiveImport');
    expect(text).not.toContain('useFileAttachmentPicker');
  });

  it('chat-hooks does not re-export SkillArchiveUploadDialog or usePromptSelectorOverlay', () => {
    const text = readFileSync(join(srcDir, 'index.ts'), 'utf-8');
    expect(text).not.toContain('SkillArchiveUploadDialog');
    expect(text).not.toContain('usePromptSelectorOverlay');
  });
});
