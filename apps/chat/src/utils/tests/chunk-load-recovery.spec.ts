import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHUNK_RELOAD_STORAGE_KEY,
  handleChunkLoadError,
  registerChunkLoadRecovery,
} from '../chunk-load-recovery';

describe('chunk-load-recovery', () => {
  const reloadSpy = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T12:00:00Z'));
    window.sessionStorage.clear();
    reloadSpy.mockReset();
    vi.stubGlobal('location', { reload: reloadSpy });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('reloads the page on the first chunk load failure', () => {
    handleChunkLoadError();

    expect(reloadSpy).toHaveBeenCalledOnce();
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY)).toBe(
      String(Date.now()),
    );
  });

  it('does not reload again within the cooldown, so a persistent failure surfaces', () => {
    handleChunkLoadError();
    vi.advanceTimersByTime(5_000);
    handleChunkLoadError();

    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it('reloads again once the cooldown has passed', () => {
    handleChunkLoadError();
    vi.advanceTimersByTime(10_000);
    handleChunkLoadError();

    expect(reloadSpy).toHaveBeenCalledTimes(2);
  });

  it('does not reload when sessionStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    handleChunkLoadError();

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('reacts to vite:preloadError until unregistered', () => {
    const unregister = registerChunkLoadRecovery();

    window.dispatchEvent(new Event('vite:preloadError'));
    expect(reloadSpy).toHaveBeenCalledOnce();

    unregister();
    vi.advanceTimersByTime(10_000);
    window.dispatchEvent(new Event('vite:preloadError'));
    expect(reloadSpy).toHaveBeenCalledOnce();
  });
});
