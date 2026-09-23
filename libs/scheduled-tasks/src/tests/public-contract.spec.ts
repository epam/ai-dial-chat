import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const libraryRoot = resolve(import.meta.dirname, '../..');

describe('scheduled-tasks public distribution contract', () => {
  it('exports the emitted stylesheet from the documented public subpath', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(libraryRoot, 'package.json'), 'utf8'),
    ) as { exports: Record<string, string> };

    expect(manifest.exports['./styles.css']).toBe('./dist/index.css');
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
});
