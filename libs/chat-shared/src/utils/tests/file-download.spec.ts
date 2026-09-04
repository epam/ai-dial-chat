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
  it('returns the name unchanged when it already has an extension', () => {
    expect(ensureDownloadFilename('report.xlsx', undefined, undefined)).toBe(
      'report.xlsx',
    );
  });

  it('appends the extension extracted from the url path segment', () => {
    expect(
      ensureDownloadFilename(
        'Thermo Fisher Scientific - 10-K Risk Factors',
        'files/bucket/appdata/ThermoFisher_2024.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    ).toBe('Thermo Fisher Scientific - 10-K Risk Factors.xlsx');
  });

  it('falls back to the MIME type extension when the url has no extension', () => {
    expect(
      ensureDownloadFilename(
        'Q3 Financial Summary',
        'files/bucket/appdata/document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    ).toBe('Q3 Financial Summary.xlsx');
  });

  it('returns the name unchanged when neither url nor contentType provide an extension', () => {
    expect(ensureDownloadFilename('unknown file', undefined, undefined)).toBe(
      'unknown file',
    );
  });

  it('strips query string and fragment from the url before extracting the extension', () => {
    expect(
      ensureDownloadFilename(
        'Report',
        'files/bucket/report.pdf?token=abc#page=2',
        undefined,
      ),
    ).toBe('Report.pdf');
  });

  it('appends the MIME-type extension when the title contains a dot that is not a real extension', () => {
    expect(
      ensureDownloadFilename(
        'Blackstone vs. KKR Comparative Intelligence Briefing (Word Document)',
        'files/bucket/appdata/applications/public/pg/pg-agent__1.0.0/Blackstone_KKR_Detailed_Report.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe(
      'Blackstone vs. KKR Comparative Intelligence Briefing (Word Document).docx',
    );
  });

  it('falls back to the url extension when the title has no real extension and no contentType is given', () => {
    expect(
      ensureDownloadFilename(
        'Report v2. Final (draft)',
        'files/bucket/report.pdf',
        undefined,
      ),
    ).toBe('Report v2. Final (draft).pdf');
  });

  it('does not mistake a name ending in "vs." followed by more text for an extension', () => {
    expect(
      ensureDownloadFilename('Blackstone vs. KKR Report', undefined, undefined),
    ).toBe('Blackstone vs. KKR Report');
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
