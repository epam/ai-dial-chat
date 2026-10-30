import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { resolvePrincipalKey } from '../../auth/session/principal-key';
import {
  getJobTitleClaim,
  type SessionUser,
} from '../../auth/session/session.types';
import {
  endsWithNewline,
  releaseSseResponse,
  SSE_KEEPALIVE_PAYLOAD,
  SSE_RELEASE_TIMEOUT_MS,
  SseReleaseOutcome,
  SseResponseState,
  startSseResponse,
  writeSseChunk,
} from '../../common/utils/sse';
import {
  SseSubscriptionKind,
  trackSseSubscription,
} from '../../telemetry/runtime-metrics';
import {
  ConversationGenerationService,
  type GenerationTerminalEvent,
} from '../conversation-generation.service';
import { ConversationService } from '../conversation.service';
import type { AttachGenerationDto } from '../dto/attach-generation.dto';
import type { SendCompletionDto } from '../dto/send-completion.dto';
import type { StopCompletionDto } from '../dto/stop-completion.dto';
import { BackgroundStopResult } from '../generation/background-generation.service';
import { assertValidOptionalTimezone } from '../utils/timezone-header';
import {
  completionResponseTerminations,
  CompletionResponseTermination,
} from './completion-response-metrics';

/** Interval of the SSE keepalive comment on completion, attach and watch streams. */
export const SSE_KEEPALIVE_INTERVAL_MS = 15_000;

/**
 * Bounds per-connection buffered output for `streamCompletion`. Past this
 * many bytes buffered in `res`, the handler stops writing to that response
 * (marking it detached, the same as a client disconnect) without pausing or
 * aborting the backend-owned generation loop. See
 * `backend-owned-generation-persistence`.
 */
const SSE_COMPLETION_MAX_BUFFERED_BYTES = 1024 * 1024;

/**
 * Bounds per-subscriber buffered output for `attachToGeneration`. Past this
 * many bytes buffered in a subscriber's `res`, that subscriber is detached
 * (its own cleanup runs) without affecting the generation or any other
 * concurrently attached subscriber. See `generation-live-replay`.
 */
const SSE_ATTACH_MAX_BUFFERED_BYTES = 1024 * 1024;

/**
 * The HTTP side of completions, stop and attach: SSE framing, keepalive,
 * backpressure detach and bounded release around `ConversationService`.
 * `ConversationController` and the project conversations controller both
 * delegate here, with the conversation path already validated, so a project
 * conversation streams exactly like a top-level one. The path is also the
 * generation-registry key, so completions, stop and attach must receive the
 * same value.
 */
@Injectable()
export class ConversationCompletionsResponder {
  private readonly logger = new Logger(ConversationCompletionsResponder.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly generationService: ConversationGenerationService,
  ) {}

  /**
   * Streams one completion as SSE.
   * @param path - conversation path, also the generation-registry key
   * @param options.isUnreadTracked - marks the conversation unviewed once the generation is accepted; only a top-level conversation has an unread indicator
   */
  async streamCompletion(
    req: Request,
    res: Response,
    dto: SendCompletionDto,
    timezoneHeader: string | string[] | undefined,
    path: string,
    { isUnreadTracked = false }: { isUnreadTracked?: boolean } = {},
  ): Promise<void> {
    const user = req.user as SessionUser;
    const { at, bucket, claims, sub } = user;
    const ownerKey = resolvePrincipalKey(user, req.authSource);
    const timezone = assertValidOptionalTimezone(timezoneHeader);
    /*
     * Set when the generation is accepted (`onReadyToStream`), so a request
     * rejected before it starts (409, validation) leaves the viewed ids alone.
     * Awaited before the first chunk is relayed: the client marks the chat
     * viewed when the stream ends, and that write must not be overtaken by this
     * one. It runs alongside the model's own start, so it normally costs nothing;
     * a hung DIAL Core client-data call would hold the first chunk back, an
     * accepted edge case. The service call is best effort and never rejects.
     */
    let pendingUnview = undefined as Promise<void> | undefined;
    const stream = this.conversationService.streamCompletion(
      path,
      at,
      bucket,
      dto.generationId,
      dto.mode,
      dto.message,
      dto.messageIndex,
      dto.model,
      dto.custom_content,
      ownerKey,
      () => {
        startSseResponse(res);
        startKeepalive();
        if (isUnreadTracked) {
          pendingUnview = this.conversationService.markConversationUnviewed(
            path,
            at,
            bucket,
          );
        }
      },
      sub,
      dto.clientChannelId,
      timezone,
      getJobTitleClaim(claims),
    );

    /*
     * This generation is backend-owned and independent of the originating
     * browser connection (see backend-owned-generation-persistence): closing,
     * refreshing, or navigating away from this response must not abort the
     * generation or stop the consuming loop below. `responseState` only
     * decides what happens to `res`.
     *
     * The two non-streaming states are deliberately distinct, because their
     * cleanup obligations are opposites: a `ClientClosed` response has
     * already been destroyed by Node and must never be touched again, while
     * a `BackpressureDetached` one is still open and this handler owns
     * terminating it. Treating the second as the first is what used to leave
     * a slow client's response open with a megabyte buffered after the
     * handler had already returned.
     *
     * The initial value is widened deliberately: every transition happens
     * inside a closure (the `'close'` listener, `detachForBackpressure`),
     * which TypeScript's control-flow analysis does not track, so without it
     * the type would stay narrowed to `Streaming` and the cleanup's
     * comparisons would be rejected as impossible.
     */
    let responseState = SseResponseState.Streaming as SseResponseState;
    const handleClose = () => {
      /*
       * Unconditional: a disconnect is the strongest fact available about the
       * response, and it can legitimately arrive while a detached response is
       * being released.
       */
      responseState = SseResponseState.ClientClosed;
    };
    res.on('close', handleClose);

    /*
     * `streamCompletion` is an async generator, so everything it does before
     * `onReadyToStream` — registering the generation, resolving the
     * deployment, loading the conversation — runs on the first `next()` from
     * the loop below, not at the call above. A rejection from that phase
     * therefore lands here with no headers sent yet, and ending the response
     * would flush an empty 200 that leaves the exception filter nothing to
     * write. That is how a second browser tab submitting into a conversation
     * that is already generating rendered an empty answer instead of the 409
     * this endpoint documents ([#8688](https://github.com/epam/ai-dial-chat/issues/8688)). Once the stream is open the
     * status is already committed, so a later failure ends the response as
     * before and only the SSE transport reports it.
     */
    let hasFailedBeforeStreamOpened = false;
    const detachForBackpressure = () => {
      /*
       * Only from `Streaming`: a response the client already closed stays
       * `ClientClosed`, which owes no cleanup.
       */
      if (responseState === SseResponseState.Streaming) {
        responseState = SseResponseState.BackpressureDetached;
      }
    };
    /*
     * A periodic comment keeps a quiet generation phase (a long "Thinking"
     * stage) from looking dead to intermediaries and to the client's idle
     * watchdog ([#8959](https://github.com/epam/ai-dial-chat/issues/8959)). The relay yields raw upstream byte slices that
     * can end mid-line, so a tick only writes on a line boundary — a comment
     * spliced into a partial line would corrupt that SSE frame. A skipped tick
     * loses nothing: bytes are flowing.
     */
    let isAtLineBoundary = true;
    let keepaliveTimer: ReturnType<typeof setInterval> | undefined;
    const writeToClient = (chunk: Uint8Array | string): void => {
      try {
        writeSseChunk(res, chunk);
        isAtLineBoundary = endsWithNewline(chunk);
        if (res.writableLength > SSE_COMPLETION_MAX_BUFFERED_BYTES) {
          detachForBackpressure();
        }
      } catch {
        detachForBackpressure();
      }
    };

    const startKeepalive = (): void => {
      keepaliveTimer = setInterval(() => {
        if (responseState !== SseResponseState.Streaming || !isAtLineBoundary)
          return;
        writeToClient(SSE_KEEPALIVE_PAYLOAD);
      }, SSE_KEEPALIVE_INTERVAL_MS);
    };
    try {
      for await (const chunk of stream) {
        if (pendingUnview) {
          await pendingUnview;
          pendingUnview = undefined;
        }
        /*
         * `continue`, never `break`: abandoning this loop injects `.return()`
         * into the generator, whose own cleanup aborts the generation's
         * `AbortController`. A slow or absent client must never cancel
         * backend-owned work.
         */
        if (responseState !== SseResponseState.Streaming) continue;
        writeToClient(chunk);
      }
    } catch (err) {
      hasFailedBeforeStreamOpened = !res.headersSent;
      throw err;
    } finally {
      if (keepaliveTimer) clearInterval(keepaliveTimer);
      res.off('close', handleClose);
      /*
       * On every exit path, not only after a first chunk: a generation that fails
       * before it yields anything must still finish this write before the
       * client can send its own viewed mark. `markConversationUnviewed` never
       * rejects, so draining here cannot change how the request ends.
       */
      await pendingUnview;
      /*
       * Reached only after the generator has returned, which it does only
       * after awaiting its own terminal save and registry release. So
       * nothing below can alter what was persisted or how the generation
       * finished — it decides the fate of the HTTP response alone.
       */
      if (responseState === SseResponseState.BackpressureDetached) {
        const outcome = await releaseSseResponse(res, SSE_RELEASE_TIMEOUT_MS);
        completionResponseTerminations.add(1, {
          reason:
            outcome === SseReleaseOutcome.Destroyed
              ? CompletionResponseTermination.BackpressureDestroyed
              : CompletionResponseTermination.BackpressureEnded,
        });
      } else if (responseState === SseResponseState.ClientClosed) {
        completionResponseTerminations.add(1, {
          reason: CompletionResponseTermination.ClientClosed,
        });
      } else if (!hasFailedBeforeStreamOpened && !res.writableEnded) {
        res.end();
        responseState = SseResponseState.Completed;
        completionResponseTerminations.add(1, {
          reason: CompletionResponseTermination.Completed,
        });
      }
    }
  }

  /**
   * Stops the generation registered under `path`.
   * @param path - conversation path, also the generation-registry key
   */
  async stopCompletion(
    req: Request,
    res: Response,
    dto: StopCompletionDto,
    path: string,
  ): Promise<void> {
    const { at, bucket } = req.user as SessionUser;
    const ownerKey = resolvePrincipalKey(
      req.user as SessionUser,
      req.authSource,
    );
    /* A non-background generation running here is stopped from the registry alone, as
       before; any other Stop must consult the stored message. */
    if (
      !this.generationService.hasLocalForegroundGeneration(
        ownerKey,
        path,
        dto.generationId,
      )
    ) {
      const backgroundStop =
        await this.conversationService.stopBackgroundGeneration(
          path,
          at,
          bucket,
          dto.generationId,
          dto.content,
        );
      if (
        backgroundStop === BackgroundStopResult.StoppedBeforeJob ||
        backgroundStop === BackgroundStopResult.AlreadyFinished
      ) {
        res.status(204).end();
        return;
      }
      if (backgroundStop === BackgroundStopResult.Handled) {
        /* When this instance also runs the relay, end it now: Core cancel is not
           always honoured, and the stopping tab must not keep receiving tokens. */
        this.generationService.abort(ownerKey, path, dto.generationId);
        res.status(204).end();
        return;
      }
    }

    const aborted = this.generationService.abort(
      ownerKey,
      path,
      dto.generationId,
    );
    if (!aborted) {
      throw new NotFoundException(
        'No active generation found for the given path and generationId',
      );
    }
    res.status(204).end();
  }

  /**
   * Attaches to the generation registered under `path` and replays it live.
   * @param path - conversation path, also the generation-registry key
   */
  async attachToGeneration(
    req: Request,
    res: Response,
    dto: AttachGenerationDto,
    path: string,
  ): Promise<void> {
    const { at, bucket } = req.user as SessionUser;
    const ownerKey = resolvePrincipalKey(
      req.user as SessionUser,
      req.authSource,
    );
    /* A non-background generation running here is replayed from the registry alone,
       as before; any other attach must consult the stored message. */
    if (!this.generationService.hasLocalForegroundGeneration(ownerKey, path)) {
      const backgroundAbort = new AbortController();
      const backgroundPlan =
        await this.conversationService.resolveBackgroundAttach(
          path,
          at,
          bucket,
          backgroundAbort.signal,
        );
      if (backgroundPlan?.kind === 'not_found') {
        throw new NotFoundException(
          'No active generation found for the given path',
        );
      }
      if (backgroundPlan?.kind === 'stream') {
        await this.writeBackgroundAttach(
          res,
          backgroundPlan.events,
          backgroundAbort,
        );
        return;
      }
    }

    const attachment = this.generationService.attach(ownerKey, path);
    /* Also covers a retained entry whose subscribers were already released. */
    if (!attachment) {
      throw new NotFoundException(
        'No active generation found for the given path',
      );
    }

    startSseResponse(res);

    const finishSubscription = trackSseSubscription(
      SseSubscriptionKind.GenerationAttach,
    );

    let isCleanedUp = false;
    const timers: { keepalive?: ReturnType<typeof setInterval> } = {};

    const cleanup = (): void => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      finishSubscription();
      if (timers.keepalive) clearInterval(timers.keepalive);
      attachment.emitter.off('chunk', onChunk);
      attachment.emitter.off('terminal', onTerminal);
      res.off('close', handleClose);
      /*
       * Fire-and-forget: `cleanup` runs from synchronous emitter callbacks,
       * so it cannot await. `releaseSseResponse` never rejects, and the
       * `isCleanedUp` guard above is what keeps a second cleanup — a late
       * disconnect, the terminal event, shutdown — from re-ending or
       * re-destroying this response.
       *
       * `res.end()` on its own would leave a subscriber whose peer stopped
       * reading holding everything already queued for it (up to
       * `SSE_ATTACH_MAX_BUFFERED_BYTES`), because `'finish'` never arrives;
       * the bounded `destroy()` inside is what reclaims it.
       */
      void releaseSseResponse(res, SSE_RELEASE_TIMEOUT_MS);
    };

    const writeEvent = (payload: unknown): void => {
      if (isCleanedUp || res.writableEnded) return;
      writeSseChunk(res, `data: ${JSON.stringify(payload)}\n\n`);
      if (res.writableLength > SSE_ATTACH_MAX_BUFFERED_BYTES) {
        cleanup();
      }
    };

    const onChunk = (rawChunk: unknown): void => {
      writeEvent({ type: 'chunk', chunk: rawChunk });
    };
    const onTerminal = (event: GenerationTerminalEvent): void => {
      writeEvent(event);
      cleanup();
    };
    const handleClose = (): void => {
      cleanup();
    };

    writeEvent({
      type: 'snapshot',
      message: attachment.assembledMessage,
      generationId: attachment.generationId,
    });
    if (isCleanedUp) return;

    timers.keepalive = setInterval(() => {
      writeSseChunk(res, SSE_KEEPALIVE_PAYLOAD);
    }, SSE_KEEPALIVE_INTERVAL_MS);

    /*
     * Subscribing here — synchronously, right after `attach()` read the
     * snapshot above, with no `await` in between — is what guarantees no
     * concurrently-emitted chunk is lost between the snapshot and the first
     * live event (see ConversationGenerationService.attach).
     */
    attachment.emitter.on('chunk', onChunk);
    attachment.emitter.on('terminal', onTerminal);
    res.on('close', handleClose);
  }

  /**
   * Streams a background generation's attach events (snapshot, replayed chunks, one
   * terminal event) with the same keepalive, backpressure detach and bounded release
   * as the registry-based attach. Disconnect or backpressure aborts the DIAL Core replay.
   * @param res - SSE response
   * @param events - attach events planned by the background service
   * @param abort - aborts the Core replay
   */
  private async writeBackgroundAttach(
    res: Response,
    events: AsyncGenerator<object, void, void>,
    abort: AbortController,
  ): Promise<void> {
    startSseResponse(res);
    const finishSubscription = trackSseSubscription(
      SseSubscriptionKind.GenerationAttach,
    );
    let isCleanedUp = false;
    const keepalive = setInterval(() => {
      writeSseChunk(res, SSE_KEEPALIVE_PAYLOAD);
    }, SSE_KEEPALIVE_INTERVAL_MS);
    const cleanup = (): void => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      finishSubscription();
      clearInterval(keepalive);
      abort.abort();
      res.off('close', cleanup);
      void releaseSseResponse(res, SSE_RELEASE_TIMEOUT_MS);
    };
    res.on('close', cleanup);
    try {
      for await (const event of events) {
        if (isCleanedUp || res.writableEnded) break;
        writeSseChunk(res, `data: ${JSON.stringify(event)}\n\n`);
        if (res.writableLength > SSE_ATTACH_MAX_BUFFERED_BYTES) break;
      }
    } catch (err) {
      this.logger.warn('Background attach stream failed', err);
    } finally {
      cleanup();
    }
  }
}
