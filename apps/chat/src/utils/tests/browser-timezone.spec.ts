import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBrowserTimezone } from '../browser-timezone';

describe('getBrowserTimezone', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the timezone resolved by the browser', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      locale: 'en-US',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: 'Europe/Warsaw',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });

    expect(getBrowserTimezone()).toBe('Europe/Warsaw');
  });

  it('returns undefined when the browser resolves an empty timezone', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      locale: 'en-US',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: '',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });

    expect(getBrowserTimezone()).toBeUndefined();
  });

  it('returns undefined when Intl timezone detection throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('Intl unavailable');
    });

    expect(getBrowserTimezone()).toBeUndefined();
  });
});
