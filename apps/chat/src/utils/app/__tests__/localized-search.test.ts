import { afterEach, describe, expect, it } from 'vitest';

import { LocalesService } from '@/src/utils/app/data/locales-service';
import { getLocalizedEntitySearchOptions } from '@/src/utils/app/search';

import { DEFAULT_LOCAL } from '@/src/constants/locale';

import Fuse from 'fuse.js';

interface TestEntity {
  name?: string | Record<string, string>;
  version?: string;
}

const ENTITIES: TestEntity[] = [
  { name: { en: 'Weather Agent', de: 'Wetter Assistent' }, version: '1.0.0' },
  { name: { en: 'Translator', de: 'Ubersetzer' }, version: '2.0.0' },
  { name: 'Plain String Agent', version: '3.0.0' },
];

const search = (locale: string, query: string) =>
  new Fuse(ENTITIES, getLocalizedEntitySearchOptions<TestEntity>(locale))
    .search(query)
    .map(({ item }) => item);

describe('getLocalizedEntitySearchOptions', () => {
  afterEach(() => {
    LocalesService.setAvailableLocales([DEFAULT_LOCAL]);
  });

  it('matches names in the current locale', () => {
    LocalesService.setAvailableLocales(['en', 'de']);

    expect(search('de', 'Wetter')).toHaveLength(1);
    expect(search('de', 'Wetter')[0].version).toBe('1.0.0');
  });

  it('does not match another locale when the current one has a value', () => {
    LocalesService.setAvailableLocales(['en', 'de']);

    expect(search('de', 'Weather')).toHaveLength(0);
    expect(search('en', 'Weather')).toHaveLength(1);
  });

  it('falls back to the primary locale for a locale with no value', () => {
    LocalesService.setAvailableLocales(['en', 'de']);

    // 'fr' has no translations, so parseLocalizedField falls back to primary 'en'
    expect(search('fr', 'Translator')).toHaveLength(1);
  });

  it('still matches plain string names', () => {
    LocalesService.setAvailableLocales(['en', 'de']);

    expect(search('de', 'Plain String')).toHaveLength(1);
  });

  it('still matches the non-localized version key', () => {
    LocalesService.setAvailableLocales(['en', 'de']);

    // Fuse is configured fuzzy (threshold 0.2), so sibling versions also match;
    // what matters is that `version` is still indexed and ranks best.
    expect(search('de', '2.0.0')[0].version).toBe('2.0.0');
  });

  it('finds nothing for an unrelated term', () => {
    LocalesService.setAvailableLocales(['en', 'de']);

    expect(search('en', 'zzzznomatch')).toHaveLength(0);
  });
});
