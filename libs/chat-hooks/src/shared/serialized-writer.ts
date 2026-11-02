/** A write queue that runs one write at a time, in call order, and never queues a key twice. */
export interface SerializedKeyedWriter {
  /** Queues a write for `key`, or joins the one already queued; settles when that write ran or was dropped. */
  enqueue: (key: string) => Promise<void>;
  /** Drops the write queued for `key` if it has not started; its promise resolves without writing. */
  drop: (key: string) => void;
}

interface QueuedWrite {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

/** Returns a {@link SerializedKeyedWriter} over `write`; a failed write rejects only its own callers. */
export const createSerializedKeyedWriter = (
  write: (key: string) => Promise<void>,
): SerializedKeyedWriter => {
  const queued = new Map<string, QueuedWrite>();
  let tail: Promise<void> = Promise.resolve();

  const enqueue = (key: string): Promise<void> => {
    const existing = queued.get(key);
    if (existing) return existing.promise;
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((onResolve, onReject) => {
      resolve = onResolve;
      reject = onReject;
    });
    const entry: QueuedWrite = { promise, resolve, reject };
    queued.set(key, entry);
    const previous = tail;
    tail = (async () => {
      await previous;
      /* Dropped, or replaced by a later enqueue after a drop. */
      if (queued.get(key) !== entry) {
        entry.resolve();
        return;
      }
      queued.delete(key);
      try {
        await write(key);
        entry.resolve();
      } catch (error) {
        entry.reject(error);
      }
    })();
    return promise;
  };

  const drop = (key: string) => {
    queued.delete(key);
  };

  return { enqueue, drop };
};
