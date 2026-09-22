import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const libraryRoot = resolve(import.meta.dirname, '../..');

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'tests' ? [] : sourceFiles(path);
    }
    return /\.(?:ts|tsx)$/.test(entry.name) &&
      !/\.spec\.(?:ts|tsx)$/.test(entry.name)
      ? [path]
      : [];
  });

const readSources = (root: string) =>
  sourceFiles(resolve(root, 'src')).map((path) => readFileSync(path, 'utf8'));

describe('scheduled-tasks public distribution contract', () => {
  it('exports the emitted stylesheet from the documented public subpath', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(libraryRoot, 'package.json'), 'utf8'),
    ) as { exports: Record<string, string> };

    expect(manifest.exports['./styles.css']).toBe('./dist/index.css');
  });

  it('bundles builder-form structural styles into the scheduler stylesheet entry', () => {
    const entry = readFileSync(resolve(libraryRoot, 'src/index.ts'), 'utf8');
    const builderStyles = readFileSync(
      resolve(libraryRoot, '../builder-form/src/styles.css'),
      'utf8',
    );

    expect(entry).toContain('../../builder-form/src/styles.css');
    expect(builderStyles).toContain('BuilderFormHeader.module.scss');
    expect(builderStyles).toContain('BuilderFormContainer.module.scss');
  });

  it('keeps UI libraries independent of host integration contracts', () => {
    const uiLibraryRoots = [
      libraryRoot,
      resolve(libraryRoot, '../builder-form'),
      resolve(libraryRoot, '../catalog'),
    ];
    const forbidden = [
      /from ['"]@\//,
      /from ['"].*apps\//,
      /server-api/,
      /react-i18next/,
      /localStorage|sessionStorage/,
      /import\.meta\.env|process\.env/,
      /@epam\/ai-dial-chat-api-client/,
    ];

    for (const source of uiLibraryRoots.flatMap(readSources)) {
      for (const pattern of forbidden) expect(source).not.toMatch(pattern);
    }
  });

  it('limits generated-client access to the injected scheduler facade', () => {
    const schedulerSources = sourceFiles(
      resolve(libraryRoot, '../chat-hooks/src/scheduled-task'),
    ).map((path) => readFileSync(path, 'utf8'));
    const generatedClientImports = schedulerSources.filter((source) =>
      source.includes('@epam/ai-dial-chat-api-client'),
    );

    expect(generatedClientImports.length).toBeGreaterThan(0);
    for (const source of generatedClientImports) {
      expect(source).not.toMatch(
        /new\s+Configuration|baseUrl\s*:|authorization\s*:/i,
      );
    }
    const facade = schedulerSources.find((source) =>
      source.includes('createScheduledTasksApiClient'),
    );
    expect(facade).toContain('ScheduledTasksConfiguredClient');
    expect(facade).toContain('client.listScheduledTasks');
  });

  it('keeps frontend library TypeScript projects on bundler resolution', () => {
    for (const root of [
      libraryRoot,
      resolve(libraryRoot, '../builder-form'),
      resolve(libraryRoot, '../catalog'),
      resolve(libraryRoot, '../chat-hooks'),
    ]) {
      const tsconfig = readFileSync(resolve(root, 'tsconfig.lib.json'), 'utf8');
      expect(tsconfig).toContain('"moduleResolution": "bundler"');
      expect(tsconfig).toContain('"module": "esnext"');
    }
  });

  it('declares the composed and generated-client dependencies at their owning boundaries', () => {
    const scheduledTasksManifest = JSON.parse(
      readFileSync(resolve(libraryRoot, 'package.json'), 'utf8'),
    ) as {
      dependencies: Record<string, string>;
      peerDependencies: Record<string, string>;
    };
    const hooksManifest = JSON.parse(
      readFileSync(resolve(libraryRoot, '../chat-hooks/package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> };

    expect(
      scheduledTasksManifest.dependencies['@epam/ai-dial-builder-form'],
    ).toBeDefined();
    expect(
      scheduledTasksManifest.peerDependencies['@epam/ai-dial-ui-kit'],
    ).toBeDefined();
    expect(
      hooksManifest.dependencies['@epam/ai-dial-chat-api-client'],
    ).toBeDefined();
  });

  it('uses extensionless relative TypeScript imports in the affected libraries', () => {
    for (const root of [
      libraryRoot,
      resolve(libraryRoot, '../builder-form'),
      resolve(libraryRoot, '../catalog'),
      resolve(libraryRoot, '../chat-hooks'),
    ]) {
      for (const source of readSources(root)) {
        expect(source).not.toMatch(
          /from ['"]\.{1,2}\/[^'"]+\.(?:ts|tsx|js|jsx)['"]/,
        );
      }
    }
  });

  it('keeps host-only catalog modal and markdown editor loading out of eager library paths', () => {
    const catalogSources = readSources(resolve(libraryRoot, '../catalog')).join(
      '\n',
    );
    const createForm = readFileSync(
      resolve(
        libraryRoot,
        'src/components/ScheduledTaskCreateForm/ScheduledTaskCreateForm.tsx',
      ),
      'utf8',
    );

    expect(catalogSources).not.toContain('CatalogModal');
    expect(createForm).toContain('const MarkdownEditor = lazy');
    expect(createForm).toContain('await LazyMarkdownEditor()');
  });
});
