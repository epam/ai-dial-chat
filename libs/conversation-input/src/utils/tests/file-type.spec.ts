import { describe, expect, it } from 'vitest';
import { withResolvedFileType } from '../file-type';

describe('withResolvedFileType', () => {
  it('infers text/markdown for an .md file the browser reported without a type', () => {
    const file = new File(['# Notes'], 'notes.md', {
      type: '',
      lastModified: 42,
    });

    const resolved = withResolvedFileType(file);

    expect(resolved.type).toBe('text/markdown');
    expect(resolved.name).toBe('notes.md');
    expect(resolved.lastModified).toBe(42);
    expect(resolved.size).toBe(file.size);
  });

  it('infers the type when the browser reported application/octet-stream', () => {
    const file = new File(['# Notes'], 'README.MD', {
      type: 'application/octet-stream',
    });

    expect(withResolvedFileType(file).type).toBe('text/markdown');
  });

  it('returns the same file when the browser reported a concrete type', () => {
    const file = new File(['# Notes'], 'notes.md', {
      type: 'text/x-markdown',
    });

    expect(withResolvedFileType(file)).toBe(file);
  });

  it('returns the same file when the extension is not recognized', () => {
    const file = new File(['data'], 'archive.unknownext', { type: '' });

    expect(withResolvedFileType(file)).toBe(file);
  });
});
