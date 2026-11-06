import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DeploymentsService } from '../../deployments/deployments.service';
import { DialClientService } from '../../dial/dial-client.service';
import type { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import {
  ConditionalUpdateStatus,
  type VersionedConversation,
} from '../conversation-persistence.port';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from '../dto/conversation-message.dto';
import { MessageCustomContentDto } from '../dto/message-custom-content.dto';
import { CompletionMode } from '../dto/send-completion.dto';
import {
  BackgroundGenerationService,
  BackgroundStartResult,
  GENERATION_ACTIVE_MESSAGE,
  type BackgroundAttachPlan,
  type BackgroundStopResult,
} from '../generation/background-generation.service';
import {
  BackgroundWriteResult,
  type StoredMessage,
} from '../generation/background-message';
import { ChatCompletionsAdapter } from '../generation/chat-completions.adapter';
import {
  ConversationGenerationService,
  DEFAULT_GENERATION_FINALIZE_TIMEOUT_MS,
  DEFAULT_MAX_GENERATION_DURATION_MS,
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
  storeForegroundStop,
  updateForegroundMessage,
} from '../generation/foreground-message';
import { GenerationApi } from '../generation/generation-api';
import { GenerationApiSelector } from '../generation/generation-api-selector.service';
import {
  ForegroundGenerationOutcome,
  foregroundGenerationOutcomesTotal,
  generationCapabilityResolutionTotal,
  generationRequestsTotal,
  generationStreamDuration,
  generationTimeToFirstDelta,
} from '../generation/generation-metrics';
import {
  GenerationPreparationStep,
  type GenerationRelayOutcome,
  type GenerationRelayTiming,
} from '../generation/generation.types';
import {
  buildGenerationPersistenceError,
  type GenerationPersistenceTerminalMarker,
} from '../generation/persistence-error';
import { ResponsesAdapter } from '../generation/responses.adapter';
import { ConversationPersistenceService } from '../persistence/conversation-persistence.service';
import { buildConversationHistory } from '../utils/conversation-history-builder';
import { mergeHtmlTagAnnotationsIntoViewState } from '../utils/conversation-view-state.server';
import {
  buildConversationUrl,
  buildProjectHeadersForPath,
  qualifySessionConversationPath,
  resolveConversationLocation,
} from '../utils/conversation.utils';
import { assertModelNotHidden } from '../utils/hidden-model';

const DEFAULT_GENERATION_PREPARATION_TIMEOUT_MS = 30_000;
const PREPARATION_EXPIRED = Symbol('preparation-expired');

/*
 * A start-state write that failed for a reason other than a refusal may still have been
 * stored by DIAL Core (a timeout, a 5xx), so its marker must be released.
 */
const isStartWriteOutcomeUnknown = (error: unknown): boolean =>
  !(error instanceof HttpException) || error.getStatus() >= 500;

/*
 * Raised when preparation stops without its step having failed: it outlived
 * `GENERATION_PREPARATION_TIMEOUT_MS`, or shutdown released the entry. Its own
 * type lets the pre-stream `catch` blocks tell it apart from a step that
 * rejected: a rejected step is finished and releases the key at once, while
 * an abandoned one may still write, so its key is released only when it
 * settles (`generation-registry`).
 */
class GenerationPreparationInterruptedException extends ServiceUnavailableException {}

/*
 * The interruption by process shutdown. Unlike an abandoned step, nothing is pending:
 * the worker settles its own entry at once, after releasing a marker it stored, so the
 * shutdown flush need not wait for it (`generation-registry`).
 */
class GenerationShutdownInterruptedException extends GenerationPreparationInterruptedException {}

/** Whether a pre-stream failure leaves the worker to settle its own entry now. */
const isSettledByWorker = (error: unknown): boolean =>
  !(error instanceof GenerationPreparationInterruptedException) ||
  error instanceof GenerationShutdownInterruptedException;

/**
 * Runs once an abandoned step settles, before its entry settles; receives the step's
 * rejection, or `undefined` when it resolved.
 */
type AfterAbandonedStep = (error: unknown) => Promise<void>;

/** One generation's preparation bound: a single timer raced by each step. */
interface PreparationDeadline {
  /**
   * Starts `operation` and awaits it unless the deadline elapses first, in
   * which case the preparation is abandoned and
   * `GenerationPreparationInterruptedException` is thrown. Also throws it when
   * the step resolved after shutdown released the entry, so nothing further
   * runs. A step that rejects rethrows its own error.
   */
  run<T>(
    step: GenerationPreparationStep,
    operation: () => Promise<T>,
    afterAbandoned?: AfterAbandonedStep,
  ): Promise<T>;
  /** Clears the timer; idempotent. */
  end(): void;
}

@Injectable()
export class ConversationStreamingService {
  private readonly logger = new Logger(ConversationStreamingService.name);
  private readonly preparationTimeoutMs: number;
  private readonly maxGenerationDurationMs: number;
  private readonly finalizeTimeoutMs: number;

  constructor(
    private readonly dialClient: DialClientService,
    private readonly generationService: ConversationGenerationService,
    private readonly persistenceService: ConversationPersistenceService,
    private readonly deploymentsService: DeploymentsService,
    private readonly responsesAdapter: ResponsesAdapter,
    private readonly chatCompletionsAdapter: ChatCompletionsAdapter,
    private readonly generationApiSelector: GenerationApiSelector,
    private readonly backgroundGeneration: BackgroundGenerationService,
    configService: ConfigService<EnvironmentVariables>,
  ) {
    this.preparationTimeoutMs =
      configService.get('GENERATION_PREPARATION_TIMEOUT_MS', { infer: true }) ??
      DEFAULT_GENERATION_PREPARATION_TIMEOUT_MS;
    this.maxGenerationDurationMs =
      configService.get('MAX_GENERATION_DURATION_MS', { infer: true }) ??
      DEFAULT_MAX_GENERATION_DURATION_MS;
    this.finalizeTimeoutMs =
      configService.get('GENERATION_FINALIZE_TIMEOUT_MS', { infer: true }) ??
      DEFAULT_GENERATION_FINALIZE_TIMEOUT_MS;
  }

  /**
   * Arms the preparation bound for `lease`. When it elapses while a step is
   * pending, the worker stops waiting and runs nothing further; the registry
   * releases the entry's subscribers but keeps its key until that step
   * settles, because a `Promise.race` does not stop a remote write
   * (`generation-registry`).
   * @param lease - the preparing generation's lease
   */
  private startPreparationDeadline(
    lease: GenerationLease,
  ): PreparationDeadline {
    let isExpired = false;
    let timer: NodeJS.Timeout | undefined;
    const expired = new Promise<typeof PREPARATION_EXPIRED>((resolve) => {
      timer = setTimeout(() => {
        isExpired = true;
        resolve(PREPARATION_EXPIRED);
      }, this.preparationTimeoutMs);
    });
    const end = (): void => clearTimeout(timer);

    const abandon = (
      step: GenerationPreparationStep,
      pending?: Promise<unknown>,
      afterAbandoned?: AfterAbandonedStep,
    ): never => {
      end();
      this.generationService.abandonPreparation(lease, step);
      if (pending) {
        void this.releaseAfterAbandonedStep(
          lease,
          step,
          pending,
          afterAbandoned,
        );
      } else {
        /* Nothing was dispatched, so nothing can still write. */
        this.generationService.error(lease);
      }
      throw new GenerationPreparationInterruptedException(
        'Generation preparation timed out',
      );
    };
    /*
     * Shutdown cancels a preparing foreground entry and keeps its key for the worker to
     * settle, or has already released it.
     */
    const assertStillOwned = (): void => {
      const cancellation = this.generationService.getCancellation(lease);
      if (
        cancellation &&
        cancellation.reason !== GenerationCancelReason.Shutdown
      ) {
        return;
      }
      end();
      throw new GenerationShutdownInterruptedException(
        'Generation preparation was interrupted by shutdown',
      );
    };

    return {
      end,
      run: async <T>(
        step: GenerationPreparationStep,
        operation: () => Promise<T>,
        afterAbandoned?: AfterAbandonedStep,
      ): Promise<T> => {
        if (isExpired) return abandon(step);
        const pending = operation();
        let result: T | typeof PREPARATION_EXPIRED;
        try {
          result = await Promise.race([pending, expired]);
        } catch (err) {
          /*
           * A rejected step keeps its own error even when shutdown released
           * the entry meanwhile; callers that continue after a rejection
           * check ownership themselves.
           */
          end();
          throw err;
        }
        if (result === PREPARATION_EXPIRED) {
          return abandon(step, pending, afterAbandoned);
        }
        assertStillOwned();
        return result;
      },
    };
  }

  /**
   * Frees an abandoned preparation's key once its pending step resolves or
   * rejects — the only point at which it can no longer write. The step's
   * result is discarded; a rejection is logged rather than left unhandled.
   * @param lease - the abandoned generation's lease
   * @param step - the step that was pending at the deadline
   * @param pending - that step's promise
   */
  private async releaseAfterAbandonedStep(
    lease: GenerationLease,
    step: GenerationPreparationStep,
    pending: Promise<unknown>,
    afterAbandoned?: AfterAbandonedStep,
  ): Promise<void> {
    let failure: unknown;
    try {
      await pending;
      this.logger.debug(`Abandoned preparation step settled: ${step}`);
    } catch (err) {
      failure = err;
      this.logger.warn(`Abandoned preparation step failed: ${step}`, err);
    }
    try {
      await afterAbandoned?.(failure);
    } finally {
      this.generationService.error(lease);
    }
  }

  /**
   * Plans `completions/attach` for a conversation that contains a pending background
   * message (DIAL Core replay, recovery finalization, or an interrupted start); `null`
   * when the conversation has none.
   * @param conversationPath - conversation path relative to `bucket`
   * @param token - attaching request's bearer token
   * @param bucket - caller's session bucket
   * @param signal - aborted when the attaching client disconnects
   */
  resolveBackgroundAttach(
    conversationPath: string,
    token: string,
    bucket: string,
    signal: AbortSignal,
  ): Promise<BackgroundAttachPlan | null> {
    return this.backgroundGeneration.resolveAttach(
      { conversationPath, token, bucket },
      signal,
    );
  }

  /**
   * Stops a pending background generation identified by `generationId` through DIAL
   * Core; `NotBackground` when no background message carries that id.
   * @param conversationPath - conversation path relative to `bucket`
   * @param token - stopping request's bearer token
   * @param bucket - caller's session bucket
   * @param generationId - generation id posted by the client
   * @param shownContent - answer text the client has shown so far, if sent
   */
  stopBackgroundGeneration(
    conversationPath: string,
    token: string,
    bucket: string,
    generationId: string,
    shownContent?: string,
  ): Promise<BackgroundStopResult> {
    return this.backgroundGeneration.stop(
      { conversationPath, token, bucket },
      generationId,
      shownContent,
    );
  }

  /**
   * Saves a conversation body sent by a client with a conditional write that protects
   * an active background or foreground generation (see
   * `BackgroundGenerationService.saveClientConversation`). A conversation that does not
   * exist yet is created; a stored version that cannot be read makes the save fail with
   * `503` instead of writing unconditionally.
   * @param conversationPath - conversation path relative to `bucket`
   * @param token - saving request's bearer token
   * @param bucket - caller's session bucket
   * @param conversation - body sent by the client
   */
  saveClientConversation(
    conversationPath: string,
    token: string,
    bucket: string,
    conversation: ConversationResponseDto,
  ): Promise<ConversationResponseDto> {
    return this.backgroundGeneration.saveClientConversation(
      { conversationPath, token, bucket },
      conversation,
    );
  }

  /**
   * Stores the start state of a foreground generation with its marker, through a
   * conditional update on the latest version: an active generation is a `409`, an expired
   * marker is neutralized, and the history is built on the version being written.
   * @param params - conversation location, generation id and the history builder
   * @param initial - the version already read, used for the first attempt
   */
  private async writeStartState(
    params: {
      conversationPath: string;
      token: string;
      bucket: string;
      generationId: string;
      build: (
        conversation: ConversationResponseDto,
      ) => ReturnType<typeof buildConversationHistory>;
    },
    initial: VersionedConversation | undefined,
  ): Promise<ReturnType<typeof buildConversationHistory>> {
    let written: ReturnType<typeof buildConversationHistory> | undefined;
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
            maxDurationMs: this.maxGenerationDurationMs,
            finalizeTimeoutMs: this.finalizeTimeoutMs,
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
    return written as ReturnType<typeof buildConversationHistory>;
  }

  /**
   * Removes this generation's marker when the start state may have been stored but the
   * generation will not stream; the placeholder is marked interrupted. A no-op when the
   * marker was never stored. Never throws.
   * @param params - conversation location and generation id
   */
  private async releaseForegroundMarker(params: {
    conversationPath: string;
    token: string;
    bucket: string;
    generationId: string;
  }): Promise<void> {
    try {
      const outcome = await updateForegroundMessage({
        persistence: this.persistenceService,
        ...params,
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
   * @param conversationPath - conversation path relative to `bucket`
   * @param token - stopping request's bearer token
   * @param bucket - stopping caller's session bucket
   * @param generationId - generation id posted by the client
   */
  async stopForegroundGeneration(
    conversationPath: string,
    token: string,
    bucket: string,
    generationId: string,
  ): Promise<ForegroundStopResult> {
    const result = await storeForegroundStop({
      persistence: this.persistenceService,
      conversationPath,
      token,
      bucket,
      generationId,
      stopReleaseMs: buildForegroundStopReleaseMs(this.finalizeTimeoutMs),
    });
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
   * @param params - the generation's lease, location and id
   * @returns a function that stops the re-reads; idempotent
   */
  private startForegroundRereads(params: {
    lease: GenerationLease;
    conversationPath: string;
    token: string;
    bucket: string;
    generationId: string;
  }): () => void {
    let isReading = false;
    let isStopped = false;
    const reread = async (): Promise<void> => {
      try {
        const stored = await this.persistenceService.readConversationWithEtag(
          params.conversationPath,
          params.token,
          params.bucket,
        );
        if (isStopped) return;
        const messages = stored?.conversation.messages ?? [];
        const index = findForegroundMessageIndex(messages, params.generationId);
        if (index === -1) {
          foregroundGenerationOutcomesTotal.add(1, {
            outcome: ForegroundGenerationOutcome.LockLost,
          });
          this.generationService.cancel(
            params.lease,
            GenerationCancelReason.LockLost,
          );
          return;
        }
        if (messages[index].foregroundGeneration?.stopRequestedAt != null) {
          this.generationService.requestUserStop(params.lease);
        }
      } catch (err) {
        this.logger.debug(
          `Foreground marker re-read failed — generationId: ${params.generationId}: ${err instanceof Error ? err.name : 'unknown'}`,
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

  async watchConversation(
    conversationPath: string,
    token: string,
    sessionBucket: string,
    signal: AbortSignal,
  ): Promise<ReadableStream<Uint8Array>> {
    const { bucket, subPath } = resolveConversationLocation(
      qualifySessionConversationPath(conversationPath, sessionBucket),
      sessionBucket,
    );
    const resourceUrl = buildConversationUrl(
      bucket,
      encodeDialResourcePath(subPath),
    );
    this.logger.debug(
      `watchConversation subscribing to resource: ${resourceUrl}`,
    );

    try {
      const result = (await this.dialClient.client.subscribeToResources({
        body: { resources: [{ url: resourceUrl }] },
        headers: {
          ...getBearerAuthHeaders(token),
          Accept: 'text/event-stream',
        },
        parseAs: 'stream',
        signal,
      })) as { response: globalThis.Response; error?: unknown };

      if (!result.response.ok || !result.response.body) {
        this.logger.error(
          `DIAL Core rejected subscribeToResources — status: ${result.response.status}`,
        );
        return handleDialSdkError(
          { status: result.response.status },
          'conversations.watchConversation',
          this.logger,
        );
      }
      return result.response.body;
    } catch (error) {
      this.logger.error('DIAL Core subscribeToResources failed', error);
      return handleDialSdkError(
        error,
        'conversations.watchConversation',
        this.logger,
      );
    }
  }

  /**
   * Streams a chat completion as raw SSE bytes. The caller (controller) is
   * responsible for the HTTP transport: this service invokes
   * `onReadyToStream` when the SSE response headers should be sent
   * (`res.setHeader(...)` / `res.flushHeaders()`); the caller then writes
   * each yielded chunk to the response and ends it once iteration completes.
   */
  async *streamCompletion(
    conversationPath: string,
    token: string,
    bucket: string,
    generationId: string,
    mode: CompletionMode,
    message: string | undefined,
    messageIndex: number | undefined,
    model: string,
    customContent: MessageCustomContentDto | undefined,
    ownerKey: string,
    onReadyToStream: () => void,
    sub: string,
    clientChannelId?: string,
    timezone?: string,
    lang?: string,
    jobTitle?: string,
  ): AsyncGenerator<Uint8Array | string, void, void> {
    this.logger.debug(
      `streamCompletion start — model: ${model}, bucket: ${bucket}, path: ${conversationPath}, mode: ${mode}`,
    );

    const lease: GenerationLease = this.generationService.register(
      ownerKey,
      conversationPath,
      generationId,
      qualifySessionConversationPath(conversationPath, bucket),
    );
    let preparation = this.startPreparationDeadline(lease);

    let generationApi: GenerationApi;
    let isBackground: boolean;
    let temperatureSupported: boolean;
    let reasoningEfforts: string[] | undefined;
    try {
      /*
       * `model` is the one the user has selected now, so switching a
       * conversation off a hidden model is what lets it continue.
       */
      await preparation.run(GenerationPreparationStep.HiddenModelCheck, () =>
        assertModelNotHidden(
          this.deploymentsService,
          model,
          token,
          bucket,
          this.logger,
          `stream a completion for "${conversationPath}"`,
        ),
      );
      try {
        ({
          generationApi,
          isBackground,
          temperatureSupported,
          reasoningEfforts,
        } = await preparation.run(
          GenerationPreparationStep.CapabilityResolution,
          () => this.generationApiSelector.select(sub, model, token),
        ));
      } catch (err) {
        /* Counted here only, so a hidden-model failure is not a resolution failure. */
        generationCapabilityResolutionTotal.add(1, { outcome: 'failed' });
        throw err;
      }
      generationCapabilityResolutionTotal.add(1, {
        outcome: 'resolved',
        'generation.api': generationApi,
      });
    } catch (err) {
      preparation.end();
      if (isSettledByWorker(err)) {
        this.generationService.error(
          lease,
          err instanceof Error ? err.message : undefined,
        );
      }
      throw err;
    }

    let startState: ReturnType<typeof buildConversationHistory>;
    let storedConversation: VersionedConversation | undefined;
    let readConversation: ConversationResponseDto | undefined;
    try {
      const { conversation: fetchedConversation, stored } =
        await preparation.run(GenerationPreparationStep.ConversationRead, () =>
          this.persistenceService.getConversationWithStoredVersion(
            qualifySessionConversationPath(conversationPath, bucket),
            token,
            bucket,
          ),
        );
      storedConversation = stored;
      readConversation = fetchedConversation;
      /*
       * One active generation per conversation, whatever the flags or the caller: a
       * background job keeps running in DIAL Core without a registry entry here, and
       * a foreground marker may belong to another principal or instance
       * (`foreground-generation-lock`).
       */
      if (findActiveGeneration(fetchedConversation)) {
        foregroundGenerationOutcomesTotal.add(1, {
          outcome: ForegroundGenerationOutcome.StartConflict,
        });
        throw new ConflictException(GENERATION_ACTIVE_MESSAGE);
      }
      startState = buildConversationHistory(
        mode,
        fetchedConversation,
        message,
        messageIndex,
        customContent,
        model,
      );
    } catch (err) {
      /*
       * Release the just-registered entry so a failure before streaming starts
       * doesn't leave the conversation "locked" — otherwise the next request
       * (e.g. regenerate) would be rejected with a 409 until stale eviction.
       * An abandoned step is the exception: it may still settle later, and
       * releases the key only then.
       */
      preparation.end();
      if (isSettledByWorker(err)) {
        this.generationService.error(
          lease,
          err instanceof Error ? err.message : undefined,
        );
      }
      throw err;
    }

    if (isBackground) {
      /* The background path owns its placeholder save and its own bounds. */
      preparation.end();
      this.generationService.setBackground(lease, true);
      let backgroundResult: BackgroundStartResult;
      try {
        backgroundResult = yield* this.backgroundGeneration.startAndRelay({
          lease,
          conversationPath,
          token,
          bucket,
          generationId,
          mode,
          message,
          messageIndex,
          model,
          customContent,
          temperatureSupported,
          reasoningEfforts,
          onReadyToStream,
          clientChannelId,
          timezone,
          lang,
          jobTitle,
          storedConversation,
        });
      } catch (err) {
        this.generationService.error(
          lease,
          err instanceof Error ? err.message : undefined,
        );
        throw err;
      }
      if (backgroundResult === BackgroundStartResult.Handled) return;
      this.generationService.setBackground(lease, false);
      /* The stateless fallback's start-state save gets its own bound. */
      preparation = this.startPreparationDeadline(lease);
    }

    /*
     * The start state stores this generation's marker conditionally: without it the
     * terminal write could not find its own message, so any failure ends the request
     * before SSE headers (`foreground-generation-lock`).
     */
    const startWrite = {
      conversationPath,
      token,
      bucket,
      generationId,
      build: (conversation: ConversationResponseDto) =>
        buildConversationHistory(
          mode,
          conversation,
          message,
          messageIndex,
          customContent,
          model,
        ),
    };
    try {
      startState = await preparation.run(
        GenerationPreparationStep.StartStateSave,
        () =>
          this.writeStartState(
            startWrite,
            readConversation && storedConversation
              ? {
                  conversation: readConversation,
                  etag: storedConversation.etag,
                }
              : undefined,
          ),
        async (error) => {
          if (error === undefined || isStartWriteOutcomeUnknown(error)) {
            await this.releaseForegroundMarker(startWrite);
          }
        },
      );
    } catch (err) {
      /* Shutdown after the start state was stored: release the marker, then settle. */
      if (err instanceof GenerationShutdownInterruptedException) {
        await this.releaseForegroundMarker(startWrite);
        this.generationService.error(lease);
        throw err;
      }
      /*
       * Abandoned, not failed: the write may still land, so nothing else may run here;
       * the abandoned-step hook releases its marker once it settles.
       */
      if (err instanceof GenerationPreparationInterruptedException) throw err;
      preparation.end();
      foregroundGenerationOutcomesTotal.add(1, {
        outcome:
          err instanceof ConflictException
            ? ForegroundGenerationOutcome.StartConflict
            : ForegroundGenerationOutcome.StartFailed,
      });
      if (isStartWriteOutcomeUnknown(err)) {
        await this.releaseForegroundMarker(startWrite);
      }
      this.generationService.error(
        lease,
        err instanceof Error ? err.message : undefined,
      );
      throw err;
    }
    const { conversation: startConversation, assistantMessageIndex } =
      startState;

    const messagesForCompletion = startConversation.messages.slice(
      0,
      assistantMessageIndex,
    );

    const configuration =
      customContent?.configuration_value ??
      messagesForCompletion
        .filter((m) => m.custom_content?.configuration_value)
        .at(-1)?.custom_content?.configuration_value;

    const sentMessageCount = messagesForCompletion.filter(
      (m) => m.role !== ConversationMessageRole.Status,
    ).length;
    this.logger.debug(
      `streamCompletion sending ${sentMessageCount} message(s) to model: ${model}`,
    );

    preparation.end();
    onReadyToStream();
    /* A Stop stored on the marker by another writer or instance reaches this worker here. */
    const stopRereads = this.startForegroundRereads({
      lease,
      conversationPath,
      token,
      bucket,
      generationId,
    });

    const assembledMessage = {
      ...startConversation.messages[assistantMessageIndex],
    };
    this.generationService.seedAssembledMessage(lease, assembledMessage);
    const publishChunk = (
      rawChunk: unknown,
      message: ConversationMessageDto,
    ) => {
      this.generationService.applyChunk(lease, rawChunk, message);
    };

    let persistenceFailed = false;
    let persistenceFailureStatus: number | undefined;
    let persistenceFailureMarker:
      GenerationPersistenceTerminalMarker | undefined;
    const finalize = async (
      status:
        | GenerationStatus.Done
        | GenerationStatus.Stopped
        | GenerationStatus.Error,
      partialMessage: StoredMessage,
    ): Promise<void> => {
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
      stopRereads();
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
          conversationPath,
          token,
          bucket,
          generationId,
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
        persistenceFailed = true;
        persistenceFailureStatus =
          err instanceof HttpException ? err.getStatus() : undefined;
        persistenceFailureMarker = terminalMarker;
        this.generationService.persistenceFailed(lease);
        return;
      }
      if (outcome.result !== BackgroundWriteResult.Applied) {
        foregroundGenerationOutcomesTotal.add(1, {
          outcome: outcome.isConflict
            ? ForegroundGenerationOutcome.TerminalConflict
            : ForegroundGenerationOutcome.TerminalSkipped,
        });
        this.logger.warn(
          `Terminal ${status} write did not apply — generationId: ${generationId}, conflict: ${outcome.isConflict === true}`,
        );
        persistenceFailed = true;
        persistenceFailureStatus = undefined;
        persistenceFailureMarker = terminalMarker;
        this.generationService.persistenceFailed(lease);
        return;
      }
      if (status === GenerationStatus.Done) {
        this.generationService.complete(lease);
      } else {
        this.generationService.error(lease, partialMessage.streamErrorMessage);
      }
    };

    const streamStartedAt = Date.now();
    const timing: GenerationRelayTiming = {};
    /*
     * A Stop, maximum-duration or stale cancellation that landed during
     * preparation is finalized through the `aborted` outcome without
     * dispatching any upstream request (`backend-owned-generation-persistence`).
     */
    const isCancelledBeforeRelay = lease.abortController.signal.aborted;
    let relayIterator:
      | AsyncGenerator<Uint8Array | string, GenerationRelayOutcome, void>
      | undefined;
    if (!isCancelledBeforeRelay) {
      relayIterator =
        generationApi === GenerationApi.Responses
          ? this.responsesAdapter.stream(
              this.responsesAdapter.buildRequest({
                model,
                startConversation,
                messagesForCompletion,
                temperatureSupported,
                reasoningEfforts,
                configuration,
              }),
              token,
              lease.abortController.signal,
              assembledMessage,
              clientChannelId,
              timezone,
              lang,
              timing,
              startConversation.id,
              publishChunk,
              jobTitle,
              { extraHeaders: buildProjectHeadersForPath(conversationPath) },
            )
          : this.chatCompletionsAdapter.stream({
              model,
              requestBody: this.chatCompletionsAdapter.buildRequest({
                startConversation,
                messagesForCompletion,
                temperatureSupported,
                configuration,
              }),
              token,
              signal: lease.abortController.signal,
              initialAssembledMessage: assembledMessage,
              context: { clientChannelId, timezone, lang, jobTitle },
              timing,
              conversationId: startConversation.id,
              onChunkApplied: publishChunk,
              options: {
                extraHeaders: buildProjectHeadersForPath(conversationPath),
              },
            });
    }
    let relayCompletedNormally = false;
    try {
      let relayResult: GenerationRelayOutcome = {
        outcome: 'aborted',
        assembledMessage,
      };
      if (relayIterator) {
        let next = await relayIterator.next();
        while (!next.done) {
          yield next.value;
          next = await relayIterator.next();
        }
        relayResult = next.value;
      }
      relayCompletedNormally = true;

      generationRequestsTotal.add(1, {
        'generation.api': generationApi,
        outcome: relayResult.outcome,
      });
      if (timing.firstDeltaAt != null) {
        generationTimeToFirstDelta.record(
          (timing.firstDeltaAt - streamStartedAt) / 1000,
          { 'generation.api': generationApi },
        );
      }
      generationStreamDuration.record((Date.now() - streamStartedAt) / 1000, {
        'generation.api': generationApi,
        outcome: relayResult.outcome,
      });

      switch (relayResult.outcome) {
        case 'rejected': {
          const errored = {
            ...relayResult.assembledMessage,
            custom_content: {
              ...relayResult.assembledMessage.custom_content,
              event_type: undefined,
            } as never,
            streamErrorMessage: relayResult.errorMessage,
          };
          await finalize(GenerationStatus.Error, errored);
          break;
        }
        case 'completed':
          await finalize(GenerationStatus.Done, relayResult.assembledMessage);
          break;
        case 'aborted': {
          const wasStopped =
            this.generationService.getCancellation(lease)?.reason ===
            GenerationCancelReason.UserStop;
          const partialMsg = {
            ...relayResult.assembledMessage,
            ...(wasStopped
              ? { wasStoppedByUser: true }
              : { streamErrorMessage: '' }),
          } as ConversationMessageDto;
          await finalize(
            wasStopped ? GenerationStatus.Stopped : GenerationStatus.Error,
            partialMsg,
          );
          break;
        }
        case 'error': {
          this.logger.error(
            'DIAL Core streamCompletion failed',
            relayResult.error,
          );
          /*
           * Only upstream-supplied text reaches the user. A thrown error's
           * message (e.g. undici's `terminated`) is transport detail: it is
           * logged above and persisted as '' so the frontend shows its
           * localized fallback ([#8979](https://github.com/epam/ai-dial-chat/issues/8979)).
           */
          const partialMsg = {
            ...relayResult.assembledMessage,
            streamErrorMessage: relayResult.displayMessage ?? '',
          } as ConversationMessageDto;
          await finalize(GenerationStatus.Error, partialMsg);
          break;
        }
      }
      if (persistenceFailed) {
        yield `data: ${JSON.stringify({ error: buildGenerationPersistenceError(persistenceFailureStatus, persistenceFailureMarker) })}\n\n`;
      }
    } finally {
      stopRereads();
      /*
       * Reached only when the consuming `for await` (the controller's) is
       * abandoned for a reason other than the relay loop above reaching a
       * terminal outcome — e.g. an unexpected exception unwinding this
       * generator between a `yield` and the next `relayIterator.next()`
       * call. This is NOT reached merely because the downstream HTTP
       * response closed: `ConversationGenerationController.streamCompletion` keeps
       * consuming this generator after disconnect (see
       * backend-owned-generation-persistence — a completion's generation is
       * independent of the originating browser connection), so a closed
       * response alone never abandons this loop. `.return()` injected by a
       * genuinely abandoned consumer unwinds this generator at its current
       * `yield`, skipping the `switch` above entirely, so without this
       * branch the registry entry would never be released outside the
       * 30-minute stale sweep. Abort defensively (idempotent) so the
       * upstream relay notices and stops even if the caller's own
       * abandonment didn't.
       */
      if (!relayCompletedNormally) {
        lease.abortController.abort();
        const wasStopped =
          this.generationService.getCancellation(lease)?.reason ===
          GenerationCancelReason.UserStop;
        const currentAssembledMessage =
          this.generationService.getAssembledMessage(lease) ?? assembledMessage;
        const partialMsg = {
          ...currentAssembledMessage,
          ...(wasStopped
            ? { wasStoppedByUser: true }
            : { streamErrorMessage: '' }),
        } as ConversationMessageDto;
        await finalize(
          wasStopped ? GenerationStatus.Stopped : GenerationStatus.Error,
          partialMsg,
        );
      }
    }
  }
}
