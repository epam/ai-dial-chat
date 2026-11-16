import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useScheduledTaskTimezone } from '../useScheduledTaskTimezone';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
    i18n: { language: 'en', resolvedLanguage: 'en', changeLanguage: vi.fn() },
  }),
}));

describe('useScheduledTaskTimezone', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lists the zones sorted by offset, UTC included', () => {
    const { result } = renderHook(() => useScheduledTaskTimezone());
    const { options } = result.current.timezone;

    expect(options.some((option) => option.id === 'UTC')).toBe(true);
    for (let index = 1; index < options.length; index += 1) {
      expect(options[index].offsetMinutes).toBeGreaterThanOrEqual(
        options[index - 1].offsetMinutes,
      );
    }
  });

  it('starts a new task in the viewer zone', () => {
    vi.stubEnv('TZ', 'Europe/Warsaw');

    const { result } = renderHook(() => useScheduledTaskTimezone());

    expect(result.current.browserTimezone).toBe('Europe/Warsaw');
    expect(result.current.timezone.browserTimezoneId).toBe('Europe/Warsaw');
  });

  it('shows a legacy browser zone under its current name', () => {
    vi.stubEnv('TZ', 'Asia/Calcutta');

    const { result } = renderHook(() => useScheduledTaskTimezone());

    expect(result.current.browserTimezone).toBe('Asia/Kolkata');
  });

  it('translates the picker wording through app keys', () => {
    const { labels } = renderHook(() => useScheduledTaskTimezone()).result
      .current.timezone;

    expect(labels?.changeLabel).toBe(
      'scheduledTasks.create.timezoneChangeLabel',
    );
    expect(labels?.clearSearchAriaLabel).toBe('basic.clearSearch');
    expect(labels?.resultsCountLabel?.(3)).toBe(
      'scheduledTasks.create.timezoneResultsCount:{"count":3}',
    );
    expect(labels?.gapHintLabel?.('03:30')).toBe(
      'scheduledTasks.create.timezoneGapHint:{"time":"03:30"}',
    );
  });

  it('keeps the same option list between renders of one language', () => {
    const { result, rerender } = renderHook(() => useScheduledTaskTimezone());
    const first = result.current.timezone.options;

    rerender();

    expect(result.current.timezone.options).toBe(first);
  });
});
