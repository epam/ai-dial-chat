import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_ALLOWED_IMAGE_SOURCES,
  getAllowedImageSources,
} from '../allowed-image-sources';

describe('allowed-image-sources', () => {
  const originalValue = process.env.ALLOWED_IMAGE_SOURCES;

  beforeEach(() => {
    delete process.env.ALLOWED_IMAGE_SOURCES;
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.ALLOWED_IMAGE_SOURCES;
    } else {
      process.env.ALLOWED_IMAGE_SOURCES = originalValue;
    }
  });

  describe('DEFAULT_ALLOWED_IMAGE_SOURCES', () => {
    it('contains the sign-in and avatar defaults', () => {
      expect(DEFAULT_ALLOWED_IMAGE_SOURCES).toContain(
        'https://authjs.dev/img/providers/',
      );
      expect(DEFAULT_ALLOWED_IMAGE_SOURCES).toContain(
        'https://s.gravatar.com/',
      );
      expect(DEFAULT_ALLOWED_IMAGE_SOURCES).toContain(
        'https://i1.wp.com/cdn.auth0.com/avatars/',
      );
      expect(DEFAULT_ALLOWED_IMAGE_SOURCES).toContain(
        'https://cdn.auth0.com/avatars/',
      );
    });
  });

  describe('getAllowedImageSources', () => {
    it('returns only the defaults when the env var is unset', () => {
      expect(getAllowedImageSources()).toBe(DEFAULT_ALLOWED_IMAGE_SOURCES);
    });

    it('returns only the defaults when the env var is empty', () => {
      process.env.ALLOWED_IMAGE_SOURCES = '';
      expect(getAllowedImageSources()).toBe(DEFAULT_ALLOWED_IMAGE_SOURCES);
    });

    it('appends the defaults on top of an admin-configured value', () => {
      process.env.ALLOWED_IMAGE_SOURCES = 'https://cdn.mycorp.com';
      const result = getAllowedImageSources();

      expect(result).toBe(
        `https://cdn.mycorp.com ${DEFAULT_ALLOWED_IMAGE_SOURCES}`,
      );
      // Admin value is preserved and defaults are still present.
      expect(result).toContain('https://cdn.mycorp.com');
      expect(result).toContain('https://authjs.dev/img/providers/');
    });
  });
});
