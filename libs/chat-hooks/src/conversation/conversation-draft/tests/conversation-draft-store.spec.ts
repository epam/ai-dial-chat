import { describe, expect, it } from 'vitest';
import type {
  ConversationDraft,
  ConversationDraftStore,
  MemoryConversationDraftStoreOptions,
} from '../conversation-draft';
import {
  createMemoryConversationDraftStore,
  createWebStorageConversationDraftStore,
} from '../conversation-draft-store';

const STORAGE_KEY = 'test:drafts';

/** Minimal in-test `Storage` so lib code never touches jsdom's real storages. */
const createFakeStorage = (
  overrides: Partial<Storage> = {},
): Storage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    ...overrides,
  };
};

const draft = (text: string, updatedAt = 1): ConversationDraft => ({
  text,
  skills: [],
  updatedAt,
});

const stripPrefix = (id: string): string =>
  id.replace(/^\/conversations\//, '');

const factories: [
  string,
  (options?: MemoryConversationDraftStoreOptions) => ConversationDraftStore,
][] = [
  [
    'createWebStorageConversationDraftStore',
    (options) => {
      const storage = createFakeStorage();
      return createWebStorageConversationDraftStore({
        getStorage: () => storage,
        storageKey: STORAGE_KEY,
        ...options,
      });
    },
  ],
  ['createMemoryConversationDraftStore', createMemoryConversationDraftStore],
];

describe.each(factories)('%s', (_name, createStore) => {
  it('round-trips a draft', () => {
    const store = createStore();
    const value: ConversationDraft = {
      text: 'hello',
      skills: [{ url: 'skills/bucket/summarize' }],
      updatedAt: 5,
    };
    store.write('a', value);
    expect(store.read('a')).toEqual(value);
    expect(store.read('b')).toBeUndefined();
  });

  it('reads no draft for an id named like an Object.prototype key', () => {
    const store = createStore();
    store.write('a', draft('hello'));
    expect(store.read('constructor')).toBeUndefined();
    expect(() => store.remove('toString')).not.toThrow();
    expect(store.read('a')?.text).toBe('hello');
  });

  it('merges route forms through normalizeId', () => {
    const store = createStore({ normalizeId: stripPrefix });
    store.write('/conversations/abc', draft('hi'));
    expect(store.read('abc')?.text).toBe('hi');
  });

  it('evicts the oldest-updatedAt draft beyond maxEntries', () => {
    const store = createStore();
    for (let i = 0; i < 50; i += 1) {
      store.write(`c${i}`, draft(`t${i}`, 100 + i));
    }
    store.write('c50', draft('t50', 1000));
    expect(store.read('c0')).toBeUndefined();
    expect(store.read('c1')?.text).toBe('t1');
    expect(store.read('c50')?.text).toBe('t50');
  });

  it('honours a custom maxEntries', () => {
    const store = createStore({ maxEntries: 2 });
    store.write('a', draft('a', 1));
    store.write('b', draft('b', 2));
    store.write('c', draft('c', 3));
    expect(store.read('a')).toBeUndefined();
    expect(store.read('c')?.text).toBe('c');
  });

  it('removes the entry when an empty draft is written', () => {
    const store = createStore();
    store.write('a', draft('hello'));
    store.write('a', draft('   '));
    expect(store.read('a')).toBeUndefined();
  });

  it('keeps a whitespace-text draft that still has skills', () => {
    const store = createStore();
    store.write('a', {
      text: ' ',
      skills: [{ url: 'skills/bucket/x' }],
      updatedAt: 1,
    });
    expect(store.read('a')?.skills).toHaveLength(1);
  });

  it('removes one entry and clears all', () => {
    const store = createStore();
    store.write('a', draft('a'));
    store.write('b', draft('b'));
    store.remove('a');
    expect(store.read('a')).toBeUndefined();
    expect(store.read('b')?.text).toBe('b');
    store.clear();
    expect(store.read('b')).toBeUndefined();
  });
});

describe('createWebStorageConversationDraftStore', () => {
  it('writes a versioned blob under storageKey and clear removes the key', () => {
    const storage = createFakeStorage();
    const store = createWebStorageConversationDraftStore({
      getStorage: () => storage,
      storageKey: STORAGE_KEY,
    });
    store.write('a', draft('hello', 7));
    expect(JSON.parse(storage.data.get(STORAGE_KEY) ?? '')).toEqual({
      version: 1,
      drafts: { a: draft('hello', 7) },
    });
    store.clear();
    expect(storage.data.has(STORAGE_KEY)).toBe(false);
  });

  it.each([
    ['malformed JSON', '{not json'],
    [
      'an unknown version',
      JSON.stringify({ version: 2, drafts: { a: draft('x') } }),
    ],
    ['a non-object drafts field', JSON.stringify({ version: 1, drafts: 'x' })],
  ])('reads %s as empty', (_label, raw) => {
    const storage = createFakeStorage();
    storage.data.set(STORAGE_KEY, raw);
    const store = createWebStorageConversationDraftStore({
      getStorage: () => storage,
      storageKey: STORAGE_KEY,
    });
    expect(store.read('a')).toBeUndefined();
  });

  it.each<[string, () => Storage | undefined]>([
    ['an undefined storage', () => undefined],
    [
      'a throwing getStorage',
      () => {
        throw new Error('blocked');
      },
    ],
    [
      'a throwing getItem/setItem/removeItem',
      () =>
        createFakeStorage({
          getItem: () => {
            throw new Error('denied');
          },
          setItem: () => {
            throw new Error('denied');
          },
          removeItem: () => {
            throw new Error('denied');
          },
        }),
    ],
  ])('never throws with %s', (_label, getStorage) => {
    const store = createWebStorageConversationDraftStore({
      getStorage,
      storageKey: STORAGE_KEY,
    });
    expect(() => store.write('a', draft('x'))).not.toThrow();
    expect(store.read('a')).toBeUndefined();
    expect(() => store.remove('a')).not.toThrow();
    expect(() => store.clear()).not.toThrow();
  });

  it('evicts the oldest half and retries once when the quota is exceeded', () => {
    const storage = createFakeStorage();
    const realSetItem = storage.setItem;
    let attempts = 0;
    storage.setItem = (key, value) => {
      attempts += 1;
      if (attempts === 1) {
        throw new DOMException('full', 'QuotaExceededError');
      }
      realSetItem(key, value);
    };
    const seed: Record<string, ConversationDraft> = {
      a: draft('a', 1),
      b: draft('b', 2),
      c: draft('c', 3),
    };
    storage.data.set(STORAGE_KEY, JSON.stringify({ version: 1, drafts: seed }));
    const store = createWebStorageConversationDraftStore({
      getStorage: () => storage,
      storageKey: STORAGE_KEY,
    });

    store.write('d', draft('d', 4));

    expect(attempts).toBe(2);
    expect(store.read('a')).toBeUndefined();
    expect(store.read('b')).toBeUndefined();
    expect(store.read('c')?.text).toBe('c');
    expect(store.read('d')?.text).toBe('d');
  });
});
