import { ConflictException, Injectable, Logger } from '@nestjs/common';

const STALE_ENTRY_TTL_MS = 30 * 60 * 1000; // 30 minutes

export enum GenerationStatus {
  Active = 'active',
  Stopped = 'stopped',
  Done = 'done',
  Error = 'error',
}

interface GenerationEntry {
  generationId: string;
  abortController: AbortController;
  status: GenerationStatus;
  startedAt: number;
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
    this.registry.set(key, {
      generationId,
      abortController,
      status: GenerationStatus.Active,
      startedAt: Date.now(),
    });
    return abortController;
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
      this.registry.delete(key);
    }
  }

  error(sessionId: string, path: string, generationId: string): void {
    const key = this.buildKey(sessionId, path);
    const entry = this.registry.get(key);
    if (entry?.generationId === generationId) {
      entry.status = GenerationStatus.Error;
      this.registry.delete(key);
    }
  }
}
