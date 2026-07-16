import { describe, expect, it } from 'vitest';
import {
  isDialFileAcceptType,
  mimeTypesToAttachmentExtensionLabels,
  mimeTypesToDialFileAcceptTypes,
  mimeTypesToFileAccept,
} from '../attachment-types';

describe('isDialFileAcceptType', () => {
  it('accepts MIME types and dotted extensions', () => {
    expect(isDialFileAcceptType('application/pdf')).toBe(true);
    expect(isDialFileAcceptType('image/*')).toBe(true);
    expect(isDialFileAcceptType('.pdf')).toBe(true);
  });

  it('rejects non accept-type strings', () => {
    expect(isDialFileAcceptType('*')).toBe(false);
    expect(isDialFileAcceptType('pdf')).toBe(false);
  });
});

describe('mimeTypesToDialFileAcceptTypes', () => {
  it('normalizes all-files wildcard and keeps valid accept types', () => {
    expect(
      mimeTypesToDialFileAcceptTypes(['*', 'application/pdf', '.csv']),
    ).toEqual(['*/*', 'application/pdf', '.csv']);
  });

  it('filters out values that cannot be passed to DialFileManager', () => {
    expect(mimeTypesToDialFileAcceptTypes(['pdf', 'application/pdf'])).toEqual([
      'application/pdf',
    ]);
  });

  it('returns undefined when no types are provided', () => {
    expect(mimeTypesToDialFileAcceptTypes()).toBeUndefined();
  });
});

describe('mimeTypesToFileAccept', () => {
  it('joins MIME types (including wildcards) into an accept string', () => {
    expect(mimeTypesToFileAccept(['image/*', 'application/pdf'])).toBe(
      'image/*,application/pdf',
    );
  });

  it('returns undefined when no types are provided or the list is empty', () => {
    expect(mimeTypesToFileAccept()).toBeUndefined();
    expect(mimeTypesToFileAccept([])).toBeUndefined();
  });

  it('returns undefined when every type is allowed', () => {
    expect(mimeTypesToFileAccept(['*'])).toBeUndefined();
    expect(mimeTypesToFileAccept(['*/*', 'image/png'])).toBeUndefined();
  });
});

describe('mimeTypesToAttachmentExtensionLabels', () => {
  it('formats known MIME types as dotted extensions', () => {
    expect(
      mimeTypesToAttachmentExtensionLabels([
        'application/pdf',
        'text/csv',
        'image/jpeg',
      ]),
    ).toBe('.pdf, .csv, .jpg');
  });

  it('falls back to MIME subtype when extension lookup is unavailable', () => {
    expect(mimeTypesToAttachmentExtensionLabels(['application/x-custom'])).toBe(
      '.x-custom',
    );
  });

  it('keeps wildcard MIME types readable', () => {
    expect(mimeTypesToAttachmentExtensionLabels(['image/*'])).toBe('image/*');
  });
});
