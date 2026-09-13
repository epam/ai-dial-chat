import { describe, expect, it } from 'vitest';
import {
  getUrlFileName,
  isExternalSourcePreviewable,
  resolveExternalSourceContentType,
} from '../source-content';

describe('getUrlFileName', () => {
  it('returns the last path segment of an absolute url', () => {
    expect(getUrlFileName('https://example.com/files/report.pdf')).toBe(
      'report.pdf',
    );
  });

  it('returns the file name of a relative DIAL resource path', () => {
    expect(
      getUrlFileName(
        'files/4FD1MyzohvVCq3YG9kDnt7Yk38cZfot7myHgGbBMKBpsSERRfFUHAh6ZsqCfieQsGy/qa-routed-source.html',
      ),
    ).toBe('qa-routed-source.html');
  });

  it('drops the query string and hash', () => {
    expect(getUrlFileName('files/bucket/page.html?v=2#top')).toBe('page.html');
    expect(getUrlFileName('https://example.com/page.html?v=2#top')).toBe(
      'page.html',
    );
  });

  it('decodes percent escapes in the file name', () => {
    expect(getUrlFileName('files/bucket/my%20report.pdf')).toBe(
      'my report.pdf',
    );
  });

  it('ignores a trailing slash', () => {
    expect(getUrlFileName('files/bucket/nested/')).toBe('nested');
  });

  it('returns an empty string when there is no path segment', () => {
    expect(getUrlFileName('')).toBe('');
    expect(getUrlFileName('https://example.com/')).toBe('');
  });
});

describe('resolveExternalSourceContentType', () => {
  it('returns an image/* content type unchanged regardless of url', () => {
    expect(
      resolveExternalSourceContentType(
        'image/jpeg',
        'https://example.com/citation/doc-id-123',
      ),
    ).toBe('image/jpeg');
  });

  it('returns application/pdf unchanged when already reported', () => {
    expect(
      resolveExternalSourceContentType(
        'application/pdf',
        'https://example.com/citation/doc-id-123',
      ),
    ).toBe('application/pdf');
  });

  it('overrides a mislabeled content type when the url ends with .pdf', () => {
    expect(
      resolveExternalSourceContentType(
        'text/markdown',
        'https://example.com/files/report.pdf',
      ),
    ).toBe('application/pdf');
  });

  it('returns the original content type when the url has no .pdf extension', () => {
    expect(
      resolveExternalSourceContentType(
        'text/markdown',
        'https://example.com/page/about',
      ),
    ).toBe('text/markdown');
  });

  it.each([
    [
      'docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    [
      'xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    [
      'pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    ['csv', 'text/csv'],
  ])(
    'overrides a mislabeled content type when the url ends with .%s',
    (ext, canonicalMime) => {
      expect(
        resolveExternalSourceContentType(
          'text/markdown',
          `https://example.com/citation/report.${ext}`,
        ),
      ).toBe(canonicalMime);
    },
  );

  it('returns a canonical OOXML content type unchanged when already reported', () => {
    const pptxMime =
      'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    expect(
      resolveExternalSourceContentType(
        pptxMime,
        'https://example.com/citation/doc-id-123',
      ),
    ).toBe(pptxMime);
  });
});

describe('isExternalSourcePreviewable', () => {
  it('returns true for an image/* content type regardless of url', () => {
    expect(
      isExternalSourcePreviewable('image/jpeg', 'https://example.com/photo'),
    ).toBe(true);
  });

  it('returns true for an audio/* content type regardless of url', () => {
    expect(
      isExternalSourcePreviewable(
        'audio/mpeg',
        'https://example.com/track.mp3',
      ),
    ).toBe(true);
  });

  it('returns true for a PDF content type even when the url has no .pdf extension', () => {
    expect(
      isExternalSourcePreviewable(
        'application/pdf',
        'https://example.com/citation/doc-id-123',
      ),
    ).toBe(true);
  });

  it('returns true for a url whose path ends with .pdf', () => {
    expect(
      isExternalSourcePreviewable(
        'application/octet-stream',
        'https://example.com/files/report.pdf',
      ),
    ).toBe(true);
  });

  it('returns true for a url whose path ends with .pptx even with a mislabeled content type', () => {
    expect(
      isExternalSourcePreviewable(
        'text/markdown',
        'https://example.com/citation/slides.pptx',
      ),
    ).toBe(true);
  });

  it('returns true for a canonical pptx content type even when the url has no matching extension', () => {
    const pptxMime =
      'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    expect(
      isExternalSourcePreviewable(
        pptxMime,
        'https://example.com/citation/doc-id-123',
      ),
    ).toBe(true);
  });

  it('returns true when the url extension is a known previewable text format', () => {
    expect(
      isExternalSourcePreviewable(
        'text/markdown',
        'https://example.com/files/readme.md',
      ),
    ).toBe(true);
  });

  it('returns true when the url extension is html', () => {
    expect(
      isExternalSourcePreviewable(
        'text/html',
        'https://example.com/files/page.html',
      ),
    ).toBe(true);
  });

  it('returns false when the url path has no file extension', () => {
    expect(
      isExternalSourcePreviewable(
        'text/html',
        'https://example.com/page/about',
      ),
    ).toBe(false);
  });

  it('returns false for a url that cannot be parsed', () => {
    expect(isExternalSourcePreviewable('text/html', 'not a valid url')).toBe(
      false,
    );
  });

  it('returns false when the extension is not previewable and content type is not image or audio', () => {
    expect(
      isExternalSourcePreviewable(
        'application/zip',
        'https://example.com/archive.zip',
      ),
    ).toBe(false);
  });
});

describe('source classification regressions', () => {
  it.each(['constructor', '__proto__', 'toString'])(
    'ignores inherited extension %s',
    (ext) => {
      const url = 'https://example.test/report.' + ext;
      expect(resolveExternalSourceContentType('text/markdown', url)).toBe(
        'text/markdown',
      );
      expect(isExternalSourcePreviewable('text/markdown', url)).toBe(false);
    },
  );
  it('canonicalizes a parameterized PDF MIME through the URL extension', () => {
    expect(
      resolveExternalSourceContentType(
        'application/pdf; charset=binary',
        'https://example.test/report.pdf',
      ),
    ).toBe('application/pdf');
  });
});
