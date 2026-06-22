import { describe, expect, it } from 'vitest';
import {
  isMimeTypeAllowed,
  mimeTypesToExtensionLabels,
} from './attachment-mime';

describe('mimeTypesToExtensionLabels', () => {
  it('converts exact MIME types to uppercase subtype labels', () => {
    expect(mimeTypesToExtensionLabels(['application/pdf'])).toBe('PDF');
    expect(mimeTypesToExtensionLabels(['text/csv'])).toBe('CSV');
    expect(mimeTypesToExtensionLabels(['image/jpeg'])).toBe('JPEG');
  });

  it('converts wildcard MIME types to human-readable group labels', () => {
    expect(mimeTypesToExtensionLabels(['image/*'])).toBe('Image files');
    expect(mimeTypesToExtensionLabels(['audio/*'])).toBe('Audio files');
    expect(mimeTypesToExtensionLabels(['video/*'])).toBe('Video files');
  });

  it('falls back to "<major> files" for unrecognised wildcard groups', () => {
    expect(mimeTypesToExtensionLabels(['model/*'])).toBe('model files');
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

  it('returns false when a wildcard does not cover the given MIME type', () => {
    expect(isMimeTypeAllowed('video/mp4', ['image/*'])).toBe(false);
  });

  it('does not match partial major type without wildcard', () => {
    expect(isMimeTypeAllowed('image/png', ['image/jpeg'])).toBe(false);
  });

  it('returns false (reject all) when allowedTypes is empty', () => {
    expect(isMimeTypeAllowed('application/pdf', [])).toBe(false);
  });

  it('returns true when allowedTypes contains the global wildcard "*"', () => {
    expect(isMimeTypeAllowed('application/pdf', ['*'])).toBe(true);
    expect(isMimeTypeAllowed('image/png', ['*'])).toBe(true);
  });

  it('returns true when allowedTypes contains "*/*"', () => {
    expect(isMimeTypeAllowed('application/pdf', ['*/*'])).toBe(true);
    expect(isMimeTypeAllowed('audio/webm', ['*/*'])).toBe(true);
  });
});
