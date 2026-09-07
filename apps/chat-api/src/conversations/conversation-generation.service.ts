import { EventEmitter } from 'node:events';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from './dto/conversation-message.dto';

const STALE_ENTRY_TTL_MS = 30 * 60 * 1000; // 30 minutes

export enum GenerationStatus {
  Active = 'active',
  Stopped = 'stopped',
  Done = 'done',
  Error = 'error',
}

/**
 * Terminal event delivered to attach subscribers (`generation-live-replay`)
 * when a generation finishes, in any outcome. Mirrors the three ways
 * `ConversationStreamingService.finalize` already distinguishes an ended
 * generation for persistence purposes.
 */
export type GenerationTerminalEvent =
  | { type: 'done' }
  | { type: 'error'; message?: string }
  | { type: 'stopped' };

/** Snapshot-then-live-subscription handle returned by `attach`. */
export interface GenerationAttachment {
  /** The assistant message as assembled at the moment of attaching. */
  assembledMessage: ConversationMessageDto;
  /**
   * Emits `'chunk'` with the raw parsed delta chunk for every chunk applied
   * after the snapshot was taken, and exactly one `'terminal'` event (see
   * `GenerationTerminalEvent`) when the generation ends.
   */
  emitter: EventEmitter;
}

const createPlaceholderMessage = (): ConversationMessageDto => ({
  role: ConversationMessageRole.Assistant,
  content: '',
  timestamp: new Date().toISOString(),
});

interface GenerationEntry {
  generationId: string;
  abortController: AbortController;
  status: GenerationStatus;
  startedAt: number;
  /**
   * The assistant message as currently assembled. Seeded with an empty
   * placeholder at `register`, overwritten once with the real start-state
   * message via `seedAssembledMessage`, then kept current by `applyChunk` as
   * the generation streams — so a late `attach` always has something valid
   * to snapshot.
   */
  assembledMessage: ConversationMessageDto;
  /** Per-generation event bus for `generation-live-replay` attach subscribers. */
  emitter: EventEmitter;
}

@Injectable()
export class ConversationGenerationService {
  private readonly logger = new Logger(ConversationGenerationService.name);
  private readonly registry = new Map<string, GenerationEntry>();

  private buildKey(sessionId: string, path: string): string {
    return `${sessionId}::${path}`;
  }

  private evictStale(): void {
    const cutoff = Date.now() - STALE_ENTRY_TTL_MS;
    for (const [key, entry] of this.registry) {
      if (entry.startedAt < cutoff) {
        this.logger.warn(`Evicting stale generation entry: ${key}`);
        this.registry.delete(key);
      }
    }
  }

  register(
    sessionId: string,
    path: string,
    generationId: string,
  ): AbortController {
    this.evictStale();

    const key = this.buildKey(sessionId, path);
    const existing = this.registry.get(key);
    if (existing?.status === GenerationStatus.Active) {
      throw new ConflictException(
        `A generation is already active for this conversation. Stop it before starting a new one.`,
      );
    }

    const abortController = new AbortController();
    const emitter = new EventEmitter();
    /*
     * Multiple tabs of the same login can all attach to the same generation
     * (generation-live-replay) — unbounded on purpose, each subscriber
     * removes its own listener on terminal/disconnect.
     */
    emitter.setMaxListeners(0);
    this.registry.set(key, {
      generationId,
      abortController,
      status: GenerationStatus.Active,
      startedAt: Date.now(),
      assembledMessage: createPlaceholderMessage(),
      emitter,
    });
    return abortController;
  }

  /**
   * Overwrites the registry's assembled-message snapshot with the real
   * start-state message once `ConversationStreamingService.streamCompletion`
   * builds it — narrows the window during which `attach` would only see the
   * generic placeholder from `register`. Not itself a chunk, so it emits
   * nothing.
   */
  seedAssembledMessage(
    sessionId: string,
    path: string,
    generationId: string,
    message: ConversationMessageDto,
  ): void {
    const entry = this.registry.get(this.buildKey(sessionId, path));
    if (!entry || entry.generationId !== generationId) return;
    entry.assembledMessage = message;
  }

  /**
   * Called once per chunk applied to the in-flight assistant message.
   * Updates the retained snapshot and broadcasts the raw delta to every
   * currently-attached late subscriber.
   */
  applyChunk(
    sessionId: string,
    path: string,
    generationId: string,
    rawChunk: unknown,
    message: ConversationMessageDto,
  ): void {
    const entry = this.registry.get(this.buildKey(sessionId, path));
    if (!entry || entry.generationId !== generationId) return;
    entry.assembledMessage = message;
    entry.emitter.emit('chunk', rawChunk);
  }

  /**
   * Synchronously returns the current assembled-message snapshot and the
   * emitter to subscribe to, or `undefined` when no active generation exists
   * for this session+path — including when one existed but already
   * finalized. Callers MUST attach their listener in the same synchronous
   * step as reading `assembledMessage` (no `await` in between), so no chunk
   * emitted concurrently can land in the gap between the two.
   */
  attach(sessionId: string, path: string): GenerationAttachment | undefined {
    const entry = this.registry.get(this.buildKey(sessionId, path));
    if (!entry) return undefined;
    return { assembledMessage: entry.assembledMessage, emitter: entry.emitter };
  }

  abort(sessionId: string, path: string, generationId: string): boolean {
    const key = this.buildKey(sessionId, path);
    const entry = this.registry.get(key);
    if (
      !entry ||
      entry.generationId !== generationId ||
      entry.status !== GenerationStatus.Active
    ) {
      return false;
    }
    entry.status = GenerationStatus.Stopped;
    entry.abortController.abort();
    return true;
  }

  getStatus(sessionId: string, path: string): GenerationStatus | undefined {
    const key = this.buildKey(sessionId, path);
    return this.registry.get(key)?.status;
  }

  complete(sessionId: string, path: string, generationId: string): void {
    const key = this.buildKey(sessionId, path);
    const entry = this.registry.get(key);
    if (entry?.generationId === generationId) {
      entry.status = GenerationStatus.Done;
      entry.emitter.emit('terminal', {
        type: 'done',
      } satisfies GenerationTerminalEvent);
      entry.emitter.removeAllListeners();
      this.registry.delete(key);
    }
  }

  /**
   * `entry.status` distinguishes a user-initiated stop from a genuine error:
   * `abort()` sets it to `Stopped` before the streaming loop unwinds and
   * calls this method, so a stop is never reported to attach subscribers as
   * an error.
   */
  error(
    sessionId: string,
    path: string,
    generationId: string,
    message?: string,
  ): void {
    const key = this.buildKey(sessionId, path);
    const entry = this.registry.get(key);
    if (entry?.generationId === generationId) {
      const wasStopped = entry.status === GenerationStatus.Stopped;
      entry.status = GenerationStatus.Error;
      entry.emitter.emit(
        'terminal',
        (wasStopped
          ? { type: 'stopped' }
          : { type: 'error', message }) satisfies GenerationTerminalEvent,
      );
      entry.emitter.removeAllListeners();
      this.registry.delete(key);
    }
  }
}
