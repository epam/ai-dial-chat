/** A write queue that runs one write at a time, in call order, and never queues a key twice. */
export interface SerializedKeyedWriter {
  /** Queues a write for `key`, or joins the one already queued; settles when that write ran or was dropped. */
  enqueue: (key: string) => Promise<void>;
  /** Drops the write queued for `key` if it has not started; its promise resolves without writing. */
  drop: (key: string) => void;
  /** Calls `listener` with the key of every write that succeeded; returns the function that removes it. */
  subscribe: (listener: (key: string) => void) => () => void;
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
  const listeners = new Set<(key: string) => void>();
  let tail: Promise<void> = Promise.resolve();

  const notify = (key: string) => {
    for (const listener of [...listeners]) {
      try {
        listener(key);
      } catch {
        /* One listener's failure reaches neither the others nor the writer. */
      }
    }
  };

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
      } catch (error) {
        entry.reject(error);
        return;
      }
      /* Listeners hear only of a write that ran and succeeded, before its callers resume. */
      notify(key);
      entry.resolve();
    })();
    return promise;
  };

  const drop = (key: string) => {
    queued.delete(key);
  };

  const subscribe = (listener: (key: string) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return { enqueue, drop, subscribe };
};
