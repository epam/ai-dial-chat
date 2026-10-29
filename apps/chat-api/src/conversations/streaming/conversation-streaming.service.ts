import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
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
  ConversationGenerationService,
  GenerationCancelReason,
  GenerationStatus,
  type GenerationLease,
} from '../conversation-generation.service';
import type { VersionedConversation } from '../conversation-persistence.port';
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
  findPendingBackgroundMessage,
  neutralizeForeignPendingMessages,
  type StoredMessage,
} from '../generation/background-message';
import { ChatCompletionsAdapter } from '../generation/chat-completions.adapter';
import { GenerationApi } from '../generation/generation-api';
import { GenerationApiSelector } from '../generation/generation-api-selector.service';
import {
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
  qualifySessionConversationPath,
  resolveConversationLocation,
} from '../utils/conversation.utils';
import { assertModelNotHidden } from '../utils/hidden-model';

const DEFAULT_GENERATION_PREPARATION_TIMEOUT_MS = 30_000;
const PREPARATION_EXPIRED = Symbol('preparation-expired');

/*
 * Raised when preparation stops without its step having failed: it outlived
 * `GENERATION_PREPARATION_TIMEOUT_MS`, or shutdown released the entry. Its own
 * type lets the pre-stream `catch` blocks tell it apart from a step that
 * rejected: a rejected step is finished and releases the key at once, while
 * an abandoned one may still write, so its key is released only when it
 * settles (`generation-registry`).
 */
class GenerationPreparationInterruptedException extends ServiceUnavailableException {}

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
  ): Promise<T>;
  /** Clears the timer; idempotent. */
  end(): void;
}

@Injectable()
export class ConversationStreamingService {
  private readonly logger = new Logger(ConversationStreamingService.name);
  private readonly preparationTimeoutMs: number;

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
    ): never => {
      end();
      this.generationService.abandonPreparation(lease, step);
      if (pending) {
        void this.releaseAfterAbandonedStep(lease, step, pending);
      } else {
        /* Nothing was dispatched, so nothing can still write. */
        this.generationService.error(lease);
      }
      throw new GenerationPreparationInterruptedException(
        'Generation preparation timed out',
      );
    };
    /* Only shutdown releases a preparing entry underneath its worker. */
    const assertStillOwned = (): void => {
      if (this.generationService.getCancellation(lease)) return;
      end();
      throw new GenerationPreparationInterruptedException(
        'Generation preparation was interrupted by shutdown',
      );
    };

    return {
      end,
      run: async <T>(
        step: GenerationPreparationStep,
        operation: () => Promise<T>,
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
        if (result === PREPARATION_EXPIRED) return abandon(step, pending);
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
  ): Promise<void> {
    try {
      await pending;
      this.logger.debug(`Abandoned preparation step settled: ${step}`);
    } catch (err) {
      this.logger.warn(`Abandoned preparation step failed: ${step}`, err);
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
   * a pending background message (see `BackgroundGenerationService.saveClientConversation`).
   * A new conversation, or storage without an `ETag`, keeps the unconditional save.
   * @param conversationPath - conversation path relative to `bucket`
   * @param token - saving request's bearer token
   * @param bucket - caller's session bucket
   * @param conversation - body sent by the client
   */
  async saveClientConversation(
    conversationPath: string,
    token: string,
    bucket: string,
    conversation: ConversationResponseDto,
  ): Promise<ConversationResponseDto> {
    const protectedSave =
      await this.backgroundGeneration.saveClientConversation(
        { conversationPath, token, bucket },
        conversation,
      );
    return (
      protectedSave ??
      this.persistenceService.saveConversation(
        conversationPath,
        token,
        bucket,
        {
          ...conversation,
          messages: neutralizeForeignPendingMessages(conversation.messages),
        },
      )
    );
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
    jobTitle?: string,
  ): AsyncGenerator<Uint8Array | string, void, void> {
    this.logger.debug(
      `streamCompletion start — model: ${model}, bucket: ${bucket}, path: ${conversationPath}, mode: ${mode}`,
    );

    const lease: GenerationLease = this.generationService.register(
      ownerKey,
      conversationPath,
      generationId,
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
      if (!(err instanceof GenerationPreparationInterruptedException)) {
        this.generationService.error(
          lease,
          err instanceof Error ? err.message : undefined,
        );
      }
      throw err;
    }

    let startState: ReturnType<typeof buildConversationHistory>;
    let storedConversation: VersionedConversation | undefined;
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
      /*
       * One pending background generation per conversation, whatever the flags: a
       * background job keeps running in DIAL Core without a registry entry here.
       */
      if (findPendingBackgroundMessage(fetchedConversation)) {
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
      if (!(err instanceof GenerationPreparationInterruptedException)) {
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

    const { conversation: startConversation, assistantMessageIndex } =
      startState;

    try {
      await preparation.run(GenerationPreparationStep.StartStateSave, () =>
        this.persistenceService.saveConversation(
          conversationPath,
          token,
          bucket,
          startConversation,
        ),
      );
    } catch (err) {
      /* Abandoned, not failed: the write may still land, so nothing else may run. */
      if (err instanceof GenerationPreparationInterruptedException) throw err;
      /* Shutdown released the entry while the save ran: stop rather than stream. */
      if (!this.generationService.getCancellation(lease)) throw err;
      this.logger.warn(
        'Failed to save start-state conversation, continuing stream',
        err,
      );
    }

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
      let customViewState = startConversation.customViewState;
      try {
        customViewState = mergeHtmlTagAnnotationsIntoViewState(
          startConversation.customViewState,
          partialMessage.custom_content?.annotations,
        );
      } catch (err) {
        this.logger.warn(
          'Failed to merge annotations into customViewState',
          err,
        );
      }

      const finalConversation = {
        ...startConversation,
        messages: [
          ...startConversation.messages.slice(0, assistantMessageIndex),
          partialMessage,
        ],
        ...(customViewState !== undefined ? { customViewState } : {}),
      };
      /*
       * Record that the terminal write has been dispatched before awaiting
       * it (generation-registry, D5): a cancellation arriving after this
       * point is recorded for telemetry only and never adds, replaces, or
       * cancels this — the only — write attempt.
       */
      this.generationService.beginFinalizing(lease);
      try {
        await this.persistenceService.saveConversation(
          conversationPath,
          token,
          bucket,
          finalConversation,
        );
      } catch (err) {
        this.logger.warn(`Failed to save ${status} conversation`, err);
        persistenceFailed = true;
        persistenceFailureStatus =
          err instanceof HttpException ? err.getStatus() : undefined;
        /* A stopped, aborted, or failed answer is reported with the terminal
         * markers this write carried, so a client recovery save stores the same
         * outcome instead of an answer that reads as completed ([#9370](https://github.com/epam/ai-dial-chat/issues/9370)). */
        persistenceFailureMarker =
          status === GenerationStatus.Done
            ? undefined
            : {
                streamErrorMessage: partialMessage.streamErrorMessage,
                wasStoppedByUser: partialMessage.wasStoppedByUser,
              };
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
              timing,
              startConversation.id,
              publishChunk,
              jobTitle,
            )
          : this.chatCompletionsAdapter.stream(
              model,
              this.chatCompletionsAdapter.buildRequest({
                startConversation,
                messagesForCompletion,
                temperatureSupported,
                configuration,
              }),
              token,
              lease.abortController.signal,
              assembledMessage,
              clientChannelId,
              timezone,
              timing,
              startConversation.id,
              publishChunk,
              jobTitle,
            );
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
      /*
       * Reached only when the consuming `for await` (the controller's) is
       * abandoned for a reason other than the relay loop above reaching a
       * terminal outcome — e.g. an unexpected exception unwinding this
       * generator between a `yield` and the next `relayIterator.next()`
       * call. This is NOT reached merely because the downstream HTTP
       * response closed: `ConversationController.streamCompletion` keeps
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
