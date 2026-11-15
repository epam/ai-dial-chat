import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DeploymentsService } from '../../deployments/deployments.service';
import { DialClientService } from '../../dial/dial-client.service';
import type { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import type { VersionedConversation } from '../conversation-persistence.port';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from '../dto/conversation-message.dto';
import {
  BackgroundGenerationService,
  BackgroundStartResult,
  GENERATION_ACTIVE_MESSAGE,
  type BackgroundAttachPlan,
  type BackgroundStopResult,
} from '../generation/background-generation.service';
import type { StoredMessage } from '../generation/background-message';
import { ChatCompletionsAdapter } from '../generation/chat-completions.adapter';
import {
  ConversationGenerationService,
  DEFAULT_GENERATION_FINALIZE_TIMEOUT_MS,
  DEFAULT_MAX_GENERATION_DURATION_MS,
  GenerationCancelReason,
  GenerationStatus,
  type GenerationLease,
} from '../generation/conversation-generation.service';
import { findActiveGeneration } from '../generation/foreground-generation';
import type { ForegroundStopResult } from '../generation/foreground-message';
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
  type GenerationApiSelection,
  GenerationPreparationStep,
  type GenerationRelayOutcome,
  type GenerationRelayTiming,
} from '../generation/generation.types';
import { buildGenerationPersistenceError } from '../generation/persistence-error';
import { ResponsesAdapter } from '../generation/responses.adapter';
import { ConversationPersistenceService } from '../persistence/conversation-persistence.service';
import { buildConversationHistory } from '../utils/conversation-history-builder';
import {
  buildConversationUrl,
  buildProjectHeadersForPath,
  qualifySessionConversationPath,
  resolveConversationLocation,
} from '../utils/conversation.utils';
import { assertModelNotHidden } from '../utils/hidden-model';
import {
  ForegroundGenerationLock,
  type ForegroundMarkerLocation,
  type ForegroundPersistenceFailure,
  type ForegroundStartState,
  type ForegroundStartWrite,
  type ForegroundTerminalStatus,
} from './foreground-generation-lock';
import {
  GenerationPreparation,
  GenerationPreparationInterruptedException,
  GenerationShutdownInterruptedException,
  isSettledByWorker,
  isStartWriteOutcomeUnknown,
  type PreparationDeadline,
} from './generation-preparation';
import type { StreamCompletionRequest } from './stream-completion-request';

const DEFAULT_GENERATION_PREPARATION_TIMEOUT_MS = 30_000;

/** The result of the preparation steps that run before any write. */
interface PreparedGeneration {
  capabilities: GenerationApiSelection;
  /** The conversation as read, with its stored version when one is known. */
  readConversation: ConversationResponseDto;
  storedConversation: VersionedConversation | undefined;
}

/** The terminal write a relay outcome maps to. */
interface TerminalWrite {
  status: ForegroundTerminalStatus;
  partialMessage: StoredMessage;
}

/**
 * The answer as it stands when a generation ends without a terminal relay outcome:
 * a user stop keeps it as stopped, anything else marks it interrupted.
 */
const toInterruptedWrite = (
  message: StoredMessage,
  wasStopped: boolean,
): TerminalWrite => ({
  status: wasStopped ? GenerationStatus.Stopped : GenerationStatus.Error,
  partialMessage: {
    ...message,
    ...(wasStopped ? { wasStoppedByUser: true } : { streamErrorMessage: '' }),
  } as ConversationMessageDto,
});

@Injectable()
export class ConversationStreamingService {
  private readonly logger = new Logger(ConversationStreamingService.name);
  private readonly preparation: GenerationPreparation;
  private readonly foregroundLock: ForegroundGenerationLock;

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
    this.preparation = new GenerationPreparation(
      generationService,
      this.logger,
      configService.get('GENERATION_PREPARATION_TIMEOUT_MS', { infer: true }) ??
        DEFAULT_GENERATION_PREPARATION_TIMEOUT_MS,
    );
    this.foregroundLock = new ForegroundGenerationLock(
      persistenceService,
      generationService,
      this.logger,
      {
        maxGenerationDurationMs:
          configService.get('MAX_GENERATION_DURATION_MS', { infer: true }) ??
          DEFAULT_MAX_GENERATION_DURATION_MS,
        finalizeTimeoutMs:
          configService.get('GENERATION_FINALIZE_TIMEOUT_MS', {
            infer: true,
          }) ?? DEFAULT_GENERATION_FINALIZE_TIMEOUT_MS,
      },
    );
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
   * Stores a Stop on the live marker of a foreground generation that may run on another
   * instance or under another principal (`foreground-generation-lock`).
   * @param conversationPath - conversation path relative to `bucket`
   * @param token - stopping request's bearer token
   * @param bucket - stopping caller's session bucket
   * @param generationId - generation id posted by the client
   */
  stopForegroundGeneration(
    conversationPath: string,
    token: string,
    bucket: string,
    generationId: string,
  ): Promise<ForegroundStopResult> {
    return this.foregroundLock.storeStop({
      conversationPath,
      token,
      bucket,
      generationId,
    });
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
   *
   * Steps: `prepareGeneration` (hidden-model check, capabilities, read), the
   * background path when the model supports it, `saveStartState` (the marker
   * write), then `relayAndFinalize` (stream and terminal write).
   */
  async *streamCompletion(
    request: StreamCompletionRequest,
  ): AsyncGenerator<Uint8Array | string, void, void> {
    const { conversationPath, bucket, generationId, mode, model } = request;
    this.logger.debug(
      `streamCompletion start — model: ${model}, bucket: ${bucket}, path: ${conversationPath}, mode: ${mode}`,
    );

    const lease: GenerationLease = this.generationService.register(
      request.ownerKey,
      conversationPath,
      generationId,
      qualifySessionConversationPath(conversationPath, bucket),
    );
    let preparation = this.preparation.start(lease);
    const prepared = await this.prepareGeneration(request, lease, preparation);

    if (prepared.capabilities.isBackground) {
      /* The background path owns its placeholder save and its own bounds. */
      preparation.end();
      this.generationService.setBackground(lease, true);
      let backgroundResult: BackgroundStartResult;
      try {
        backgroundResult = yield* this.backgroundGeneration.startAndRelay({
          lease,
          conversationPath,
          token: request.token,
          bucket,
          generationId,
          mode,
          message: request.message,
          messageIndex: request.messageIndex,
          model,
          customContent: request.customContent,
          temperatureSupported: prepared.capabilities.temperatureSupported,
          reasoningEfforts: prepared.capabilities.reasoningEfforts,
          onReadyToStream: request.onReadyToStream,
          clientChannelId: request.clientChannelId,
          timezone: request.timezone,
          lang: request.lang,
          jobTitle: request.jobTitle,
          storedConversation: prepared.storedConversation,
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
      preparation = this.preparation.start(lease);
    }

    const startState = await this.saveStartState(
      request,
      lease,
      preparation,
      prepared,
    );
    yield* this.relayAndFinalize(
      request,
      lease,
      preparation,
      prepared.capabilities,
      startState,
    );
  }

  /**
   * Runs the preparation steps that precede any write: the hidden-model check,
   * capability resolution, and the conversation read with its one-active-generation
   * check. A failure settles the registry entry unless an abandoned step still owns it.
   */
  private async prepareGeneration(
    request: StreamCompletionRequest,
    lease: GenerationLease,
    preparation: PreparationDeadline,
  ): Promise<PreparedGeneration> {
    const { conversationPath, token, bucket, model } = request;
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
      let capabilities: GenerationApiSelection;
      try {
        capabilities = await preparation.run(
          GenerationPreparationStep.CapabilityResolution,
          () => this.generationApiSelector.select(request.sub, model, token),
        );
      } catch (err) {
        /* Counted here only, so a hidden-model failure is not a resolution failure. */
        generationCapabilityResolutionTotal.add(1, { outcome: 'failed' });
        throw err;
      }
      generationCapabilityResolutionTotal.add(1, {
        outcome: 'resolved',
        'generation.api': capabilities.generationApi,
      });

      const { conversation, stored } = await preparation.run(
        GenerationPreparationStep.ConversationRead,
        () =>
          this.persistenceService.getConversationWithStoredVersion(
            qualifySessionConversationPath(conversationPath, bucket),
            token,
            bucket,
          ),
      );
      /*
       * One active generation per conversation, whatever the flags or the caller: a
       * background job keeps running in DIAL Core without a registry entry here, and
       * a foreground marker may belong to another principal or instance
       * (`foreground-generation-lock`).
       */
      if (findActiveGeneration(conversation)) {
        foregroundGenerationOutcomesTotal.add(1, {
          outcome: ForegroundGenerationOutcome.StartConflict,
        });
        throw new ConflictException(GENERATION_ACTIVE_MESSAGE);
      }
      /* Validates the request against the read version before anything is written. */
      this.buildHistory(request, conversation);
      return {
        capabilities,
        readConversation: conversation,
        storedConversation: stored,
      };
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
  }

  private buildHistory(
    request: StreamCompletionRequest,
    conversation: ConversationResponseDto,
  ): ForegroundStartState {
    return buildConversationHistory(
      request.mode,
      conversation,
      request.message,
      request.messageIndex,
      request.customContent,
      request.model,
    );
  }

  /**
   * Stores the start state with this generation's marker. Without the marker the
   * terminal write could not find its own message, so any failure ends the request
   * before SSE headers (`foreground-generation-lock`).
   */
  private async saveStartState(
    request: StreamCompletionRequest,
    lease: GenerationLease,
    preparation: PreparationDeadline,
    prepared: PreparedGeneration,
  ): Promise<ForegroundStartState> {
    const startWrite: ForegroundStartWrite = {
      conversationPath: request.conversationPath,
      token: request.token,
      bucket: request.bucket,
      generationId: request.generationId,
      build: (conversation) => this.buildHistory(request, conversation),
    };
    const { readConversation, storedConversation } = prepared;
    try {
      return await preparation.run(
        GenerationPreparationStep.StartStateSave,
        () =>
          this.foregroundLock.writeStartState(
            startWrite,
            storedConversation
              ? {
                  conversation: readConversation,
                  etag: storedConversation.etag,
                }
              : undefined,
          ),
        async (error) => {
          if (error === undefined || isStartWriteOutcomeUnknown(error)) {
            await this.foregroundLock.releaseMarker(startWrite);
          }
        },
      );
    } catch (err) {
      /* Shutdown after the start state was stored: release the marker, then settle. */
      if (err instanceof GenerationShutdownInterruptedException) {
        await this.foregroundLock.releaseMarker(startWrite);
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
        await this.foregroundLock.releaseMarker(startWrite);
      }
      this.generationService.error(
        lease,
        err instanceof Error ? err.message : undefined,
      );
      throw err;
    }
  }

  /**
   * Sends the SSE headers, relays the upstream stream and writes the terminal state.
   * A persistence failure of that write is reported as a final SSE error event.
   */
  private async *relayAndFinalize(
    request: StreamCompletionRequest,
    lease: GenerationLease,
    preparation: PreparationDeadline,
    capabilities: GenerationApiSelection,
    startState: ForegroundStartState,
  ): AsyncGenerator<Uint8Array | string, void, void> {
    const { generationApi } = capabilities;
    const { conversation: startConversation, assistantMessageIndex } =
      startState;
    const messagesForCompletion = startConversation.messages.slice(
      0,
      assistantMessageIndex,
    );
    const sentMessageCount = messagesForCompletion.filter(
      (m) => m.role !== ConversationMessageRole.Status,
    ).length;
    this.logger.debug(
      `streamCompletion sending ${sentMessageCount} message(s) to model: ${request.model}`,
    );

    const location: ForegroundMarkerLocation = {
      conversationPath: request.conversationPath,
      token: request.token,
      bucket: request.bucket,
      generationId: request.generationId,
    };
    preparation.end();
    request.onReadyToStream();
    /* A Stop stored on the marker by another writer or instance reaches this worker here. */
    const stopRereads = this.foregroundLock.startRereads(lease, location);

    const assembledMessage = {
      ...startConversation.messages[assistantMessageIndex],
    };
    this.generationService.seedAssembledMessage(lease, assembledMessage);

    let persistenceFailure: ForegroundPersistenceFailure | undefined;
    const finalize = async ({
      status,
      partialMessage,
    }: TerminalWrite): Promise<void> => {
      stopRereads();
      persistenceFailure = await this.foregroundLock.writeTerminalState(
        lease,
        location,
        status,
        partialMessage,
      );
    };

    const streamStartedAt = Date.now();
    const timing: GenerationRelayTiming = {};
    /*
     * A Stop, maximum-duration or stale cancellation that landed during
     * preparation is finalized through the `aborted` outcome without
     * dispatching any upstream request (`backend-owned-generation-persistence`).
     */
    const relayIterator = lease.abortController.signal.aborted
      ? undefined
      : this.openRelay(
          request,
          lease,
          capabilities,
          startState,
          messagesForCompletion,
          assembledMessage,
          timing,
        );
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

      this.recordRelayMetrics(
        generationApi,
        relayResult,
        streamStartedAt,
        timing,
      );
      await finalize(this.toTerminalWrite(lease, relayResult));
      if (persistenceFailure) {
        yield `data: ${JSON.stringify({ error: buildGenerationPersistenceError(persistenceFailure.status, persistenceFailure.marker) })}\n\n`;
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
       * `yield`, skipping the terminal mapping above entirely, so without this
       * branch the registry entry would never be released outside the
       * 30-minute stale sweep. Abort defensively (idempotent) so the
       * upstream relay notices and stops even if the caller's own
       * abandonment didn't.
       */
      if (!relayCompletedNormally) {
        lease.abortController.abort();
        await finalize(
          toInterruptedWrite(
            this.generationService.getAssembledMessage(lease) ??
              assembledMessage,
            this.wasStoppedByUser(lease),
          ),
        );
      }
    }
  }

  /** Starts the upstream relay through the adapter of the resolved generation API. */
  private openRelay(
    request: StreamCompletionRequest,
    lease: GenerationLease,
    capabilities: GenerationApiSelection,
    { conversation: startConversation }: ForegroundStartState,
    messagesForCompletion: ConversationMessageDto[],
    assembledMessage: ConversationMessageDto,
    timing: GenerationRelayTiming,
  ): AsyncGenerator<Uint8Array | string, GenerationRelayOutcome, void> {
    const { model, token, clientChannelId, timezone, lang, jobTitle } = request;
    const configuration =
      request.customContent?.configuration_value ??
      messagesForCompletion
        .filter((m) => m.custom_content?.configuration_value)
        .at(-1)?.custom_content?.configuration_value;
    const publishChunk = (
      rawChunk: unknown,
      message: ConversationMessageDto,
    ) => {
      this.generationService.applyChunk(lease, rawChunk, message);
    };
    const extraHeaders = buildProjectHeadersForPath(request.conversationPath);

    if (capabilities.generationApi === GenerationApi.Responses) {
      return this.responsesAdapter.stream(
        this.responsesAdapter.buildRequest({
          model,
          startConversation,
          messagesForCompletion,
          temperatureSupported: capabilities.temperatureSupported,
          reasoningEfforts: capabilities.reasoningEfforts,
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
        { extraHeaders },
      );
    }
    return this.chatCompletionsAdapter.stream({
      model,
      requestBody: this.chatCompletionsAdapter.buildRequest({
        startConversation,
        messagesForCompletion,
        temperatureSupported: capabilities.temperatureSupported,
        configuration,
      }),
      token,
      signal: lease.abortController.signal,
      initialAssembledMessage: assembledMessage,
      context: { clientChannelId, timezone, lang, jobTitle },
      timing,
      conversationId: startConversation.id,
      onChunkApplied: publishChunk,
      options: { extraHeaders },
    });
  }

  private recordRelayMetrics(
    generationApi: GenerationApi,
    relayResult: GenerationRelayOutcome,
    streamStartedAt: number,
    timing: GenerationRelayTiming,
  ): void {
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
  }

  private wasStoppedByUser(lease: GenerationLease): boolean {
    return (
      this.generationService.getCancellation(lease)?.reason ===
      GenerationCancelReason.UserStop
    );
  }

  /** Maps a terminal relay outcome to the status and answer the terminal write stores. */
  private toTerminalWrite(
    lease: GenerationLease,
    relayResult: GenerationRelayOutcome,
  ): TerminalWrite {
    switch (relayResult.outcome) {
      case 'rejected':
        return {
          status: GenerationStatus.Error,
          partialMessage: {
            ...relayResult.assembledMessage,
            custom_content: {
              ...relayResult.assembledMessage.custom_content,
              event_type: undefined,
            } as never,
            streamErrorMessage: relayResult.errorMessage,
          },
        };
      case 'completed':
        return {
          status: GenerationStatus.Done,
          partialMessage: relayResult.assembledMessage,
        };
      case 'aborted':
        return toInterruptedWrite(
          relayResult.assembledMessage,
          this.wasStoppedByUser(lease),
        );
      case 'error':
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
        return {
          status: GenerationStatus.Error,
          partialMessage: {
            ...relayResult.assembledMessage,
            streamErrorMessage: relayResult.displayMessage ?? '',
          } as ConversationMessageDto,
        };
    }
  }
}
