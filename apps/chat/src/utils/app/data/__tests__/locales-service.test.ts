import { afterEach, describe, expect, it } from 'vitest';

import { LocalesService } from '@/src/utils/app/data/locales-service';

import { DEFAULT_LOCAL } from '@/src/constants/locale';

describe('LocalesService', () => {
  afterEach(() => {
    LocalesService.setAvailableLocales([DEFAULT_LOCAL]);
  });

  it('defaults to DEFAULT_LOCAL before being seeded', () => {
    expect(LocalesService.getAvailableLocales()).toEqual([DEFAULT_LOCAL]);
    expect(LocalesService.getPrimaryLocale()).toBe(DEFAULT_LOCAL);
  });

  it('uses the first available locale as the primary one', () => {
    LocalesService.setAvailableLocales(['ar', 'en', 'de']);

    expect(LocalesService.getPrimaryLocale()).toBe('ar');
    expect(LocalesService.getAvailableLocales()).toEqual(['ar', 'en', 'de']);
  });

  it('falls back to DEFAULT_LOCAL for an empty list', () => {
    LocalesService.setAvailableLocales([]);

    expect(LocalesService.getPrimaryLocale()).toBe(DEFAULT_LOCAL);
  });

  it('falls back to DEFAULT_LOCAL for undefined', () => {
    LocalesService.setAvailableLocales(undefined);

    expect(LocalesService.getPrimaryLocale()).toBe(DEFAULT_LOCAL);
  });
});
