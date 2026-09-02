import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import { SUPPORTED_LANGUAGES } from '../../hooks/language/useLanguage';
import {
  buildAdditionalLocaleOptions,
  buildLocaleFieldLabels,
  PRIMARY_LOCALE,
  resolveLocalizedText,
} from '../locale';

describe('PRIMARY_LOCALE', () => {
  it('matches the first configured supported language', () => {
    expect(PRIMARY_LOCALE).toBe(SUPPORTED_LANGUAGES[0].code);
  });
});

describe('buildAdditionalLocaleOptions', () => {
  it('returns no options when no additional content locales are configured', () => {
    expect(buildAdditionalLocaleOptions()).toEqual([]);
  });
});

describe('resolveLocalizedText', () => {
  it('falls back to PRIMARY_LOCALE when neither exact nor base-language key exists', () => {
    expect(resolveLocalizedText({ en: 'Hello', fr: 'Bonjour' }, 'de')).toBe(
      'Hello',
    );
  });

  it('resolves an exact active-locale match from the map', () => {
    expect(resolveLocalizedText({ en: 'Hello', de: 'Hallo' }, 'de')).toBe(
      'Hallo',
    );
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
