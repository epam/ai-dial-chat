import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  base64ToBlob,
  downloadTextFile,
  getFileExtensionForLanguage,
  triggerAnchorDownload,
  tryBase64ToBytes,
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

describe('triggerAnchorDownload', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('attaches the anchor to the document before clicking it', () => {
    vi.useFakeTimers();
    let anchorParent: ParentNode | null = null;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        anchorParent = this.parentNode;
      });

    triggerAnchorDownload('/api/v1/files/download?path=notes.md', 'notes.md');

    expect(clickSpy).toHaveBeenCalledOnce();
    expect(anchorParent).toBe(document.body);
  });

  it('removes the anchor once the browser has had a chance to start the download', () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    );

    triggerAnchorDownload('/api/v1/files/download?path=notes.md', 'notes.md');

    expect(document.body.querySelector('a')).toBeTruthy();

    vi.runAllTimers();

    expect(document.body.querySelector('a')).toBeNull();
  });
});

describe('downloadTextFile', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('creates an object URL and clicks a temporary anchor with the given filename', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    downloadTextFile('const x = 1;', 'code.ts');

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    /* Revoking in the same task as the click cancels the download in Chrome,
     * so the object URL must stay alive until the browser has picked it up. */
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});

describe('tryBase64ToBytes', () => {
  it('decodes a valid base64 payload', () => {
    const bytes = tryBase64ToBytes(btoa('# Title'));

    expect(bytes && Array.from(bytes)).toEqual(
      Array.from(new TextEncoder().encode('# Title')),
    );
  });

  it('returns undefined for a payload that is not valid base64', () => {
    expect(tryBase64ToBytes('# Заголовок')).toBeUndefined();
  });
});

describe('base64ToBlob', () => {
  it('decodes a base64 payload into a blob of the given MIME type', () => {
    const blob = base64ToBlob(btoa('# Title'), 'text/markdown');

    expect(blob.type).toBe('text/markdown');
    expect(blob.size).toBe('# Title'.length);
  });

  it('treats a payload that is not valid base64 as raw text', () => {
    const blob = base64ToBlob('# Заголовок', 'text/markdown');

    /* Cyrillic characters are two UTF-8 bytes each — the payload was encoded
     * as text rather than decoded as base64. */
    expect(blob.size).toBe(new TextEncoder().encode('# Заголовок').length);
  });
});
