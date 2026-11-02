import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumeSignedOut,
  rememberSignedOut,
  SIGNED_OUT_MARKER_STORAGE_KEY,
} from '../signed-out-marker';

describe('signed-out marker', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('reports not signed out when storage is empty', () => {
    expect(consumeSignedOut()).toBe(false);
  });

  it('reports a fresh sign-out once and then removes the record', () => {
    rememberSignedOut();

    expect(consumeSignedOut()).toBe(true);
    expect(consumeSignedOut()).toBe(false);
    expect(
      window.sessionStorage.getItem(SIGNED_OUT_MARKER_STORAGE_KEY),
    ).toBeNull();
  });

  it('ignores a record older than the TTL', () => {
    vi.useFakeTimers();
    rememberSignedOut();

    vi.advanceTimersByTime(60_001);

    expect(consumeSignedOut()).toBe(false);
  });

  it('treats an unparsable record as not signed out', () => {
    window.sessionStorage.setItem(SIGNED_OUT_MARKER_STORAGE_KEY, 'garbage');

    expect(consumeSignedOut()).toBe(false);
  });

  it('treats a throwing storage read as not signed out', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(consumeSignedOut()).toBe(false);
  });

  it('swallows a throwing storage write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => rememberSignedOut()).not.toThrow();
  });
});
