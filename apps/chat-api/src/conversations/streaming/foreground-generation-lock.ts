import {
  ConflictException,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import {
  ConditionalUpdateStatus,
  type VersionedConversation,
} from '../conversation-persistence.port';
import { GENERATION_ACTIVE_MESSAGE } from '../generation/background-generation.service';
import {
  BackgroundWriteResult,
  type StoredMessage,
} from '../generation/background-message';
import {
  ConversationGenerationService,
  GenerationCancelReason,
  GenerationStatus,
  type GenerationLease,
} from '../generation/conversation-generation.service';
import {
  FOREGROUND_REREAD_INTERVAL_MS,
  buildForegroundMarker,
  buildForegroundStopReleaseMs,
  findActiveGeneration,
  findForegroundMessageIndex,
  neutralizeForegroundMarkers,
} from '../generation/foreground-generation';
import {
  ForegroundStopResult,
  releasedForegroundFields,
  type ForegroundStopErrorDetails,
  storeForegroundStop,
  updateForegroundMessage,
} from '../generation/foreground-message';
import {
  ForegroundGenerationOutcome,
  foregroundGenerationOutcomesTotal,
} from '../generation/generation-metrics';
import type { GenerationPersistenceTerminalMarker } from '../generation/persistence-error';
import { ConversationPersistenceService } from '../persistence/conversation-persistence.service';
import type { buildConversationHistory } from '../utils/conversation-history-builder';
import { mergeHtmlTagAnnotationsIntoViewState } from '../utils/conversation-view-state.server';

/** Start state of a foreground generation: the conversation and its placeholder's index. */
export type ForegroundStartState = ReturnType<typeof buildConversationHistory>;

/** Where one foreground generation's marker lives. */
export interface ForegroundMarkerLocation {
  conversationPath: string;
  token: string;
  bucket: string;
  generationId: string;
}

/** A start-state write: the marker location plus the history builder run on the stored version. */
export interface ForegroundStartWrite extends ForegroundMarkerLocation {
  build: (conversation: ConversationResponseDto) => ForegroundStartState;
}

/** The terminal statuses a foreground generation is finalized with. */
export type ForegroundTerminalStatus =
  GenerationStatus.Done | GenerationStatus.Stopped | GenerationStatus.Error;

/** Why the terminal write did not persist; reported to the client after the stream. */
export interface ForegroundPersistenceFailure {
  status: number | undefined;
  marker: GenerationPersistenceTerminalMarker | undefined;
}

/** Timing bounds stored on the foreground marker. */
export interface ForegroundLockBounds {
  maxGenerationDurationMs: number;
  finalizeTimeoutMs: number;
}

/**
 * The conversation-stored lock of a foreground generation
 * (`foreground-generation-lock`): the conditional start-state write with its marker,
 * its release, the re-reads that pick up a stored Stop, and the terminal write. Owned by
 * `ConversationStreamingService`, which passes its own logger.
 */
export class ForegroundGenerationLock {
  constructor(
    private readonly persistenceService: ConversationPersistenceService,
    private readonly generationService: ConversationGenerationService,
    private readonly logger: Logger,
    private readonly bounds: ForegroundLockBounds,
  ) {}

  /**
   * Stores the start state of a foreground generation with its marker, through a
   * conditional update on the latest version: an active generation is a `409`, an expired
   * marker is neutralized, and the history is built on the version being written.
   * @param params - conversation location, generation id and the history builder
   * @param initial - the version already read, used for the first attempt
   */
  async writeStartState(
    params: ForegroundStartWrite,
    initial: VersionedConversation | undefined,
  ): Promise<ForegroundStartState> {
    let written: ForegroundStartState | undefined;
    let isUnfenced = false;
    let isExpiredTakeover = false;
    const result = await this.persistenceService.updateConversation(
      params.conversationPath,
      params.token,
      params.bucket,
      (stored) => {
        if (!stored) throw new NotFoundException('Conversation not found');
        if (!stored.etag) {
          isUnfenced = true;
          return null;
        }
        const now = Date.now();
        if (findActiveGeneration(stored.conversation, now)) {
          throw new ConflictException(GENERATION_ACTIVE_MESSAGE);
        }
        const storedMessages = stored.conversation.messages ?? [];
        isExpiredTakeover = storedMessages.some(
          (storedMessage) => storedMessage.foregroundGeneration != null,
        );
        const built = params.build(
          isExpiredTakeover
            ? {
                ...stored.conversation,
                messages: neutralizeForegroundMarkers(storedMessages),
              }
            : stored.conversation,
        );
        const messages = [...built.conversation.messages];
        messages[built.assistantMessageIndex] = {
          ...messages[built.assistantMessageIndex],
          foregroundGeneration: buildForegroundMarker({
            generationId: params.generationId,
            now,
            maxDurationMs: this.bounds.maxGenerationDurationMs,
            finalizeTimeoutMs: this.bounds.finalizeTimeoutMs,
          }),
        };
        written = {
          conversation: { ...built.conversation, messages },
          assistantMessageIndex: built.assistantMessageIndex,
        };
        return written.conversation;
      },
      initial,
    );
    if (result.status === ConditionalUpdateStatus.Conflict) {
      throw new ConflictException(GENERATION_ACTIVE_MESSAGE);
    }
    if (isUnfenced || result.status !== ConditionalUpdateStatus.Saved) {
      throw new ServiceUnavailableException(
        'The conversation could not be saved safely; retry shortly.',
      );
    }
    if (isExpiredTakeover) {
      foregroundGenerationOutcomesTotal.add(1, {
        outcome: ForegroundGenerationOutcome.ExpiredTakeover,
      });
    }
    return written as ForegroundStartState;
  }

  /**
   * Removes this generation's marker when the start state may have been stored but the
   * generation will not stream; the placeholder is marked interrupted. A no-op when the
   * marker was never stored. Never throws.
   * @param params - conversation location and generation id
   */
  async releaseMarker(params: ForegroundMarkerLocation): Promise<void> {
    try {
      const outcome = await updateForegroundMessage({
        persistence: this.persistenceService,
        conversationPath: params.conversationPath,
        token: params.token,
        bucket: params.bucket,
        generationId: params.generationId,
        mutate: releasedForegroundFields,
      });
      if (outcome.result === BackgroundWriteResult.Applied) {
        foregroundGenerationOutcomesTotal.add(1, {
          outcome: ForegroundGenerationOutcome.ReleasedBeforeStream,
        });
      } else if (outcome.result === BackgroundWriteResult.Failed) {
        throw new Error('Release write did not apply');
      }
    } catch (err) {
      foregroundGenerationOutcomesTotal.add(1, {
        outcome: ForegroundGenerationOutcome.ReleaseFailed,
      });
      this.logger.warn(
        `Failed to release the foreground marker — generationId: ${params.generationId}: ${err instanceof Error ? err.name : 'unknown'}`,
      );
    }
  }

  /**
   * Stores a Stop on the live marker of a foreground generation that may run on another
   * instance or under another principal (`foreground-generation-lock`).
   * @param params - conversation location and the generation id posted by the client
   */
  async storeStop(
    params: ForegroundMarkerLocation,
  ): Promise<ForegroundStopResult> {
    const errors: ForegroundStopErrorDetails[] = [];
    const result = await storeForegroundStop({
      persistence: this.persistenceService,
      ...params,
      stopReleaseMs: buildForegroundStopReleaseMs(
        this.bounds.finalizeTimeoutMs,
      ),
      onError: (details) => errors.push(details),
    });
    /*
     * A plain `not_found` is the normal answer for a generation this instance runs
     * itself, so only a thrown read or write, or a refused write, is worth a line
     * ([#9370](https://github.com/epam/ai-dial-chat/issues/9370)).
     */
    if (errors.length > 0 || result === ForegroundStopResult.Failed) {
      const errorDetails = errors.at(-1);
      this.logger.warn(
        `Foreground Stop not stored — generationId: ${params.generationId}, result: ${result}, ${errorDetails ? `${errorDetails.isRead ? 'write' : 'read'} error: ${errorDetails.errorName}` : 'error: none'}, status: ${errorDetails?.status ?? 'none'}`,
      );
    }
    if (result === ForegroundStopResult.Stored) {
      foregroundGenerationOutcomesTotal.add(1, {
        outcome: ForegroundGenerationOutcome.StopStored,
      });
    }
    return result;
  }

  /**
   * Re-reads the generation's conversation every `FOREGROUND_REREAD_INTERVAL_MS` while it
   * streams: a stored Stop ends it as a user stop, a lost marker ends it at once. Reads
   * only; one read at a time; read failures wait for the next interval.
   * @param lease - the streaming generation's lease
   * @param location - its conversation location and id
   * @returns a function that stops the re-reads; idempotent
   */
  startRereads(
    lease: GenerationLease,
    location: ForegroundMarkerLocation,
  ): () => void {
    let isReading = false;
    let isStopped = false;
    const reread = async (): Promise<void> => {
      try {
        const stored = await this.persistenceService.readConversationWithEtag(
          location.conversationPath,
          location.token,
          location.bucket,
        );
        if (isStopped) return;
        const messages = stored?.conversation.messages ?? [];
        const index = findForegroundMessageIndex(
          messages,
          location.generationId,
        );
        if (index === -1) {
          foregroundGenerationOutcomesTotal.add(1, {
            outcome: ForegroundGenerationOutcome.LockLost,
          });
          this.generationService.cancel(lease, GenerationCancelReason.LockLost);
          return;
        }
        if (messages[index].foregroundGeneration?.stopRequestedAt != null) {
          this.generationService.requestUserStop(lease);
        }
      } catch (err) {
        this.logger.debug(
          `Foreground marker re-read failed — generationId: ${location.generationId}: ${err instanceof Error ? err.name : 'unknown'}`,
        );
      }
    };
    const timer = setInterval(() => {
      if (isReading || isStopped) return;
      isReading = true;
      void reread().finally(() => {
        isReading = false;
      });
    }, FOREGROUND_REREAD_INTERVAL_MS);
    return () => {
      isStopped = true;
      clearInterval(timer);
    };
  }

  /**
   * Writes the terminal state of the generation's own marked message and settles its
   * registry entry. A failed or skipped write marks the entry's persistence as failed
   * and is returned for the client; it never throws for a write failure.
   * @param lease - the generation's lease
   * @param location - its conversation location and id
   * @param status - the terminal status
   * @param partialMessage - the assembled answer to store
   */
  async writeTerminalState(
    lease: GenerationLease,
    location: ForegroundMarkerLocation,
    status: ForegroundTerminalStatus,
    partialMessage: StoredMessage,
  ): Promise<ForegroundPersistenceFailure | undefined> {
    const annotations = partialMessage.custom_content?.annotations;
    /* A stopped, aborted, or failed answer is reported with the terminal
     * markers this write carried, so a client recovery save stores the same
     * outcome instead of an answer that reads as completed ([#9370](https://github.com/epam/ai-dial-chat/issues/9370)). */
    const terminalMarker: GenerationPersistenceTerminalMarker | undefined =
      status === GenerationStatus.Done
        ? undefined
        : {
            streamErrorMessage: partialMessage.streamErrorMessage,
            wasStoppedByUser: partialMessage.wasStoppedByUser,
          };
    /*
     * Record that the terminal write has been dispatched before awaiting
     * it (generation-registry, D5): a cancellation arriving after this
     * point is recorded for telemetry only and never adds, replaces, or
     * cancels this — the only — write operation.
     */
    this.generationService.beginFinalizing(lease);
    let outcome: Awaited<ReturnType<typeof updateForegroundMessage>>;
    try {
      /*
       * Applies only to this generation's own marked message, on the latest stored
       * version, so whatever was written meanwhile — a rename, a rating, a takeover
       * after expiry — is kept (`foreground-generation-lock`).
       */
      outcome = await updateForegroundMessage({
        persistence: this.persistenceService,
        conversationPath: location.conversationPath,
        token: location.token,
        bucket: location.bucket,
        generationId: location.generationId,
        mutate: () => ({
          content: partialMessage.content,
          custom_content: partialMessage.custom_content,
          responseId: partialMessage.responseId,
          streamErrorMessage: partialMessage.streamErrorMessage,
          wasStoppedByUser: partialMessage.wasStoppedByUser,
        }),
        mutateConversation: (conversation) => {
          try {
            const customViewState = mergeHtmlTagAnnotationsIntoViewState(
              conversation.customViewState,
              annotations,
            );
            return customViewState !== undefined
              ? { ...conversation, customViewState }
              : conversation;
          } catch (err) {
            this.logger.warn(
              'Failed to merge annotations into customViewState',
              err,
            );
            return conversation;
          }
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to save ${status} conversation`, err);
      this.generationService.persistenceFailed(lease);
      return {
        status: err instanceof HttpException ? err.getStatus() : undefined,
        marker: terminalMarker,
      };
    }
    if (outcome.result !== BackgroundWriteResult.Applied) {
      foregroundGenerationOutcomesTotal.add(1, {
        outcome: outcome.isConflict
          ? ForegroundGenerationOutcome.TerminalConflict
          : ForegroundGenerationOutcome.TerminalSkipped,
      });
      this.logger.warn(
        `Terminal ${status} write did not apply — generationId: ${location.generationId}, conflict: ${outcome.isConflict === true}`,
      );
      this.generationService.persistenceFailed(lease);
      return { status: undefined, marker: terminalMarker };
    }
    if (status === GenerationStatus.Done) {
      this.generationService.complete(lease);
    } else {
      this.generationService.error(lease, partialMessage.streamErrorMessage);
    }
    return undefined;
  }
}
