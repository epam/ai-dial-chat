import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import i18next from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import en from '../../i18n/locales/en.json';
import { canEditShareAccess, formatShareExpiryNote } from '../share';

/* A real i18next instance, so the `_one` / `_other` plural keys resolve as they do in the app. */
const i18n = i18next.createInstance();

describe('share', () => {
  beforeAll(async () => {
    await i18n.init({
      lng: 'en',
      resources: { en: { translation: en } },
      interpolation: { escapeValue: false },
    });
  });

  describe('formatShareExpiryNote', () => {
    it('describes a TTL shorter than a day in hours', () => {
      expect(
        formatShareExpiryNote({ expiresInDays: 1, expiresInHours: 1 }, i18n.t),
      ).toBe('This link is active for 1 hour.');
      expect(
        formatShareExpiryNote({ expiresInDays: 1, expiresInHours: 23 }, i18n.t),
      ).toBe('This link is active for 23 hours.');
    });

    it('describes a TTL of a day or longer in days', () => {
      expect(
        formatShareExpiryNote({ expiresInDays: 1, expiresInHours: 24 }, i18n.t),
      ).toBe('This link is active for 1 day.');
      expect(
        formatShareExpiryNote(
          { expiresInDays: 7, expiresInHours: 168 },
          i18n.t,
        ),
      ).toBe('This link is active for 7 days.');
    });

    it('falls back to days when the hours are not reported', () => {
      expect(formatShareExpiryNote({ expiresInDays: 3 }, i18n.t)).toBe(
        'This link is active for 3 days.',
      );
    });

    it('returns undefined when the expiry is unknown', () => {
      expect(formatShareExpiryNote({}, i18n.t)).toBeUndefined();
      expect(formatShareExpiryNote(undefined, i18n.t)).toBeUndefined();
    });
  });

  describe('canEditShareAccess', () => {
    it('allows edit access for agents, prompts, skills and toolsets', () => {
      expect(canEditShareAccess(CatalogEntityType.Agent)).toBe(true);
      expect(canEditShareAccess(CatalogEntityType.Prompt)).toBe(true);
      expect(canEditShareAccess(CatalogEntityType.Skill)).toBe(true);
      expect(canEditShareAccess(CatalogEntityType.Toolset)).toBe(true);
    });

    it('keeps model links view-only', () => {
      expect(canEditShareAccess(CatalogEntityType.Model)).toBe(false);
    });
  });
});
