import { afterEach, describe, expect, it } from 'vitest';

import { LocalesService } from '@/src/utils/app/data/locales-service';
import {
  compareLocalizedNames,
  getEntityLocals,
  getLocalizedEntityIdName,
  parseLocalizedField,
  updateLocalizedEntityIdName,
  withEntityIdName,
} from '@/src/utils/app/marketplace-localization';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { DEFAULT_LOCAL } from '@/src/constants/locale';

describe('marketplace-localization', () => {
  afterEach(() => {
    LocalesService.setAvailableLocales([DEFAULT_LOCAL]);
  });

  describe('getLocalizedEntityIdName', () => {
    it('returns a plain string name as-is', () => {
      LocalesService.setAvailableLocales(['ar', 'en']);

      expect(getLocalizedEntityIdName('My App')).toBe('My App');
    });

    it('reads the primary locale, not DEFAULT_LOCAL', () => {
      LocalesService.setAvailableLocales(['ar', 'en']);

      expect(getLocalizedEntityIdName({ en: 'My App', ar: 'تطبيقي' })).toBe(
        'تطبيقي',
      );
    });

    it('falls back to DEFAULT_LOCAL as primary when no config is set', () => {
      expect(getLocalizedEntityIdName({ en: 'My App', ar: 'تطبيقي' })).toBe(
        'My App',
      );
    });

    it('returns an empty string when the primary locale is missing', () => {
      LocalesService.setAvailableLocales(['de', 'en']);

      expect(getLocalizedEntityIdName({ en: 'My App' })).toBe('');
    });

    it('returns an empty string for an undefined name', () => {
      expect(getLocalizedEntityIdName(undefined)).toBe('');
    });
  });

  describe('updateLocalizedEntityIdName', () => {
    it('replaces a plain string name', () => {
      expect(updateLocalizedEntityIdName({ name: 'Old' }, 'New')).toEqual({
        name: 'New',
      });
    });

    it('writes to the primary locale key', () => {
      LocalesService.setAvailableLocales(['ar', 'en']);

      expect(
        updateLocalizedEntityIdName(
          { name: { en: 'My App', ar: 'تطبيقي' } },
          'جديد',
        ),
      ).toEqual({ name: { en: 'My App', ar: 'جديد' } });
    });

    it('leaves the entity untouched when the primary locale is absent', () => {
      LocalesService.setAvailableLocales(['de', 'en']);
      const entity = { name: { en: 'My App' } };

      expect(updateLocalizedEntityIdName(entity, 'Neu')).toBe(entity);
    });
  });

  describe('withEntityIdName', () => {
    it('flattens name to the primary locale value', () => {
      LocalesService.setAvailableLocales(['ar', 'en']);

      expect(
        withEntityIdName({ id: '1', name: { en: 'My App', ar: 'تطبيقي' } }),
      ).toEqual({ id: '1', name: 'تطبيقي' });
    });
  });

  describe('parseLocalizedField', () => {
    it('returns a plain string as-is when not strict', () => {
      expect(parseLocalizedField('de', 'My App')).toBe('My App');
    });

    it('returns the requested locale when present', () => {
      LocalesService.setAvailableLocales(['ar', 'en']);

      expect(parseLocalizedField('en', { en: 'My App', ar: 'تطبيقي' })).toBe(
        'My App',
      );
    });

    it('falls back to the primary locale before DEFAULT_LOCAL', () => {
      LocalesService.setAvailableLocales(['ar', 'en']);

      expect(parseLocalizedField('de', { en: 'My App', ar: 'تطبيقي' })).toBe(
        'تطبيقي',
      );
    });

    it('falls back to DEFAULT_LOCAL when the primary locale is missing', () => {
      LocalesService.setAvailableLocales(['ar', 'en']);

      expect(parseLocalizedField('de', { en: 'My App' })).toBe('My App');
    });

    it('returns an empty string when nothing matches', () => {
      LocalesService.setAvailableLocales(['ar', 'en']);

      expect(parseLocalizedField('de', { fr: 'Mon App' })).toBe('');
    });

    describe('strict', () => {
      it('returns a plain string only for the primary locale', () => {
        LocalesService.setAvailableLocales(['ar', 'en']);

        expect(parseLocalizedField('ar', 'My App', true)).toBe('My App');
        expect(parseLocalizedField('en', 'My App', true)).toBe('');
      });

      it('does not fall back to any other locale', () => {
        LocalesService.setAvailableLocales(['ar', 'en']);

        expect(parseLocalizedField('de', { en: 'My App' }, true)).toBe('');
      });
    });
  });

  describe('compareLocalizedNames', () => {
    it('orders by the given locale, not the primary one', () => {
      LocalesService.setAvailableLocales(['en', 'de']);
      const a = { en: 'Zebra', de: 'Apfel' };
      const b = { en: 'Alpha', de: 'Zitrone' };

      expect(compareLocalizedNames('en', a, b)).toBeGreaterThan(0);
      expect(compareLocalizedNames('de', a, b)).toBeLessThan(0);
    });

    it('is case-insensitive', () => {
      expect(compareLocalizedNames('en', 'apple', 'APPLE')).toBe(0);
    });

    it('sorts a list of localized entities by the current locale', () => {
      LocalesService.setAvailableLocales(['en']);
      const entities = [
        { name: { en: 'Charlie', de: 'Anton' } },
        { name: { en: 'Alpha', de: 'Zeppelin' } },
      ];

      const byDe = [...entities].sort((x, y) =>
        compareLocalizedNames('de', x.name, y.name),
      );

      expect(byDe.map((e) => e.name.de)).toEqual(['Anton', 'Zeppelin']);
    });

    it('handles missing and undefined names without throwing', () => {
      expect(compareLocalizedNames('en', undefined, undefined)).toBe(0);
      expect(compareLocalizedNames('en', 'Alpha', undefined)).toBeGreaterThan(
        0,
      );
    });
  });

  describe('getEntityLocals', () => {
    const entity = {
      name: { en: 'My App', ar: 'تطبيقي' },
      description: { en: 'Description', de: 'Beschreibung' },
    } as unknown as MarketplaceEntity;

    it('returns an empty array for an undefined entity', () => {
      expect(getEntityLocals(undefined)).toEqual([]);
    });

    it('collects locales from both name and description', () => {
      LocalesService.setAvailableLocales(['ar', 'en']);

      expect(getEntityLocals(entity).map(({ locale }) => locale)).toEqual([
        'en',
        'ar',
        'de',
      ]);
    });

    it('excludes the primary locale, not DEFAULT_LOCAL', () => {
      LocalesService.setAvailableLocales(['ar', 'en']);

      expect(getEntityLocals(entity, true).map(({ locale }) => locale)).toEqual(
        ['en', 'de'],
      );
    });

    it('maps plain string fields onto the primary locale', () => {
      LocalesService.setAvailableLocales(['ar', 'en']);
      const stringEntity = {
        name: 'My App',
        description: 'Description',
      } as unknown as MarketplaceEntity;

      expect(getEntityLocals(stringEntity)).toEqual([
        { locale: 'ar', name: 'My App', description: 'Description' },
      ]);
      expect(getEntityLocals(stringEntity, true)).toEqual([]);
    });
  });
});
