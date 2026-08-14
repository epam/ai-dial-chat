import { describe, expect, it } from 'vitest';
import { resolveCandidatePath } from '../candidate-path';

const buildFile = (
  name: string,
  webkitRelativePath?: string,
): File & { webkitRelativePath?: string } => {
  const file = new File(['content'], name) as File & {
    webkitRelativePath?: string;
  };
  if (webkitRelativePath !== undefined) {
    Object.defineProperty(file, 'webkitRelativePath', {
      value: webkitRelativePath,
      configurable: true,
    });
  }
  return file;
};

describe('resolveCandidatePath', () => {
  it('falls back to File.name when webkitRelativePath is absent', () => {
    expect(resolveCandidatePath(buildFile('notes.md'))).toBe('notes.md');
  });

  it('falls back to File.name when webkitRelativePath is empty', () => {
    expect(resolveCandidatePath(buildFile('notes.md', ''))).toBe('notes.md');
  });

  it('normalizes backslash separators to forward slashes', () => {
    expect(
      resolveCandidatePath(buildFile('analyzer.md', 'agents\\analyzer.md')),
    ).toBe('agents/analyzer.md');
  });

  it('leaves an already-forward-slash relative path unchanged', () => {
    expect(
      resolveCandidatePath(buildFile('analyzer.md', 'agents/analyzer.md')),
    ).toBe('agents/analyzer.md');
  });
});
