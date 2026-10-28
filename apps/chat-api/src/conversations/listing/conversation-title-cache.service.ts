import { createHash } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { parseConversationResourceId } from '../utils/conversation-resource-id';

export const CONVERSATION_TITLE_CACHE_TTL_MS = 5 * 60_000;
export const CONVERSATION_TITLE_CACHE_MAX_ENTRIES = 5000;
const MAX_TITLE_LENGTH = 4096;
const MAX_CONCURRENT_READS = 25;
const MAX_PENDING_READS = 250;
export const CONVERSATION_TITLE_QUEUE_WAIT_MS = 5000;

export interface ConversationTitleSummary {
  name?: string;
  llmNamingDone?: boolean;
}

interface TitleCacheEntry {
  summary?: ConversationTitleSummary;
  expiresAt: number;
  metadataUpdatedAt?: number;
  pending?: Promise<ConversationTitleSummary | undefined>;
}

/**
 * Process-local, bounded title summaries. Tokens are hashed; bodies are never
 * retained. Entry identity fences reads against later writes and invalidations.
 */
@Injectable()
export class ConversationTitleCacheService {
  private readonly entries = new Map<string, TitleCacheEntry>();
  private readonly waiting: Array<() => void> = [];
  private activeReads = 0;

  get(
    token: string,
    id: string,
    updatedAt?: number,
  ): ConversationTitleSummary | undefined {
    const key = this.key(token, id);
    if (!key) return undefined;
    let entry = this.entries.get(key);
    if (!entry) return undefined;
    if (
      updatedAt != null &&
      updatedAt > 0 &&
      entry.metadataUpdatedAt != null &&
      updatedAt > entry.metadataUpdatedAt
    ) {
      entry = { expiresAt: 0, metadataUpdatedAt: updatedAt };
      this.put(key, entry);
    } else if (updatedAt != null && updatedAt > 0) {
      entry.metadataUpdatedAt = updatedAt;
    }
    this.touch(key, entry);
    return entry.expiresAt > Date.now() ? entry.summary : undefined;
  }

  /** Captures a read before I/O so a later successful write always wins. */
  reader(
    token: string,
    id: string,
  ): (summary?: ConversationTitleSummary) => void {
    const key = this.key(token, id);
    if (!key) return () => undefined;
    const entry = this.entries.get(key) ?? { expiresAt: 0 };
    this.put(key, entry);
    return (summary) => {
      if (this.entries.get(key) !== entry) return;
      if (summary) this.storeSummary(entry, summary);
      else this.entries.delete(key);
    };
  }

  set(token: string, id: string, summary: ConversationTitleSummary): void {
    const key = this.key(token, id);
    if (!key) return;
    const entry: TitleCacheEntry = { expiresAt: 0 };
    this.storeSummary(entry, summary);
    this.put(key, entry);
  }

  invalidate(token: string, id: string): void {
    const key = this.key(token, id);
    if (key) this.entries.delete(key);
  }

  async load(
    token: string,
    id: string,
    read: () => Promise<ConversationTitleSummary>,
  ): Promise<ConversationTitleSummary | undefined> {
    const cached = this.get(token, id);
    if (cached) return cached;
    const key = this.key(token, id);
    if (!key) return undefined;
    const entry = this.entries.get(key) ?? { expiresAt: 0 };
    if (entry.pending) return entry.pending;
    this.put(key, entry);
    const pending = this.withReadSlot(read).then((summary) => {
      if (this.entries.get(key) !== entry) return this.get(token, id);
      this.storeSummary(entry, summary);
      return entry.summary;
    });
    entry.pending = pending;
    try {
      return await pending;
    } finally {
      if (entry.pending === pending) entry.pending = undefined;
    }
  }

  private key(token: string, id: string): string | undefined {
    const resource = parseConversationResourceId(id);
    if (!resource) return undefined;
    const principal = createHash('sha256').update(token).digest('hex');
    return `conversations:title:${principal}:${resource.id}`;
  }

  private storeSummary(
    entry: TitleCacheEntry,
    summary: ConversationTitleSummary,
  ): void {
    entry.summary = {
      name:
        typeof summary.name === 'string' &&
        summary.name.length <= MAX_TITLE_LENGTH
          ? summary.name
          : undefined,
      llmNamingDone: summary.llmNamingDone === true,
    };
    entry.expiresAt = Date.now() + CONVERSATION_TITLE_CACHE_TTL_MS;
  }

  private touch(key: string, entry: TitleCacheEntry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private put(key: string, entry: TitleCacheEntry): void {
    this.touch(key, entry);
    while (this.entries.size > CONVERSATION_TITLE_CACHE_MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest != null) this.entries.delete(oldest);
    }
  }

  private async withReadSlot<T>(read: () => Promise<T>): Promise<T> {
    if (this.activeReads >= MAX_CONCURRENT_READS) {
      if (this.waiting.length >= MAX_PENDING_READS) {
        throw new ServiceUnavailableException(
          'Conversation title reads are busy',
        );
      }
      await new Promise<void>((resolve, reject) => {
        const enter = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          const index = this.waiting.indexOf(enter);
          if (index !== -1) this.waiting.splice(index, 1);
          reject(
            new ServiceUnavailableException(
              'Conversation title read queue timed out',
            ),
          );
        }, CONVERSATION_TITLE_QUEUE_WAIT_MS);
        this.waiting.push(enter);
      });
    } else {
      this.activeReads++;
    }
    try {
      return await read();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.activeReads--;
    }
  }
}
