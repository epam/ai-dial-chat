import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  base64ToBlob,
  downloadTextFile,
  ensureDownloadFilename,
  getFileExtensionForLanguage,
  triggerAnchorDownload,
  tryBase64ToBytes,
} from '../file-download';

describe('ensureDownloadFilename', () => {
  it.each([
    [
      'returns the name unchanged when it already has an extension',
      {
        title: 'report.xlsx',
        url: undefined,
        contentType: undefined,
        expected: 'report.xlsx',
      },
    ],
    [
      'appends the extension extracted from the url path segment',
      {
        title: 'Thermo Fisher Scientific - 10-K Risk Factors',
        url: 'files/bucket/appdata/ThermoFisher_2024.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        expected: 'Thermo Fisher Scientific - 10-K Risk Factors.xlsx',
      },
    ],
    [
      'falls back to the MIME type extension when the url has no extension',
      {
        title: 'Q3 Financial Summary',
        url: 'files/bucket/appdata/document',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        expected: 'Q3 Financial Summary.xlsx',
      },
    ],
    [
      'returns the name unchanged when neither url nor contentType provide an extension',
      {
        title: 'unknown file',
        url: undefined,
        contentType: undefined,
        expected: 'unknown file',
      },
    ],
    [
      'strips query string and fragment from the url before extracting the extension',
      {
        title: 'Report',
        url: 'files/bucket/report.pdf?token=abc#page=2',
        contentType: undefined,
        expected: 'Report.pdf',
      },
    ],
    [
      'appends the MIME-type extension when the title contains a dot that is not a real extension',
      {
        title:
          'Blackstone vs. KKR Comparative Intelligence Briefing (Word Document)',
        url: 'files/bucket/appdata/applications/public/demo/demo-agent__1.0.0/Blackstone_KKR_Detailed_Report.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        expected:
          'Blackstone vs. KKR Comparative Intelligence Briefing (Word Document).docx',
      },
    ],
    [
      'falls back to the url extension when the title has no real extension and no contentType is given',
      {
        title: 'Report v2. Final (draft)',
        url: 'files/bucket/report.pdf',
        contentType: undefined,
        expected: 'Report v2. Final (draft).pdf',
      },
    ],
    [
      'does not mistake a name ending in "vs." followed by more text for an extension',
      {
        title: 'Blackstone vs. KKR Report',
        url: undefined,
        contentType: undefined,
        expected: 'Blackstone vs. KKR Report',
      },
    ],
  ])('%s', (_name, { title, url, contentType, expected }) => {
    expect(ensureDownloadFilename(title, url, contentType)).toBe(expected);
  });
});

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

  it('uses the supplied MIME type for the downloaded blob', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    );

    downloadTextFile('Name,Value', 'table.csv', 'text/csv;charset=utf-8');

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe('text/csv;charset=utf-8');
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
