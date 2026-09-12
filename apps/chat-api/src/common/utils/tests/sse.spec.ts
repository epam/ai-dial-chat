import { Writable } from 'node:stream';
import type { Response } from 'express';
import { describe, expect, it } from 'vitest';
import { waitForDrain, writeSseChunk } from '../sse';

/**
 * A real Node `Writable` with a tiny `highWaterMark` and a `write` that
 * withholds its callback until `flush()` is called, so `write()` genuinely
 * returns `false` and a later `'drain'` genuinely fires — not a mocked
 * boolean.
 */
const createStalledWritable = (): {
  writable: Writable;
  flush: () => void;
} => {
  const pendingCallbacks: Array<() => void> = [];
  const writable = new Writable({
    highWaterMark: 1,
    write(_chunk, _encoding, callback) {
      pendingCallbacks.push(callback);
    },
  });
  return {
    writable,
    flush: () => {
      const callbacks = pendingCallbacks.splice(0);
      callbacks.forEach((callback) => callback());
    },
  };
};

describe('writeSseChunk', () => {
  it('reports needsDrain: true when the underlying Writable returns false', () => {
    const { writable } = createStalledWritable();
    const res = writable as unknown as Response;

    const first = writeSseChunk(res, 'a'.repeat(10));

    expect(first.written).toBe(true);
    expect(first.needsDrain).toBe(true);
  });

  it('reports needsDrain: false when the Writable accepts the chunk immediately', () => {
    const writable = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    const res = writable as unknown as Response;

    const result = writeSseChunk(res, 'small');

    expect(result.written).toBe(true);
    expect(result.needsDrain).toBe(false);
  });

  it('reports written: false without writing when the response already ended', async () => {
    const writable = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    const res = writable as unknown as Response;
    writable.end();
    await new Promise((resolve) => writable.once('finish', resolve));

    const result = writeSseChunk(res, 'chunk');

    expect(result).toEqual({ written: false, needsDrain: false });
  });
});

describe('waitForDrain', () => {
  it('resolves "drained" on a real drain event', async () => {
    const { writable, flush } = createStalledWritable();
    const res = writable as unknown as Response;
    writeSseChunk(res, 'a'.repeat(10));

    const pending = waitForDrain(res, new AbortController().signal, 1000);
    flush();

    await expect(pending).resolves.toBe('drained');
  });

  it('resolves "aborted" when the signal fires before drain or timeout', async () => {
    const { writable } = createStalledWritable();
    const res = writable as unknown as Response;
    writeSseChunk(res, 'a'.repeat(10));

    const controller = new AbortController();
    const pending = waitForDrain(res, controller.signal, 1000);
    controller.abort();

    await expect(pending).resolves.toBe('aborted');
  });

  it('resolves "timeout" when neither drain nor abort happens in time', async () => {
    const { writable } = createStalledWritable();
    const res = writable as unknown as Response;
    writeSseChunk(res, 'a'.repeat(10));

    const result = await waitForDrain(res, new AbortController().signal, 10);

    expect(result).toBe('timeout');
  });

  it('removes its drain/abort/timer listeners once settled', async () => {
    const { writable, flush } = createStalledWritable();
    const res = writable as unknown as Response;
    writeSseChunk(res, 'a'.repeat(10));

    const controller = new AbortController();
    const pending = waitForDrain(res, controller.signal, 1000);
    flush();
    await pending;

    expect(writable.listenerCount('drain')).toBe(0);
  });
});
