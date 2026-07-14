import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  downloadTextFile,
  getFileExtensionForLanguage,
} from '../file-download';

describe('getFileExtensionForLanguage', () => {
  it('maps known language identifiers to their file extension', () => {
    expect(getFileExtensionForLanguage('typescript')).toBe('ts');
    expect(getFileExtensionForLanguage('python')).toBe('py');
    expect(getFileExtensionForLanguage('markdown')).toBe('md');
  });

  it('is case-insensitive', () => {
    expect(getFileExtensionForLanguage('TypeScript')).toBe('ts');
  });

  it('falls back to txt for unknown or empty languages', () => {
    expect(getFileExtensionForLanguage('brainfuck')).toBe('txt');
    expect(getFileExtensionForLanguage('')).toBe('txt');
  });
});

describe('downloadTextFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an object URL, clicks a temporary anchor with the given filename, and revokes the URL', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    downloadTextFile('const x = 1;', 'code.ts');

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
