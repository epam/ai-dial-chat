import { describe, expect, it, vi } from 'vitest';
import { ImmutableResourceStore } from '../immutable-resource.store';

const load = (value: string, bytes: number) =>
  vi.fn(async () => ({ value, bytes }));

describe('ImmutableResourceStore', () => {
  it('evicts the least recently used entries once the byte total is exceeded', async () => {
    const store = new ImmutableResourceStore(100, 60);
    await store.getOrLoad('a', load('A', 40));
    await store.getOrLoad('b', load('B', 40));
    expect(store.get('a')).toBe('A');
    await store.getOrLoad('c', load('C', 40));

    expect(store.get('b')).toBeUndefined();
    expect(store.get('a')).toBe('A');
    expect(store.get('c')).toBe('C');
    expect(store.size).toBe(80);
  });

  it('returns an entry over the per-entry cap without storing it', async () => {
    const store = new ImmutableResourceStore(100, 30);
    await expect(store.getOrLoad('big', load('BIG', 31))).resolves.toBe('BIG');
    expect(store.get('big')).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it('shares one load between concurrent misses', async () => {
    const store = new ImmutableResourceStore();
    let resolve: (value: { value: string; bytes: number }) => void = () =>
      undefined;
    const loader = vi.fn(
      () =>
        new Promise<{ value: string; bytes: number }>((complete) => {
          resolve = complete;
        }),
    );
    const requests = Array.from({ length: 10 }, () =>
      store.getOrLoad('asset', loader),
    );
    resolve({ value: 'bytes', bytes: 5 });

    await expect(Promise.all(requests)).resolves.toEqual(
      Array(10).fill('bytes'),
    );
    expect(loader).toHaveBeenCalledOnce();
  });

  it('stores nothing when a load fails and loads again on the next miss', async () => {
    const store = new ImmutableResourceStore();
    const failing = vi.fn(async () => {
      throw new Error('hash mismatch');
    });
    await expect(store.getOrLoad('asset', failing)).rejects.toThrow(
      'hash mismatch',
    );
    expect(store.get('asset')).toBeUndefined();

    const retry = load('ok', 2);
    await expect(store.getOrLoad('asset', retry)).resolves.toBe('ok');
    expect(retry).toHaveBeenCalledOnce();
  });

  it('counts grown bytes toward the total and evicts other entries for them', async () => {
    const store = new ImmutableResourceStore(100, 60);
    await store.getOrLoad('a', load('A', 50));
    await store.getOrLoad('b', load('B', 40));

    expect(store.grow('b', 20)).toBe(true);
    expect(store.get('a')).toBeUndefined();
    expect(store.size).toBe(60);
  });

  it('refuses to grow a missing entry or past the total', async () => {
    const store = new ImmutableResourceStore(100, 60);
    await store.getOrLoad('a', load('A', 50));

    expect(store.grow('missing', 1)).toBe(false);
    expect(store.grow('a', 51)).toBe(false);
    expect(store.size).toBe(50);
  });
});
