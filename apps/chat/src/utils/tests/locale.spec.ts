import type { DeploymentCreationFormLocaleEntry } from '@epam/ai-dial-deployment-creation-form';
import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import {
  appendLocaleCode,
  buildAdditionalLocaleOptions,
  buildLocaleFieldLabels,
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
  it('excludes the fixed primary locale from the supported languages', () => {
    expect(buildAdditionalLocaleOptions()).toEqual([
      { code: 'de', label: 'DE' },
    ]);
  });
});

describe('resolveLocalizedText', () => {
  it('returns an empty string for undefined or null', () => {
    expect(resolveLocalizedText(undefined, 'en')).toBe('');
    expect(resolveLocalizedText(null, 'en')).toBe('');
  });

  it('returns a plain string unchanged, regardless of active locale', () => {
    expect(resolveLocalizedText('Same everywhere', 'de')).toBe(
      'Same everywhere',
    );
  });

  it('resolves an exact active-locale match from the map', () => {
    expect(resolveLocalizedText({ en: 'Hello', de: 'Hallo' }, 'de')).toBe(
      'Hallo',
    );
  });

  it('falls back to the base language when the active locale has a region subtag', () => {
    expect(resolveLocalizedText({ en: 'Hello', de: 'Hallo' }, 'de-DE')).toBe(
      'Hallo',
    );
  });

  it('falls back to PRIMARY_LOCALE when neither exact nor base-language key exists', () => {
    expect(resolveLocalizedText({ en: 'Hello', fr: 'Bonjour' }, 'de')).toBe(
      'Hello',
    );
  });

  it('falls back to the first defined value when PRIMARY_LOCALE is also absent', () => {
    expect(resolveLocalizedText({ fr: 'Bonjour' }, 'de')).toBe('Bonjour');
  });

  it('returns an empty string for an empty map', () => {
    expect(resolveLocalizedText({}, 'en')).toBe('');
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

describe('buildLocaleFieldLabels', () => {
  it('sources cancel, save, and edit labels from the shared button strings', () => {
    const t = vi.fn((key: string) => key) as unknown as TFunction;
    const labels = buildLocaleFieldLabels(t);
    expect(labels.cancelLabel).toBe('buttons.cancel');
    expect(labels.saveLabel).toBe('buttons.save');
    expect(labels.editLabel).toBe('buttons.edit');
    expect(labels.localeRowLabel).toBe('editor.locales.rowLabel');
  });
});
