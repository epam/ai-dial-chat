import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const LANGUAGE_STORAGE_KEY = 'i18nextLng';

const loadI18n = async (): Promise<{
  i18n: (typeof import('i18next'))['default'];
  getUiLanguage: () => string | undefined;
}> => {
  vi.resetModules();
  await import('../config');
  const { default: i18n } = await import('i18next');
  const { getUiLanguage } = await import('../get-ui-language');
  return { i18n, getUiLanguage };
};

describe('getUiLanguage — X-Lang forwarding', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('forwards a detected locale that has no registered translation bundle', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'uk');

    const { i18n, getUiLanguage } = await loadI18n();

    /* The UI renders English (only `en` is registered), but the header must
       still carry the user's actual locale, not the rendered fallback. */
    expect(i18n.resolvedLanguage).toBe('en');
    expect(getUiLanguage()).toBe('uk');
  });

  it('forwards a registered locale with region subtag unchanged', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en-US');

    const { getUiLanguage } = await loadI18n();

    expect(getUiLanguage()).toBe('en-US');
  });
});
