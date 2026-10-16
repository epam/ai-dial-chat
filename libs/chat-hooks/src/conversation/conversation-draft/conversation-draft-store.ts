import type {
  ConversationDraft,
  ConversationDraftStore,
  MemoryConversationDraftStoreOptions,
  WebStorageConversationDraftStoreOptions,
} from './conversation-draft';

const DEFAULT_MAX_ENTRIES = 50;
const DRAFTS_FORMAT_VERSION = 1;

type DraftMap = Record<string, ConversationDraft>;

interface DraftsBlob {
  version: typeof DRAFTS_FORMAT_VERSION;
  drafts: DraftMap;
}

const identity = (id: string): string => id;

const isEmptyDraft = (draft: ConversationDraft): boolean =>
  draft.text.trim() === '' && draft.skills.length === 0;

const isDraft = (value: unknown): value is ConversationDraft => {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Partial<ConversationDraft>;
  return (
    typeof candidate.text === 'string' &&
    Array.isArray(candidate.skills) &&
    typeof candidate.updatedAt === 'number'
  );
};

/** Returns the draft stored for `id`, ignoring keys inherited from `Object.prototype`. */
const readOwn = (
  drafts: DraftMap,
  id: string,
): ConversationDraft | undefined =>
  Object.hasOwn(drafts, id) ? drafts[id] : undefined;

/** Returns the ids of `drafts` ordered from the oldest `updatedAt` to the newest. */
const idsByAge = (drafts: DraftMap): string[] =>
  Object.keys(drafts).sort((a, b) => drafts[a].updatedAt - drafts[b].updatedAt);

/** Drops the oldest entries until at most `maxEntries` remain. */
const capEntries = (drafts: DraftMap, maxEntries: number): DraftMap => {
  const ids = idsByAge(drafts);
  const excess = ids.length - Math.max(maxEntries, 0);
  if (excess <= 0) return drafts;
  const next = { ...drafts };
  ids.slice(0, excess).forEach((id) => delete next[id]);
  return next;
};

/** Returns `drafts` with `draft` applied for `id` — an empty draft removes the entry. */
const applyWrite = (
  drafts: DraftMap,
  id: string,
  draft: ConversationDraft,
  maxEntries: number,
): DraftMap => {
  const next = { ...drafts };
  if (isEmptyDraft(draft)) {
    delete next[id];
    return next;
  }
  next[id] = draft;
  return capEntries(next, maxEntries);
};

const isQuotaError = (error: unknown): boolean =>
  error instanceof DOMException &&
  (error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

/**
 * Creates a `ConversationDraftStore` over a host-chosen Web `Storage`.
 *
 * Every host-specific fact — which storage, which key (including any user
 * scope), how ids are canonicalised — arrives through `options`. The store owns
 * only the versioned JSON format of its own data
 * (`{ version: 1, drafts: { [id]: ConversationDraft } }`), the `maxEntries`
 * cap with oldest-first eviction, a half-eviction retry when the quota is
 * exceeded, and silent failure: an absent or throwing storage behaves as an
 * empty store that ignores writes.
 */
export const createWebStorageConversationDraftStore = ({
  getStorage,
  storageKey,
  maxEntries = DEFAULT_MAX_ENTRIES,
  normalizeId = identity,
}: WebStorageConversationDraftStoreOptions): ConversationDraftStore => {
  const resolveStorage = (): Storage | undefined => {
    try {
      return getStorage();
    } catch {
      return undefined;
    }
  };

  const load = (): DraftMap => {
    try {
      const raw = resolveStorage()?.getItem(storageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Partial<DraftsBlob> | null;
      if (
        parsed == null ||
        parsed.version !== DRAFTS_FORMAT_VERSION ||
        parsed.drafts == null ||
        typeof parsed.drafts !== 'object'
      ) {
        return {};
      }
      return Object.fromEntries(
        Object.entries(parsed.drafts).filter(([, draft]) => isDraft(draft)),
      );
    } catch {
      return {};
    }
  };

  const persist = (storage: Storage, drafts: DraftMap): void => {
    if (Object.keys(drafts).length === 0) {
      storage.removeItem(storageKey);
      return;
    }
    const blob: DraftsBlob = { version: DRAFTS_FORMAT_VERSION, drafts };
    storage.setItem(storageKey, JSON.stringify(blob));
  };

  const save = (drafts: DraftMap): void => {
    const storage = resolveStorage();
    if (!storage) return;
    try {
      persist(storage, drafts);
    } catch (error) {
      if (!isQuotaError(error)) return;
      try {
        const ids = idsByAge(drafts);
        persist(storage, capEntries(drafts, Math.floor(ids.length / 2)));
      } catch {
        // The retry failed too; the draft is dropped rather than thrown.
      }
    }
  };

  return {
    read: (conversationId) => readOwn(load(), normalizeId(conversationId)),
    write: (conversationId, draft) =>
      save(applyWrite(load(), normalizeId(conversationId), draft, maxEntries)),
    remove: (conversationId) => {
      const drafts = load();
      const id = normalizeId(conversationId);
      if (!Object.hasOwn(drafts, id)) return;
      delete drafts[id];
      save(drafts);
    },
    clear: () => {
      try {
        resolveStorage()?.removeItem(storageKey);
      } catch {
        // Ignored: a blocked storage has nothing to clear.
      }
    },
  };
};

/**
 * Creates a `ConversationDraftStore` that keeps drafts in memory for the
 * lifetime of the returned instance. Same semantics as the Web Storage store
 * (`maxEntries`, `normalizeId`, empty-draft removal); suited to hosts that want
 * drafts only for the page lifetime, and to tests.
 */
export const createMemoryConversationDraftStore = ({
  maxEntries = DEFAULT_MAX_ENTRIES,
  normalizeId = identity,
}: MemoryConversationDraftStoreOptions = {}): ConversationDraftStore => {
  let drafts: DraftMap = {};

  return {
    read: (conversationId) => readOwn(drafts, normalizeId(conversationId)),
    write: (conversationId, draft) => {
      drafts = applyWrite(
        drafts,
        normalizeId(conversationId),
        draft,
        maxEntries,
      );
    },
    remove: (conversationId) => {
      const id = normalizeId(conversationId);
      if (!Object.hasOwn(drafts, id)) return;
      const next = { ...drafts };
      delete next[id];
      drafts = next;
    },
    clear: () => {
      drafts = {};
    },
  };
};
