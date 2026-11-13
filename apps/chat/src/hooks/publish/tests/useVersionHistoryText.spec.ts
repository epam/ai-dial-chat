import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useVersionHistoryText } from '../useVersionHistoryText';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params?.folders != null ? `${key}|${params.folders}` : key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

describe('useVersionHistoryText', () => {
  it('formats a date as day, short month and year', () => {
    const { result } = renderHook(() => useVersionHistoryText());

    expect(
      result.current.formatters.formatDate(Date.UTC(2026, 6, 12, 12)),
    ).toBe('12 Jul 2026');
  });

  it('keeps the folders placeholder in the published-in label for the section to fill', () => {
    const { result } = renderHook(() => useVersionHistoryText());

    expect(result.current.labels.publishedInLabel).toContain('{folders}');
  });
});
