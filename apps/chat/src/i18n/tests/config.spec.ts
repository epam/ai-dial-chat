import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const LANGUAGE_STORAGE_KEY = 'i18nextLng';

const loadI18n = async () => {
  vi.resetModules();
  await import('../config');
  const { default: i18n } = await import('i18next');
  return i18n;
};

describe('i18n config — document language', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('sets lang to the rendered fallback language when the detected one has no translation', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'uk');

    await loadI18n();

    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('keeps the document LTR when an untranslated RTL language is detected', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'ar');

    await loadI18n();

    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('updates lang to the resolved language on language change', async () => {
    const i18n = await loadI18n();

    await i18n.changeLanguage('uk');

    expect(document.documentElement.lang).toBe('en');
  });
});
