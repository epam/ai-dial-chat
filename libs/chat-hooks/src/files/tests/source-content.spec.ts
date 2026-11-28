import { describe, expect, it } from 'vitest';
import {
  getUrlFileName,
  isExternalSourcePreviewable,
  resolveExternalSourceContentType,
} from '../source-content';

describe('getUrlFileName', () => {
  it.each([
    [
      'returns the last path segment of an absolute url',
      { url: 'https://example.com/files/report.pdf', expected: 'report.pdf' },
    ],
    [
      'returns the file name of a relative DIAL resource path',
      {
        url: 'files/4FD1MyzohvVCq3YG9kDnt7Yk38cZfot7myHgGbBMKBpsSERRfFUHAh6ZsqCfieQsGy/qa-routed-source.html',
        expected: 'qa-routed-source.html',
      },
    ],
    [
      'decodes percent escapes in the file name',
      { url: 'files/bucket/my%20report.pdf', expected: 'my report.pdf' },
    ],
    [
      'ignores a trailing slash',
      { url: 'files/bucket/nested/', expected: 'nested' },
    ],
  ])('%s', (_name, { url, expected }) => {
    expect(getUrlFileName(url)).toBe(expected);
  });

  it('drops the query string and hash', () => {
    expect(getUrlFileName('files/bucket/page.html?v=2#top')).toBe('page.html');
    expect(getUrlFileName('https://example.com/page.html?v=2#top')).toBe(
      'page.html',
    );
  });

  it('returns an empty string when there is no path segment', () => {
    expect(getUrlFileName('')).toBe('');
    expect(getUrlFileName('https://example.com/')).toBe('');
  });
});

describe('resolveExternalSourceContentType', () => {
  it.each([
    [
      'returns an image/* content type unchanged regardless of url',
      {
        contentType: 'image/jpeg',
        url: 'https://example.com/citation/doc-id-123',
        expected: 'image/jpeg',
      },
    ],
    [
      'returns application/pdf unchanged when already reported',
      {
        contentType: 'application/pdf',
        url: 'https://example.com/citation/doc-id-123',
        expected: 'application/pdf',
      },
    ],
    [
      'overrides a mislabeled content type when the url ends with .pdf',
      {
        contentType: 'text/markdown',
        url: 'https://example.com/files/report.pdf',
        expected: 'application/pdf',
      },
    ],
    [
      'returns the original content type when the url has no .pdf extension',
      {
        contentType: 'text/markdown',
        url: 'https://example.com/page/about',
        expected: 'text/markdown',
      },
    ],
  ])('%s', (_name, { contentType, url, expected }) => {
    expect(resolveExternalSourceContentType(contentType, url)).toBe(expected);
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
  it.each([
    [
      'returns true for an image/* content type regardless of url',
      {
        contentType: 'image/jpeg',
        url: 'https://example.com/photo',
        expected: true,
      },
    ],
    [
      'returns true for an audio/* content type regardless of url',
      {
        contentType: 'audio/mpeg',
        url: 'https://example.com/track.mp3',
        expected: true,
      },
    ],
    [
      'returns true for a PDF content type even when the url has no .pdf extension',
      {
        contentType: 'application/pdf',
        url: 'https://example.com/citation/doc-id-123',
        expected: true,
      },
    ],
    [
      'returns true for a url whose path ends with .pdf',
      {
        contentType: 'application/octet-stream',
        url: 'https://example.com/files/report.pdf',
        expected: true,
      },
    ],
    [
      'returns true for a url whose path ends with .pptx even with a mislabeled content type',
      {
        contentType: 'text/markdown',
        url: 'https://example.com/citation/slides.pptx',
        expected: true,
      },
    ],
    [
      'returns true when the url extension is a known previewable text format',
      {
        contentType: 'text/markdown',
        url: 'https://example.com/files/readme.md',
        expected: true,
      },
    ],
    [
      'returns true when the url extension is html',
      {
        contentType: 'text/html',
        url: 'https://example.com/files/page.html',
        expected: true,
      },
    ],
    [
      'returns false when the url path has no file extension',
      {
        contentType: 'text/html',
        url: 'https://example.com/page/about',
        expected: false,
      },
    ],
    [
      'returns false for a url that cannot be parsed',
      { contentType: 'text/html', url: 'not a valid url', expected: false },
    ],
    [
      'returns false when the extension is not previewable and content type is not image or audio',
      {
        contentType: 'application/zip',
        url: 'https://example.com/archive.zip',
        expected: false,
      },
    ],
  ])('%s', (_name, { contentType, url, expected }) => {
    expect(isExternalSourcePreviewable(contentType, url)).toBe(expected);
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
