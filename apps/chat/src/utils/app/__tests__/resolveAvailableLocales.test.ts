import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveAvailableLocales } from '@/src/utils/app/resolveAvailableLocales';

const { mockExistsSync, mockReaddirSync, mockStatSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockStatSync: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync,
    statSync: mockStatSync,
  },
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  statSync: mockStatSync,
}));

describe('resolveAvailableLocales', () => {
  const originalEnv = process.env.AVAILABLE_LOCALES;

  beforeEach(() => {
    mockExistsSync.mockReturnValue(false);
    delete process.env.AVAILABLE_LOCALES;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AVAILABLE_LOCALES;
    } else {
      process.env.AVAILABLE_LOCALES = originalEnv;
    }
    vi.clearAllMocks();
  });

  it('returns locales from AVAILABLE_LOCALES env', () => {
    process.env.AVAILABLE_LOCALES = 'ar,en';

    expect(resolveAvailableLocales()).toEqual(['ar', 'en']);
  });

  it('strips brackets and quotes from env value', () => {
    process.env.AVAILABLE_LOCALES = "['ar','en']";

    expect(resolveAvailableLocales()).toEqual(['ar', 'en']);
  });

  it('appends en when missing from env, keeping the configured primary first', () => {
    process.env.AVAILABLE_LOCALES = 'ar';

    expect(resolveAvailableLocales()).toEqual(['ar', 'en']);
  });

  it('keeps the first configured locale first for a multi-locale env', () => {
    process.env.AVAILABLE_LOCALES = 'ua,fr,fi,lt';

    expect(resolveAvailableLocales()).toEqual(['ua', 'fr', 'fi', 'lt', 'en']);
  });

  it('scans public/locales when env is not set', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['ar', 'en']);
    mockStatSync.mockReturnValue({ isDirectory: () => true });

    expect(resolveAvailableLocales()).toEqual(['ar', 'en']);
  });

  it('falls back to en when env and scan are unavailable', () => {
    expect(resolveAvailableLocales()).toEqual(['en']);
  });
});
