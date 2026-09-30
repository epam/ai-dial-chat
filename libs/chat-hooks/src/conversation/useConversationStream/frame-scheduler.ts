/* Frame length used when `requestAnimationFrame` is unavailable (non-DOM hosts, some test environments). */
const FALLBACK_FRAME_MS = 16;

/** Coalesces work per key into at most one run per animation frame. */
export interface FrameScheduler {
  /** Runs `task` on the next frame, replacing any task still pending for `key`. */
  schedule: (key: string, task: () => void) => void;
  /** Runs the task pending for `key` now, if any; it will not run again. */
  flush: (key: string) => void;
  /** Drops the task pending for `key` without running it. */
  cancel: (key: string) => void;
  /** Drops every pending task without running it. */
  cancelAll: () => void;
}

interface PendingTask {
  task: () => void;
  cancelFrame: () => void;
}

const requestFrame = (callback: () => void): (() => void) => {
  if (typeof requestAnimationFrame === 'function') {
    const handle = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(handle);
  }
  const handle = setTimeout(callback, FALLBACK_FRAME_MS);
  return () => clearTimeout(handle);
};

/** Returns a scheduler that runs the latest task per key once per animation frame. */
export const createFrameScheduler = (): FrameScheduler => {
  const pending = new Map<string, PendingTask>();

  /* The entry is removed before the task runs, so a task can never run twice. */
  const run = (key: string) => {
    const entry = pending.get(key);
    if (!entry) return;
    pending.delete(key);
    entry.task();
  };

  return {
    schedule: (key, task) => {
      const existing = pending.get(key);
      if (existing) {
        existing.task = task;
        return;
      }
      const entry: PendingTask = { task, cancelFrame: () => undefined };
      pending.set(key, entry);
      entry.cancelFrame = requestFrame(() => run(key));
    },
    flush: (key) => {
      pending.get(key)?.cancelFrame();
      run(key);
    },
    cancel: (key) => {
      pending.get(key)?.cancelFrame();
      pending.delete(key);
    },
    cancelAll: () => {
      pending.forEach((entry) => entry.cancelFrame());
      pending.clear();
    },
  };
};
