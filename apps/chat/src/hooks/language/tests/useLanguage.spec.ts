import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LANGUAGE, useLanguage } from '../useLanguage';

const i18n: {
  language: string;
  resolvedLanguage?: string;
  changeLanguage: (code: string) => Promise<void>;
} = { language: 'en', changeLanguage: vi.fn() };

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n }),
}));

describe('useLanguage', () => {
  beforeEach(() => {
    i18n.language = 'en';
    i18n.resolvedLanguage = 'en';
  });

  it('keeps the detected language but formats in the resolved one', () => {
    i18n.language = 'ru';
    i18n.resolvedLanguage = 'en';

    const { result } = renderHook(() => useLanguage());

    expect(result.current.language).toBe('ru');
    expect(result.current.displayLanguage).toBe('en');
  });

  it('falls back to the default language before resources resolve', () => {
    i18n.language = 'ru';
    i18n.resolvedLanguage = undefined;

    const { result } = renderHook(() => useLanguage());

    expect(result.current.displayLanguage).toBe(DEFAULT_LANGUAGE);
  });
});
