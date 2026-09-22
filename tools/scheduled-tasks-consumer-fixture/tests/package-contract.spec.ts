import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

describe('scheduled-tasks packaged consumer contract', () => {
  it('uses public package entries and no source alias', () => {
    const source = readFileSync(resolve(root, 'src/main.tsx'), 'utf8');
    expect(source).toContain('@epam/ai-dial-scheduled-tasks/styles.css');
    expect(source).toContain('@epam/ai-dial-catalog/styles.css');
    expect(source).toContain('ScheduledTaskCreateForm');
    expect(source).toContain('ScheduledTaskDetailView');
    expect(source).toContain('DeploymentSelectorField');
    expect(source).not.toContain('/libs/');
    expect(source).not.toContain('@epam/source');
  });

  it('has the packed-install entry point', () => {
    expect(existsSync(resolve(root, 'scripts/pack-and-install.mjs'))).toBe(
      true,
    );
  });
});
