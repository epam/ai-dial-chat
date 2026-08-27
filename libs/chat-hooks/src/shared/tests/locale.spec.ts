import type { DeploymentCreationFormLocaleEntry } from '@epam/ai-dial-deployment-creation-form';
import { describe, expect, it } from 'vitest';
import {
  appendLocaleCode,
  buildAdditionalLocaleOptions,
  composeLocalePayload,
  decomposeLocalizedFields,
  resolveLocalizedText,
  toBaseLocale,
} from '../locale';

describe('toBaseLocale', () => {
  it('strips a region subtag and lowercases the result', () => {
    expect(toBaseLocale('en-US')).toBe('en');
  });

  it('leaves a bare language code unchanged other than lowercasing', () => {
    expect(toBaseLocale('DE')).toBe('de');
  });
});

describe('appendLocaleCode', () => {
  it('appends the uppercased base locale in brackets', () => {
    expect(appendLocaleCode('Name', 'en-US')).toBe('Name [EN]');
  });
});

describe('buildAdditionalLocaleOptions', () => {
  it('excludes the primary locale from the given codes', () => {
    expect(buildAdditionalLocaleOptions(['de', 'en'], 'en')).toEqual([
      { code: 'de', label: 'DE' },
    ]);
  });

  it('returns an empty array when every code is the primary locale', () => {
    expect(buildAdditionalLocaleOptions(['en'], 'en')).toEqual([]);
  });
});

describe('resolveLocalizedText', () => {
  it('returns an empty string for undefined or null', () => {
    expect(resolveLocalizedText(undefined, 'en', 'en')).toBe('');
    expect(resolveLocalizedText(null, 'en', 'en')).toBe('');
  });

  it('returns a plain string unchanged, regardless of active locale', () => {
    expect(resolveLocalizedText('Same everywhere', 'de', 'en')).toBe(
      'Same everywhere',
    );
  });

  it('resolves an exact active-locale match from the map', () => {
    expect(resolveLocalizedText({ en: 'Hello', de: 'Hallo' }, 'de', 'en')).toBe(
      'Hallo',
    );
  });

  it('falls back to the base language when the active locale has a region subtag', () => {
    expect(
      resolveLocalizedText({ en: 'Hello', de: 'Hallo' }, 'de-DE', 'en'),
    ).toBe('Hallo');
  });

  it('falls back to primaryLocale when neither exact nor base-language key exists', () => {
    expect(
      resolveLocalizedText({ en: 'Hello', fr: 'Bonjour' }, 'de', 'en'),
    ).toBe('Hello');
  });

  it('falls back to the first defined value when primaryLocale is also absent', () => {
    expect(resolveLocalizedText({ fr: 'Bonjour' }, 'de', 'en')).toBe('Bonjour');
  });

  it('returns an empty string for an empty map', () => {
    expect(resolveLocalizedText({}, 'en', 'en')).toBe('');
  });
});

const makeEntry = (
  overrides: Partial<DeploymentCreationFormLocaleEntry> = {},
): DeploymentCreationFormLocaleEntry => ({
  id: 'locale-row-1',
  language: 'de',
  name: 'Mein Toolset',
  description: 'Eine Beschreibung',
  ...overrides,
});

describe('composeLocalePayload', () => {
  it('returns undefined for an empty list', () => {
    expect(composeLocalePayload([], 'en')).toBeUndefined();
  });

  it('drops a row with neither name nor description', () => {
    expect(
      composeLocalePayload([makeEntry({ name: '', description: '' })], 'en'),
    ).toBeUndefined();
  });

  it('drops a row colliding with primaryLocale', () => {
    expect(
      composeLocalePayload([makeEntry({ language: 'en' })], 'en'),
    ).toBeUndefined();
  });

  it('strips the client-only id from the output shape', () => {
    const result = composeLocalePayload([makeEntry()], 'en');
    expect(result).toEqual([
      {
        language: 'de',
        name: 'Mein Toolset',
        description: 'Eine Beschreibung',
      },
    ]);
  });

  it('dedupes by language, keeping the last row for that language', () => {
    const result = composeLocalePayload(
      [
        makeEntry({ id: 'row-1', name: 'First' }),
        makeEntry({ id: 'row-2', name: 'Second' }),
      ],
      'en',
    );
    expect(result).toEqual([
      { language: 'de', name: 'Second', description: 'Eine Beschreibung' },
    ]);
  });
});

describe('decomposeLocalizedFields', () => {
  it('returns an empty array when both fields are plain strings', () => {
    expect(
      decomposeLocalizedFields('My toolset', 'A description', 'en'),
    ).toEqual([]);
  });

  it('returns an empty array when both fields are undefined', () => {
    expect(decomposeLocalizedFields(undefined, undefined, 'en')).toEqual([]);
  });

  it('builds one entry per non-primary key present in either map', () => {
    const result = decomposeLocalizedFields(
      { en: 'My toolset', de: 'Mein Toolset' },
      { en: 'A description', de: 'Eine Beschreibung' },
      'en',
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      language: 'de',
      name: 'Mein Toolset',
      description: 'Eine Beschreibung',
    });
    expect(result[0].id).toBeTruthy();
  });

  it('leaves description empty when the description map lacks that key', () => {
    const result = decomposeLocalizedFields(
      { en: 'My toolset', de: 'Mein Toolset' },
      'A description',
      'en',
    );
    expect(result).toEqual([
      expect.objectContaining({
        language: 'de',
        name: 'Mein Toolset',
        description: '',
      }),
    ]);
  });

  it('round-trips through composeLocalePayload with the same non-primary key set', () => {
    const decomposed = decomposeLocalizedFields(
      { en: 'My toolset', de: 'Mein Toolset', fr: 'Mon outil' },
      { en: 'A description', de: 'Eine Beschreibung', fr: 'Une description' },
      'en',
    );
    const recomposed = composeLocalePayload(decomposed, 'en');
    expect(recomposed?.map((entry) => entry.language).sort()).toEqual([
      'de',
      'fr',
    ]);
  });
});
