import { createHash } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  ConversationTitleQueueOutcome,
  ConversationTitleReadOutcome,
  recordConversationTitleQueue,
  recordConversationTitleRead,
  secondsSince,
} from '../../telemetry/conversation-title-metrics';
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

/**
 * One coalesced read. It owns its abort controller, so a consumer leaving
 * cannot abort work another consumer still needs; the last one leaving does.
 */
interface TitleReadOperation {
  promise: Promise<ConversationTitleSummary | undefined>;
  controller: AbortController;
  consumers: number;
}

interface TitleCacheEntry {
  summary?: ConversationTitleSummary;
  expiresAt: number;
  metadataUpdatedAt?: number;
  pending?: TitleReadOperation;
}

/**
 * The process-wide read gate refused or timed out this read. Distinct from an
 * upstream 503 because it is local overload, not a per-item Core failure.
 */
export class ConversationTitleQueueUnavailableException extends ServiceUnavailableException {}

const abortError = (): DOMException =>
  new DOMException('Conversation title read was cancelled', 'AbortError');

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

  /**
   * Resolves a title through the cache, coalescing equivalent reads. `signal`
   * is this consumer's ownership: aborting it rejects only this call, and
   * cancels the shared read (queued or active) once no consumer remains.
   */
  async load(
    token: string,
    id: string,
    read: (signal: AbortSignal) => Promise<ConversationTitleSummary>,
    signal?: AbortSignal,
  ): Promise<ConversationTitleSummary | undefined> {
    if (signal?.aborted) throw abortError();
    const cached = this.get(token, id);
    if (cached) return cached;
    const key = this.key(token, id);
    if (!key) return undefined;
    const entry = this.entries.get(key) ?? { expiresAt: 0 };
    if (entry.pending && !entry.pending.controller.signal.aborted) {
      return this.consume(entry.pending, signal);
    }
    this.put(key, entry);
    const controller = new AbortController();
    const operation: TitleReadOperation = {
      controller,
      consumers: 0,
      promise: this.withReadSlot(read, controller.signal)
        .then((summary) => {
          if (controller.signal.aborted) throw abortError();
          if (this.entries.get(key) !== entry) return this.get(token, id);
          this.storeSummary(entry, summary);
          return entry.summary;
        })
        .finally(() => {
          if (entry.pending !== operation) return;
          entry.pending = undefined;
          if (!entry.summary && this.entries.get(key) === entry) {
            this.entries.delete(key);
          }
        }),
    };
    entry.pending = operation;
    return this.consume(operation, signal);
  }

  private consume(
    operation: TitleReadOperation,
    signal?: AbortSignal,
  ): Promise<ConversationTitleSummary | undefined> {
    operation.consumers++;
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        reject(abortError());
        if (--operation.consumers === 0) operation.controller.abort();
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      operation.promise.then(
        (summary) => {
          signal?.removeEventListener('abort', onAbort);
          resolve(summary);
        },
        (error: unknown) => {
          signal?.removeEventListener('abort', onAbort);
          reject(error);
        },
      );
    });
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

  /**
   * Admits `read` through the process-wide gate. A cancelled queued read
   * leaves the queue; a cancelled active read keeps its slot until the
   * underlying call settles, so cancellation never exceeds the cap.
   */
  private async withReadSlot<T>(
    read: (signal: AbortSignal) => Promise<T>,
    signal: AbortSignal,
  ): Promise<T> {
    const queuedAt = performance.now();
    if (this.activeReads >= MAX_CONCURRENT_READS) {
      if (this.waiting.length >= MAX_PENDING_READS) {
        recordConversationTitleQueue(0, ConversationTitleQueueOutcome.Rejected);
        throw new ConversationTitleQueueUnavailableException(
          'Conversation title reads are busy',
        );
      }
      try {
        await this.waitForReadSlot(signal);
      } catch (error) {
        recordConversationTitleQueue(
          secondsSince(queuedAt),
          signal.aborted
            ? ConversationTitleQueueOutcome.Cancelled
            : ConversationTitleQueueOutcome.Rejected,
        );
        throw error;
      }
    } else {
      this.activeReads++;
    }
    recordConversationTitleQueue(
      secondsSince(queuedAt),
      ConversationTitleQueueOutcome.Admitted,
    );
    try {
      if (signal.aborted) throw abortError();
      const readStartedAt = performance.now();
      let outcome = ConversationTitleReadOutcome.Failed;
      try {
        const result = await read(signal);
        outcome = ConversationTitleReadOutcome.Success;
        return result;
      } catch (error) {
        if (signal.aborted) outcome = ConversationTitleReadOutcome.Cancelled;
        throw error;
      } finally {
        recordConversationTitleRead(secondsSince(readStartedAt), outcome);
      }
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.activeReads--;
    }
  }

  /** Resolves once a slot is handed over; rejects on cancellation or timeout. */
  private waitForReadSlot(signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const leave = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        const index = this.waiting.indexOf(enter);
        if (index !== -1) this.waiting.splice(index, 1);
      };
      const enter = () => {
        leave();
        resolve();
      };
      const onAbort = () => {
        leave();
        reject(abortError());
      };
      const timer = setTimeout(() => {
        leave();
        reject(
          new ConversationTitleQueueUnavailableException(
            'Conversation title read queue timed out',
          ),
        );
      }, CONVERSATION_TITLE_QUEUE_WAIT_MS);
      signal.addEventListener('abort', onAbort, { once: true });
      this.waiting.push(enter);
    });
  }
}
