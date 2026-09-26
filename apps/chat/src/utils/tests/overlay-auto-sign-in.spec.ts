import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hasRecentOverlayAutoSignInAttempt,
  OVERLAY_AUTO_SIGN_IN_ATTEMPT_STORAGE_KEY,
  rememberOverlayAutoSignInAttempt,
} from '../overlay-auto-sign-in';

const HREF = 'https://chat.example.com/';

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('overlay auto sign-in attempt record', () => {
  it('reports no attempt when storage is empty', () => {
    expect(hasRecentOverlayAutoSignInAttempt(HREF)).toBe(false);
  });

  it('suppresses a second attempt for the same href within the TTL', () => {
    rememberOverlayAutoSignInAttempt(HREF);

    expect(hasRecentOverlayAutoSignInAttempt(HREF)).toBe(true);
  });

  it('stops suppressing once the record is older than the TTL', () => {
    vi.useFakeTimers();
    rememberOverlayAutoSignInAttempt(HREF);

    vi.advanceTimersByTime(60_001);

    expect(hasRecentOverlayAutoSignInAttempt(HREF)).toBe(false);
  });

  it('does not suppress an attempt for a different href', () => {
    rememberOverlayAutoSignInAttempt(HREF);

    expect(
      hasRecentOverlayAutoSignInAttempt('https://chat.example.com/other'),
    ).toBe(false);
  });

  it('treats unparsable stored content as no attempt', () => {
    window.sessionStorage.setItem(
      OVERLAY_AUTO_SIGN_IN_ATTEMPT_STORAGE_KEY,
      'not-json',
    );

    expect(hasRecentOverlayAutoSignInAttempt(HREF)).toBe(false);
  });

  it('treats a throwing read as no attempt', () => {
    vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    expect(hasRecentOverlayAutoSignInAttempt(HREF)).toBe(false);
  });

  it('swallows a throwing write', () => {
    vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    expect(() => rememberOverlayAutoSignInAttempt(HREF)).not.toThrow();
  });
});
