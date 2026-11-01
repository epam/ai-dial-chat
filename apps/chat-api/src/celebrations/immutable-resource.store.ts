import {
  IMMUTABLE_STORE_MAX_ENTRY_BYTES,
  IMMUTABLE_STORE_MAX_TOTAL_BYTES,
} from './constants/celebrations.constants';

/** A value a loader hands to the store, with the bytes it occupies. */
export interface ImmutableStoreLoad<T> {
  /** The verified value. */
  value: T;
  /** Bytes the value holds; compared with the per-entry cap. */
  bytes: number;
}

interface StoreEntry {
  value: unknown;
  bytes: number;
}

/**
 * A byte-bounded LRU for verified immutable celebration resources, separate
 * from the shared `CACHE_MANAGER`, so large assets never evict auth or config
 * entries. Concurrent misses for one key share a single load, and a failed
 * load stores nothing. `CelebrationsModule` provides one instance through a
 * factory, because the limits are constructor arguments.
 */
export class ImmutableResourceStore {
  /* A Map iterates in insertion order, so re-inserting on access keeps the
   * least recently used entry first. */
  private readonly entries = new Map<string, StoreEntry>();
  private readonly pending = new Map<string, Promise<unknown>>();
  private totalBytes = 0;

  constructor(
    private readonly maxTotalBytes = IMMUTABLE_STORE_MAX_TOTAL_BYTES,
    private readonly maxEntryBytes = IMMUTABLE_STORE_MAX_ENTRY_BYTES,
  ) {}

  /** Bytes currently held, compressed copies included. */
  get size(): number {
    return this.totalBytes;
  }

  /** Returns the stored value and marks it recently used, or `undefined`. */
  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value as T;
  }

  /**
   * Returns the stored value, or runs `load` once for all concurrent callers
   * and stores its result when it fits the per-entry cap. A rejection reaches
   * every waiting caller and leaves nothing behind.
   */
  async getOrLoad<T>(
    key: string,
    load: () => Promise<ImmutableStoreLoad<T>>,
  ): Promise<T> {
    const stored = this.get<T>(key);
    if (stored !== undefined) return stored;
    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight as Promise<T>;

    const promise = (async () => {
      try {
        const { value, bytes } = await load();
        if (bytes <= this.maxEntryBytes) this.insert(key, { value, bytes });
        return value;
      } finally {
        this.pending.delete(key);
      }
    })();
    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Counts extra bytes, such as a compressed copy, toward a stored entry and
   * evicts other entries to stay within the total. Returns `false` when the
   * entry is gone or the extra bytes cannot fit, so the caller does not keep them.
   */
  grow(key: string, bytes: number): boolean {
    const entry = this.entries.get(key);
    if (!entry || entry.bytes + bytes > this.maxTotalBytes) return false;
    entry.bytes += bytes;
    this.totalBytes += bytes;
    this.evict(key);
    return true;
  }

  private insert(key: string, entry: StoreEntry): void {
    this.entries.set(key, entry);
    this.totalBytes += entry.bytes;
    this.evict(key);
  }

  private evict(keep: string): void {
    for (const [key, entry] of this.entries) {
      if (this.totalBytes <= this.maxTotalBytes) return;
      if (key === keep) continue;
      this.entries.delete(key);
      this.totalBytes -= entry.bytes;
    }
  }
}
