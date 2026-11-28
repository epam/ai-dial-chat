import { describe, expect, it } from 'vitest';
import { isMimeTypeAllowed, mimeTypesToExtensionLabels } from '../attachment';

describe('mimeTypesToExtensionLabels', () => {
  it.each([
    [
      'converts exact MIME types to uppercase subtype labels',
      {
        cases: [
          ['application/pdf', 'PDF'],
          ['text/csv', 'CSV'],
          ['image/jpeg', 'JPEG'],
        ],
      },
    ],
    [
      'converts wildcard MIME types to human-readable group labels',
      {
        cases: [
          ['image/*', 'Image files'],
          ['audio/*', 'Audio files'],
          ['video/*', 'Video files'],
        ],
      },
    ],
    [
      'labels an aliased MIME type from its canonical entry',
      {
        cases: [
          ['text/json', 'JSON'],
          ['image/jpg', 'JPEG'],
          ['application/x-zip-compressed', 'ZIP'],
        ],
      },
    ],
  ])('%s', (_name, { cases }) => {
    for (const [mimeType, label] of cases) {
      expect(mimeTypesToExtensionLabels([mimeType])).toBe(label);
    }
  });

  it('converts common vendor and structured MIME types to extension labels', () => {
    expect(
      mimeTypesToExtensionLabels([
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.amazon.ebook',
        'application/epub+zip',
        'font/woff2',
      ]),
    ).toBe('DOCX, AZW, EPUB, WOFF2');
  });

  it('falls back to "<major> files" for unrecognised wildcard groups', () => {
    expect(mimeTypesToExtensionLabels(['model/*'])).toBe('model files');
  });

  it('converts the catch-all "*/*" wildcard to "All files"', () => {
    expect(mimeTypesToExtensionLabels(['*/*'])).toBe('All files');
  });

  it('joins multiple types with ", "', () => {
    expect(
      mimeTypesToExtensionLabels(['application/pdf', 'image/jpeg', 'text/csv']),
    ).toBe('PDF, JPEG, CSV');
    expect(mimeTypesToExtensionLabels(['image/*', 'application/pdf'])).toBe(
      'Image files, PDF',
    );
  });

  it('returns an empty string for an empty array', () => {
    expect(mimeTypesToExtensionLabels([])).toBe('');
  });
});

describe('isMimeTypeAllowed', () => {
  it('returns true for an exact MIME match', () => {
    expect(
      isMimeTypeAllowed('application/pdf', ['application/pdf', 'text/csv']),
    ).toBe(true);
  });

  it('returns false when the MIME type is not in the allowed list', () => {
    expect(
      isMimeTypeAllowed('application/msword', ['application/pdf', 'text/csv']),
    ).toBe(false);
  });

  it('returns true when a wildcard covers the given MIME type', () => {
    expect(isMimeTypeAllowed('image/png', ['image/*'])).toBe(true);
    expect(isMimeTypeAllowed('image/jpeg', ['image/*'])).toBe(true);
    expect(isMimeTypeAllowed('audio/webm', ['audio/*'])).toBe(true);
  });

  it.each([
    [
      'returns false when a wildcard does not cover the given MIME type',
      { contentType: 'video/mp4', allowed: 'image/*', expected: false },
    ],
    [
      'does not match partial major type without wildcard',
      { contentType: 'image/png', allowed: 'image/jpeg', expected: false },
    ],
    [
      'ignores letter case and parameters on both sides',
      {
        contentType: 'Application/JSON; charset=utf-8',
        allowed: 'TEXT/JSON',
        expected: true,
      },
    ],
    [
      'still matches a literal text subtype against a text wildcard',
      { contentType: 'text/json', allowed: 'text/*', expected: true },
    ],
    [
      'matches an aliased type against the wildcard of its canonical major type',
      { contentType: 'text/json', allowed: 'application/*', expected: true },
    ],
    [
      'does not treat distinct formats sharing an extension as aliases',
      {
        contentType: 'video/mp2t',
        allowed: 'text/typescript',
        expected: false,
      },
    ],
  ])('%s', (_name, { contentType, allowed, expected }) => {
    expect(isMimeTypeAllowed(contentType, [allowed])).toBe(expected);
  });

  it('returns false (reject all) when allowedTypes is empty', () => {
    expect(isMimeTypeAllowed('application/pdf', [])).toBe(false);
  });

  it.each([
    [
      'returns true when allowedTypes contains the global wildcard "*"',
      {
        cases: [
          ['application/pdf', '*'],
          ['image/png', '*'],
        ],
      },
    ],
    [
      'returns true when allowedTypes contains "*/*"',
      {
        cases: [
          ['application/pdf', '*/*'],
          ['audio/webm', '*/*'],
        ],
      },
    ],
    /* [#8939](https://github.com/epam/ai-dial-chat/issues/8939): a deployment declaring `text/json` must accept the
       `application/json` DIAL Core stores for a .json file. */
    [
      'matches a stored content type against an aliased declared type',
      {
        cases: [
          ['application/json', 'text/json'],
          ['text/json', 'application/json'],
        ],
      },
    ],
  ])('%s', (_name, { cases }) => {
    for (const [contentType, allowed] of cases) {
      expect(isMimeTypeAllowed(contentType, [allowed])).toBe(true);
    }
  });

  it.each([
    ['application/xml', 'text/xml'],
    ['text/javascript', 'application/javascript'],
    ['application/zip', 'application/x-zip-compressed'],
    ['image/jpeg', 'image/jpg'],
    ['audio/mpeg', 'audio/mp3'],
    ['application/msword', 'application/vnd.ms-word'],
  ])('matches %s against the declared alias %s', (contentType, declared) => {
    expect(isMimeTypeAllowed(contentType, [declared])).toBe(true);
  });
});
