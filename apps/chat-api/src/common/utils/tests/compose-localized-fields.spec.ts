import { describe, expect, it } from 'vitest';
import type { LocaleTextEntryDto } from '../../dto/locale-text-entry.dto';
import { composeLocalizedFields } from '../compose-localized-fields';

describe('composeLocalizedFields', () => {
  it('passes through plain strings when locales is absent', () => {
    const result = composeLocalizedFields(
      'My toolset',
      'A description',
      undefined,
      undefined,
    );
    expect(result).toEqual({
      displayName: 'My toolset',
      description: 'A description',
    });
  });

  it('passes through plain strings when locales is empty', () => {
    const result = composeLocalizedFields(
      'My toolset',
      'A description',
      [],
      'en',
    );
    expect(result).toEqual({
      displayName: 'My toolset',
      description: 'A description',
    });
  });

  it('composes a map keyed by primaryLocale plus each locale entry', () => {
    const locales: LocaleTextEntryDto[] = [
      {
        language: 'de',
        name: 'Mein Toolset',
        description: 'Eine Beschreibung',
      },
    ];
    const result = composeLocalizedFields(
      'My toolset',
      'A description',
      locales,
      'en',
    );
    expect(result).toEqual({
      displayName: { en: 'My toolset', de: 'Mein Toolset' },
      description: { en: 'A description', de: 'Eine Beschreibung' },
    });
  });

  it('defaults primaryLocale to "en" when locales is non-empty but primaryLocale is absent', () => {
    const locales: LocaleTextEntryDto[] = [
      { language: 'de', name: 'Mein Toolset' },
    ];
    const result = composeLocalizedFields(
      'My toolset',
      undefined,
      locales,
      undefined,
    );
    expect(result.displayName).toEqual({
      en: 'My toolset',
      de: 'Mein Toolset',
    });
  });

  it('omits description from the result when neither primary nor any entry has one', () => {
    const locales: LocaleTextEntryDto[] = [
      { language: 'de', name: 'Mein Toolset' },
    ];
    const result = composeLocalizedFields(
      'My toolset',
      undefined,
      locales,
      'en',
    );
    expect(result.description).toBeUndefined();
  });

  it('skips a locale entry with an empty name/description rather than overwriting with an empty string', () => {
    const locales: LocaleTextEntryDto[] = [
      { language: 'de', name: '', description: '' },
    ];
    const result = composeLocalizedFields(
      'My toolset',
      'A description',
      locales,
      'en',
    );
    expect(result).toEqual({
      displayName: { en: 'My toolset' },
      description: { en: 'A description' },
    });
  });
});
