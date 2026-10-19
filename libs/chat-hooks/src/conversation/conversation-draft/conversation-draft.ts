import type { RequestSkill } from '@epam/ai-dial-chat-shared';

/** An unsent composer draft kept for one conversation. */
export interface ConversationDraft {
  /** The composer text as the user left it. */
  text: string;
  /** Skills mentioned in the draft, in the same shape a sent message carries. */
  skills: RequestSkill[];
  /** Epoch milliseconds of the last change; the oldest entry is evicted first. */
  updatedAt: number;
}

/**
 * Synchronous, never-throwing persistence contract for conversation drafts.
 *
 * The host creates and owns the instance: it decides the storage medium, the
 * key, the user scope and how conversation ids are canonicalised. A host with
 * async persistence wraps it behind a synchronous in-memory cache, because the
 * restore runs before the user can type and the flush on unmount must finish
 * synchronously.
 */
export interface ConversationDraftStore {
  /** Returns the stored draft for `conversationId`, or `undefined` when there is none. */
  read: (conversationId: string) => ConversationDraft | undefined;
  /** Stores `draft` for `conversationId`; an empty draft removes the entry instead. */
  write: (conversationId: string, draft: ConversationDraft) => void;
  /** Removes the draft for `conversationId`. */
  remove: (conversationId: string) => void;
  /** Removes every draft the store holds. */
  clear: () => void;
}

/** Options shared by both store factories. */
export interface MemoryConversationDraftStoreOptions {
  /** Maximum number of drafts kept; the oldest-`updatedAt` entry is evicted beyond it. Defaults to `50`. */
  maxEntries?: number;
  /** Canonicalises a conversation id before it is used as an entry key. Defaults to identity. */
  normalizeId?: (conversationId: string) => string;
}

/** Options for `createWebStorageConversationDraftStore`. */
export interface WebStorageConversationDraftStoreOptions extends MemoryConversationDraftStoreOptions {
  /**
   * Returns the `Storage` to use, or `undefined` when none is available. It is
   * a getter so an absent or throwing storage accessor (SSR, tests, blocked
   * site data) is handled inside the store's guard.
   */
  getStorage: () => Storage | undefined;
  /** The single key all drafts are written under, including any user scope the host needs. */
  storageKey: string;
}
