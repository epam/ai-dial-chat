import { describe, expect, it } from 'vitest';
import { mimeTypesToAttachmentExtensionLabels } from '../attachment-types';

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
