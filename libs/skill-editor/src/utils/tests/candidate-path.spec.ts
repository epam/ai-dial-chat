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

  it.each([
    [
      'falls back to File.name when webkitRelativePath is empty',
      { name: 'notes.md', relativePath: '', expected: 'notes.md' },
    ],
    [
      'normalizes backslash separators to forward slashes',
      {
        name: 'analyzer.md',
        relativePath: 'agents\\analyzer.md',
        expected: 'agents/analyzer.md',
      },
    ],
    [
      'leaves an already-forward-slash relative path unchanged',
      {
        name: 'analyzer.md',
        relativePath: 'agents/analyzer.md',
        expected: 'agents/analyzer.md',
      },
    ],
  ])('%s', (_name, { name, relativePath, expected }) => {
    expect(resolveCandidatePath(buildFile(name, relativePath))).toBe(expected);
  });
});
