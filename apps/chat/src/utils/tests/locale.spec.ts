import type { TFunction } from 'i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SUPPORTED_LANGUAGES } from '../../hooks/language/useLanguage';
import {
  buildAdditionalLocaleOptions,
  buildLocaleFieldLabels,
  getLocaleDisplayName,
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
    expect(buildAdditionalLocaleOptions([])).toEqual([]);
  });

  it('offers the configured codes in order, labelled with their language names', () => {
    expect(
      buildAdditionalLocaleOptions(['fr', 'de']).map(({ code }) => code),
    ).toEqual(['fr', 'de']);
    expect(buildAdditionalLocaleOptions(['de'])).toEqual([
      { code: 'de', label: 'Deutsch' },
    ]);
  });

  it('drops the primary locale by exact match', () => {
    expect(
      buildAdditionalLocaleOptions([PRIMARY_LOCALE, 'de']).map(
        ({ code }) => code,
      ),
    ).toEqual(['de']);
  });

  it('keeps en-GB next to the primary en', () => {
    expect(
      buildAdditionalLocaleOptions(['en-GB']).map(({ code }) => code),
    ).toEqual(['en-GB']);
  });
});

describe('getLocaleDisplayName', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the autonym of a known code', () => {
    expect(getLocaleDisplayName('de')).toBe('Deutsch');
  });

  it('falls back to the uppercased code when the name cannot be resolved', () => {
    expect(getLocaleDisplayName('qaa')).toBe('QAA');
  });

  it('falls back to the uppercased code when Intl.DisplayNames throws', () => {
    vi.spyOn(Intl, 'DisplayNames').mockImplementation(() => {
      throw new RangeError('unsupported');
    });
    expect(getLocaleDisplayName('pt-BR')).toBe('PT-BR');
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
  it('sources cancel and save labels from the shared button strings', () => {
    const t = vi.fn((key: string) => key) as unknown as TFunction;
    const labels = buildLocaleFieldLabels(t);
    expect(labels.cancelLabel).toBe('buttons.cancel');
    expect(labels.saveLabel).toBe('buttons.save');
    expect(labels.addLabel).toBe('editor.locales.addLabel');
    expect(labels.editLabel).toBe('editor.locales.editLabel');
    expect(labels.localeRowLabel).toBe('editor.locales.rowLabel');
  });
});
