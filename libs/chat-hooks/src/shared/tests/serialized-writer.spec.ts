import { describe, expect, it, vi } from 'vitest';
import { createSerializedKeyedWriter } from '../serialized-writer';

/** A promise the test settles by hand. */
const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

describe('createSerializedKeyedWriter', () => {
  it('runs writes one at a time in call order', async () => {
    const first = deferred();
    const write = vi
      .fn<(key: string) => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined);
    const writer = createSerializedKeyedWriter(write);

    const a = writer.enqueue('a');
    const b = writer.enqueue('b');
    await Promise.resolve();
    expect(write.mock.calls).toEqual([['a']]);

    first.resolve();
    await Promise.all([a, b]);

    expect(write.mock.calls).toEqual([['a'], ['b']]);
  });

  it('does not queue a key that is already waiting', async () => {
    const first = deferred();
    const write = vi
      .fn<(key: string) => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined);
    const writer = createSerializedKeyedWriter(write);

    const a = writer.enqueue('a');
    const b1 = writer.enqueue('b');
    const b2 = writer.enqueue('b');
    first.resolve();
    await Promise.all([a, b1, b2]);

    expect(write.mock.calls).toEqual([['a'], ['b']]);
  });

  it('drops a queued write that has not started', async () => {
    const first = deferred();
    const write = vi
      .fn<(key: string) => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined);
    const writer = createSerializedKeyedWriter(write);

    const a = writer.enqueue('a');
    const b = writer.enqueue('b');
    writer.drop('b');
    first.resolve();
    await Promise.all([a, b]);

    expect(write.mock.calls).toEqual([['a']]);
  });

  it('rejects only the failed write and keeps the queue going', async () => {
    const write = vi
      .fn<(key: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue(undefined);
    const writer = createSerializedKeyedWriter(write);

    const a = writer.enqueue('a');
    const b = writer.enqueue('b');

    await expect(a).rejects.toThrow('down');
    await expect(b).resolves.toBeUndefined();
    expect(write.mock.calls).toEqual([['a'], ['b']]);
  });
});
