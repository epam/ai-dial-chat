import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UploadAbortReason,
  UploadWatchdog,
  sliceBuffer,
} from '../../upload/upload-watchdog';

const LIMITS = { idleMs: 1_000, responseMs: 5_000, maxDurationMs: 60_000 };

describe('sliceBuffer', () => {
  it('splits a buffer into bounded views covering every byte in order', () => {
    const buffer = Buffer.from('abcdefghij');

    const chunks = [...sliceBuffer(buffer, 4)];

    expect(chunks.map((chunk) => chunk.toString())).toEqual([
      'abcd',
      'efgh',
      'ij',
    ]);
  });

  it('yields views over the original memory instead of copies', () => {
    const buffer = Buffer.from('abcdef');

    const [first] = [...sliceBuffer(buffer, 3)];
    buffer[0] = 0x7a;

    expect(first.toString()).toBe('zbc');
  });

  it('yields nothing for an empty buffer', () => {
    expect([...sliceBuffer(Buffer.alloc(0), 4)]).toEqual([]);
  });
});

describe('UploadWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aborts as stalled when the first chunk is never requested', () => {
    const watchdog = new UploadWatchdog(LIMITS);

    vi.advanceTimersByTime(LIMITS.idleMs);

    expect(watchdog.signal.aborted).toBe(true);
    expect(watchdog.reason).toBe(UploadAbortReason.Stalled);
  });

  it('keeps the idle timer alive while chunks are requested', async () => {
    const watchdog = new UploadWatchdog(LIMITS);
    const iterator = watchdog.watch([Buffer.from('a'), Buffer.from('b')]);

    vi.advanceTimersByTime(LIMITS.idleMs - 1);
    await iterator.next();
    vi.advanceTimersByTime(LIMITS.idleMs - 1);
    await iterator.next();
    vi.advanceTimersByTime(LIMITS.idleMs - 1);

    expect(watchdog.signal.aborted).toBe(false);
    watchdog.dispose();
  });

  it('aborts as stalled when the next chunk is not requested in time', async () => {
    const watchdog = new UploadWatchdog(LIMITS);
    const iterator = watchdog.watch([Buffer.from('a'), Buffer.from('b')]);

    await iterator.next();
    vi.advanceTimersByTime(LIMITS.idleMs);

    expect(watchdog.reason).toBe(UploadAbortReason.Stalled);
  });

  it('switches to the response timeout once the last chunk is consumed', async () => {
    const watchdog = new UploadWatchdog(LIMITS);
    const iterator = watchdog.watch([Buffer.from('a')]);

    await iterator.next();
    await iterator.next();

    vi.advanceTimersByTime(LIMITS.idleMs * 2);
    expect(watchdog.signal.aborted).toBe(false);

    vi.advanceTimersByTime(LIMITS.responseMs);
    expect(watchdog.reason).toBe(UploadAbortReason.ResponseTimeout);
  });

  it('aborts at the absolute ceiling even while chunks keep flowing', async () => {
    const watchdog = new UploadWatchdog({ ...LIMITS, maxDurationMs: 2_500 });
    const iterator = watchdog.watch(sliceBuffer(Buffer.alloc(10), 1));

    for (let i = 0; i < 3; i += 1) {
      vi.advanceTimersByTime(900);
      await iterator.next();
    }

    expect(watchdog.reason).toBe(UploadAbortReason.MaxDuration);
  });

  it('reports only the first limit that was hit', () => {
    const watchdog = new UploadWatchdog({ ...LIMITS, maxDurationMs: 1_000 });

    vi.advanceTimersByTime(LIMITS.maxDurationMs * 2);

    expect(watchdog.reason).toBe(UploadAbortReason.MaxDuration);
  });

  it('stops all timers on dispose', () => {
    const watchdog = new UploadWatchdog(LIMITS);

    watchdog.dispose();
    vi.advanceTimersByTime(LIMITS.maxDurationMs * 2);

    expect(watchdog.signal.aborted).toBe(false);
    expect(watchdog.reason).toBeUndefined();
  });
});
