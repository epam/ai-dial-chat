import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { extractDialErrorMessage } from '../../common/dial/dial-error.mapper';
import { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import {
  ConversationGenerationService,
  GenerationCancelReason,
  type GenerationLease,
  type GenerationTerminalEvent,
} from '../conversation-generation.service';
import {
  CONDITIONAL_WRITE_ATTEMPTS,
  ConditionalUpdateStatus,
  type ConditionalUpdateResult,
  type VersionedConversation,
} from '../conversation-persistence.port';
import {
  BackgroundGenerationStatus,
  type BackgroundGenerationDto,
} from '../dto/background-generation.dto';
import {
  ConversationMessageRole,
  type ConversationMessageDto,
} from '../dto/conversation-message.dto';
import type { MessageCustomContentDto } from '../dto/message-custom-content.dto';
import type { CompletionMode } from '../dto/send-completion.dto';
import {
  ConversationPersistenceService,
  withStoredLlmDisplayName,
} from '../persistence/conversation-persistence.service';
import { buildConversationHistory } from '../utils/conversation-history-builder';
import {
  BackgroundWriteResult,
  findPendingBackgroundMessage,
  neutralizeForeignPendingMessages,
  pickServerOwnedFields,
  updateConversationUnlessPending,
  updatePendingBackgroundMessage,
  withServerOwnedFields,
  type BackgroundWriteOutcome,
  type ServerOwnedMessageFields,
  type StoredMessage,
} from './background-message';
import {
  CoreResponseResultKind,
  CoreResponsesClient,
  CoreResponseStatus,
  type CoreResponse,
  type CoreResponseResult,
} from './core-responses.client';
import {
  BackgroundGenerationOutcome,
  backgroundGenerationOutcomesTotal,
} from './generation-metrics';
import { GENERATION_PERSISTENCE_ERROR } from './persistence-error';
import {
  RESPONSES_FAILED_MESSAGE,
  RESPONSES_INCOMPLETE_MESSAGE,
  ResponsesAdapter,
} from './responses.adapter';

/** Returned when a new generation is started while another one holds the conversation. */
export const GENERATION_ACTIVE_MESSAGE =
  'A generation is already active for this conversation. Stop it before starting a new one.';

/** A `pending` message without a `responseId` older than this is an interrupted start. */
export const BACKGROUND_START_TIMEOUT_MS = 120_000;

/** What the Stop endpoint should do for a posted generation id. */
export enum BackgroundStopResult {
  /** No background message carries this generation id; use the registry path. */
  NotBackground = 'not_background',
  /** The message was stopped and its job cancelled; respond 204 and end a local relay. */
  Handled = 'handled',
  /**
   * The message had already finished (or was stopped by an earlier Stop); nothing was
   * written. Respond 204 and leave a local relay alone: it may still need to cancel a
   * job whose id it has not read yet.
   */
  AlreadyFinished = 'already_finished',
  /**
   * The message was stopped before its job reported a `responseId`; respond 204 but
   * leave the local relay running, so it reads the `responseId` and cancels the job.
   */
  StoppedBeforeJob = 'stopped_before_job',
}

/** Conversation location plus the bearer token of the request being served. */
export interface BackgroundRequestContext {
  conversationPath: string;
  token: string;
  bucket: string;
}

/** What `completions/attach` should do for a conversation's background message. */
export type BackgroundAttachPlan =
  | { kind: 'not_found' }
  | { kind: 'stream'; events: AsyncGenerator<object, void, void> };

/**
 * The attach terminal event matching a message's stored background status.
 * @param message - the message as stored after finalization
 */
export const toStoredTerminalEvent = (
  message: StoredMessage | undefined,
): GenerationTerminalEvent => {
  switch (message?.backgroundGeneration?.status) {
    case BackgroundGenerationStatus.Completed:
      return { type: 'done' };
    case BackgroundGenerationStatus.Stopped:
      return { type: 'stopped' };
    default:
      return {
        type: 'error',
        ...(message?.streamErrorMessage
          ? { message: message.streamErrorMessage }
          : {}),
      };
  }
};

/**
 * The messages to store for a client save. Storage stays authoritative for background
 * messages, because a client never receives the marker during a live stream and a
 * stale tab may still show an old state:
 * - the body's copy of a stored background message (pending or finished) takes that
 *   message's server-owned fields, so a client never changes a background answer. The
 *   copy is the body message carrying the same generation id or, when none does, an
 *   unmarked assistant message at the stored position. For a finished message the
 *   position counts only while the body still lines up with storage (same length, same
 *   preceding message), because deleting earlier messages shifts every position; a
 *   pending message cannot move, since messages are not deleted while it streams;
 * - when the body still has no copy of the stored pending message, the stored message
 *   replaces another generation's answer at its position (a tab that has not seen a
 *   regenerate), and a body too short to reach it gets the stored messages up to and
 *   including it;
 * - every other pending marker in the body is neutralized.
 * @param messages - messages sent by the client
 * @param storedMessages - messages currently in storage
 */
export const mergeClientMessages = (
  messages: StoredMessage[],
  storedMessages: StoredMessage[],
): StoredMessage[] => {
  const storedByGeneration = new Map(
    storedMessages
      .filter((message) => message.backgroundGeneration != null)
      .map((message) => [
        message.backgroundGeneration?.generationId as string,
        message,
      ]),
  );
  const merged = messages.map((message) => {
    const generationId = message.backgroundGeneration?.generationId;
    const stored = generationId
      ? storedByGeneration.get(generationId)
      : undefined;
    return stored
      ? withServerOwnedFields(message, pickServerOwnedFields(stored))
      : message;
  });
  const hasCopy = (generationId: string | undefined): boolean =>
    merged.some(
      (message) => message.backgroundGeneration?.generationId === generationId,
    );
  const isAligned = (index: number): boolean =>
    merged.length === storedMessages.length &&
    merged[index - 1]?.content === storedMessages[index - 1]?.content;
  storedMessages.forEach((stored, index) => {
    const generationId = stored.backgroundGeneration?.generationId;
    const atPosition = merged[index];
    const isPending =
      stored.backgroundGeneration?.status ===
      BackgroundGenerationStatus.Pending;
    if (
      generationId != null &&
      !hasCopy(generationId) &&
      (isPending || isAligned(index)) &&
      atPosition?.role === ConversationMessageRole.Assistant &&
      atPosition.backgroundGeneration == null
    ) {
      merged[index] = withServerOwnedFields(
        atPosition,
        pickServerOwnedFields(stored),
      );
    }
  });

  const pending = findPendingBackgroundMessage({ messages: storedMessages });
  const pendingGenerationId =
    pending?.message.backgroundGeneration?.generationId;
  if (pending && !hasCopy(pendingGenerationId)) {
    if (merged[pending.index]?.role === ConversationMessageRole.Assistant) {
      merged[pending.index] = pending.message;
    } else {
      const insertAt = Math.min(pending.index, merged.length);
      merged.splice(
        insertAt,
        0,
        ...storedMessages.slice(insertAt, pending.index + 1),
      );
    }
  }
  return neutralizeForeignPendingMessages(merged, pendingGenerationId);
};

/**
 * Parses one normalized `data: {...}` frame produced by the Responses adapter.
 * @param frame - SSE frame text
 */
const parseChunkFrame = (frame: string): object | undefined => {
  const payload = frame.startsWith('data: ') ? frame.slice(6).trim() : '';
  if (!payload.startsWith('{')) return undefined;
  try {
    return JSON.parse(payload) as object;
  } catch {
    return undefined;
  }
};

/** Result of trying to start a generation on the background path. */
export enum BackgroundStartResult {
  /** The background job ran (or was detached); the request is finished. */
  Handled = 'handled',
  /** The placeholder could not be stored; the caller continues on the stateless path. */
  Fallback = 'fallback',
}

/** Everything `streamCompletion` resolved before handing a request to the background path. */
export interface BackgroundStartParams {
  lease: GenerationLease;
  conversationPath: string;
  token: string;
  bucket: string;
  generationId: string;
  mode: CompletionMode;
  message: string | undefined;
  messageIndex: number | undefined;
  model: string;
  customContent: MessageCustomContentDto | undefined;
  temperatureSupported: boolean;
  reasoningEfforts?: string[];
  onReadyToStream: () => void;
  clientChannelId?: string;
  timezone?: string;
  jobTitle?: string;
  /** The conversation version read at request start; reused for the placeholder write. */
  storedConversation?: VersionedConversation;
}

/**
 * Joins the answer text of a stored Responses object's output: only `message` items and
 * their `output_text` parts, so reasoning text is never saved (the live stream drops it
 * too).
 * @param response - stored response retrieved from DIAL Core
 */
export const extractOutputText = (response: CoreResponse): string =>
  (response.output ?? [])
    .filter((item) => item.type === undefined || item.type === 'message')
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === undefined || part.type === 'output_text')
    .map((part) => part.text ?? '')
    .join('');

/**
 * Whether a stored response's job is still running.
 * @param status - status reported by DIAL Core
 */
const isRunningStatus = (status: string): boolean =>
  status === CoreResponseStatus.Queued ||
  status === CoreResponseStatus.InProgress;

/**
 * Maps a stored DIAL Core response to the message's new server-owned fields, or `null`
 * while the job is still running. `response === null` means Core no longer knows the
 * job (expired or deleted).
 * @param stored - the pending message as stored
 * @param response - retrieved Core response, or `null` for "not found"
 * @param responseId - the job's id as the caller knows it; kept when storing it failed
 */
export const toTerminalFields = (
  stored: StoredMessage,
  response: CoreResponse | null,
  responseId?: string,
): ServerOwnedMessageFields | null => {
  const base = {
    custom_content: stored.custom_content,
    responseId: stored.responseId ?? responseId,
  };
  const withStatus = (
    status: BackgroundGenerationStatus,
  ): BackgroundGenerationDto => ({
    ...(stored.backgroundGeneration as BackgroundGenerationDto),
    status,
  });
  if (response === null) {
    return {
      ...base,
      content: stored.content ?? '',
      backgroundGeneration: withStatus(BackgroundGenerationStatus.Failed),
      streamErrorMessage: '',
    };
  }
  if (isRunningStatus(response.status)) return null;
  switch (response.status) {
    case CoreResponseStatus.Completed:
      return {
        ...base,
        content: extractOutputText(response),
        backgroundGeneration: withStatus(BackgroundGenerationStatus.Completed),
      };
    case CoreResponseStatus.Cancelled:
      return {
        ...base,
        content: extractOutputText(response),
        backgroundGeneration: withStatus(BackgroundGenerationStatus.Stopped),
        wasStoppedByUser: true,
      };
    case CoreResponseStatus.Incomplete:
      return {
        ...base,
        content: extractOutputText(response),
        backgroundGeneration: withStatus(BackgroundGenerationStatus.Failed),
        streamErrorMessage: RESPONSES_INCOMPLETE_MESSAGE,
      };
    default:
      return {
        ...base,
        content: extractOutputText(response),
        backgroundGeneration: withStatus(BackgroundGenerationStatus.Failed),
        streamErrorMessage:
          extractDialErrorMessage(response.error) ?? RESPONSES_FAILED_MESSAGE,
      };
  }
};

/**
 * Reads the `responseId` a normalized chunk carries, if any.
 * @param chunk - one relayed `data: {...}` SSE frame
 */
const readChunkResponseId = (chunk: string): string | undefined => {
  if (!chunk.startsWith('data: {') || !chunk.includes('"responseId"')) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(chunk.slice(6)) as {
      choices?: Array<{ delta?: { responseId?: string } }>;
    };
    return parsed.choices?.[0]?.delta?.responseId;
  } catch {
    return undefined;
  }
};

/**
 * Runs generations that DIAL Core executes as background Responses jobs. The backend
 * never assembles the answer: it relays normalized chunks as they arrive, keeps the
 * association (`responseId` + `backgroundGeneration`) in the stored message, and at the
 * end retrieves the final answer from Core once and writes it only while the message is
 * still pending (`updatePendingBackgroundMessage`). Every Core call uses the token of
 * the request being served.
 */
@Injectable()
export class BackgroundGenerationService {
  private readonly logger = new Logger(BackgroundGenerationService.name);

  constructor(
    private readonly persistence: ConversationPersistenceService,
    private readonly responsesAdapter: ResponsesAdapter,
    private readonly coreResponses: CoreResponsesClient,
    private readonly generationService: ConversationGenerationService,
  ) {}

  /**
   * Starts the background job for a completion request and relays it to the client.
   * Throws `ConflictException` when another generation holds the conversation; resolves
   * {@link BackgroundStartResult.Fallback} when the placeholder cannot be stored, so the
   * caller can serve the request on the stateless path (no job exists yet).
   * @param params - request context resolved by `streamCompletion`
   */
  async *startAndRelay(
    params: BackgroundStartParams,
  ): AsyncGenerator<string, BackgroundStartResult, void> {
    const placeholder = await this.savePlaceholder(params);
    if (!placeholder) {
      backgroundGenerationOutcomesTotal.add(1, {
        outcome: BackgroundGenerationOutcome.PlaceholderFallback,
      });
      return BackgroundStartResult.Fallback;
    }
    const { lease, token, generationId } = params;
    params.onReadyToStream();

    const requestBody = this.responsesAdapter.buildRequest({
      model: params.model,
      startConversation: placeholder.conversation,
      messagesForCompletion: placeholder.conversation.messages.slice(
        0,
        placeholder.index,
      ) as ConversationMessageDto[],
      temperatureSupported: params.temperatureSupported,
      reasoningEfforts: params.reasoningEfforts,
      configuration: params.customContent?.configuration_value,
      isBackground: true,
    });
    const placeholderMessage = placeholder.conversation.messages[
      placeholder.index
    ] as ConversationMessageDto;
    const relay = this.responsesAdapter.stream(
      requestBody,
      token,
      lease.abortController.signal,
      placeholderMessage,
      params.clientChannelId,
      params.timezone,
      undefined,
      placeholder.conversation.id,
      undefined,
      params.jobTitle,
      { isPassThrough: true },
    );

    let responseId: string | undefined;
    let next = await relay.next();
    while (!next.done) {
      if (!responseId) {
        const chunkResponseId = readChunkResponseId(next.value);
        if (chunkResponseId) {
          responseId = chunkResponseId;
          const isOwned = await this.saveResponseId(params, responseId);
          if (!isOwned) {
            await relay.return({
              outcome: 'aborted',
              assembledMessage: placeholderMessage,
            });
            void this.cancelBestEffort(responseId, token);
            this.generationService.complete(lease);
            return BackgroundStartResult.Handled;
          }
        }
      }
      yield next.value;
      next = await relay.next();
    }
    const relayResult = next.value;

    if (relayResult.outcome === 'aborted') {
      const reason = this.generationService.getCancellation(lease)?.reason;
      if (reason === GenerationCancelReason.UserStop) {
        await this.writeStoppedAfterLocalAbort(params, responseId);
        this.generationService.complete(lease);
        return BackgroundStartResult.Handled;
      }
      backgroundGenerationOutcomesTotal.add(1, {
        outcome:
          reason === GenerationCancelReason.Shutdown
            ? BackgroundGenerationOutcome.DetachedShutdown
            : BackgroundGenerationOutcome.DetachedMaxDuration,
      });
      this.logger.debug(
        `Background relay detached (${reason ?? 'unknown'}) — generationId: ${generationId}, responseId: ${responseId ?? 'none'}`,
      );
      this.generationService.complete(lease);
      return BackgroundStartResult.Handled;
    }

    this.generationService.beginFinalizing(lease);
    if (relayResult.outcome === 'rejected' || !responseId) {
      await this.writeTerminal(params, generationId, (stored) => ({
        custom_content: stored.custom_content,
        content: stored.content ?? '',
        backgroundGeneration: {
          ...(stored.backgroundGeneration as BackgroundGenerationDto),
          status: BackgroundGenerationStatus.Failed,
        },
        streamErrorMessage:
          relayResult.outcome === 'rejected' ? relayResult.errorMessage : '',
      }));
    } else {
      await this.finalizeFromCore(
        params,
        generationId,
        responseId,
        BackgroundGenerationOutcome.FinalizedOrigin,
      );
    }
    this.generationService.complete(lease);
    return BackgroundStartResult.Handled;
  }

  /**
   * Retrieves the job's stored response from Core and, if it is terminal, writes the
   * matching final state (then deletes the Core response). Leaves the message pending
   * while the job is still running or Core cannot be reached.
   * @param context - conversation location and the current request's token
   * @param generationId - generation that owns the message
   * @param responseId - the job's DIAL Core response id
   * @param finalizedOutcome - outcome to record when this call writes a completed answer
   * @param alreadyRetrieved - the retrieve result the caller already holds, if any
   */
  async finalizeFromCore(
    context: Pick<
      BackgroundStartParams,
      'conversationPath' | 'token' | 'bucket'
    >,
    generationId: string,
    responseId: string,
    finalizedOutcome: BackgroundGenerationOutcome,
    alreadyRetrieved?: CoreResponseResult,
  ): Promise<BackgroundWriteOutcome | null> {
    const retrieved =
      alreadyRetrieved ??
      (await this.coreResponses.retrieveResponse(responseId, context.token));
    if (
      retrieved.kind !== CoreResponseResultKind.Ok &&
      retrieved.kind !== CoreResponseResultKind.NotFound
    ) {
      return null;
    }
    const response =
      retrieved.kind === CoreResponseResultKind.Ok ? retrieved.response : null;
    if (response && isRunningStatus(response.status)) return null;
    return this.writeTerminal(
      context,
      generationId,
      (stored) =>
        toTerminalFields(
          stored,
          response,
          responseId,
        ) as ServerOwnedMessageFields,
      response === null
        ? BackgroundGenerationOutcome.Expired
        : finalizedOutcome,
    );
  }

  /**
   * Applies a terminal state through the pending-only updater, records the outcome and,
   * when the write applied, deletes the Core response best-effort.
   * @param context - conversation location and the current request's token
   * @param generationId - generation that owns the message
   * @param build - builds the terminal server-owned fields from the stored message
   * @param appliedOutcome - outcome to record when the write applies
   * @param shouldDeleteResponse - `false` when the job may still be running (Stop), so
   *   the caller deletes it itself once Core reports it finished
   */
  async writeTerminal(
    context: Pick<
      BackgroundStartParams,
      'conversationPath' | 'token' | 'bucket'
    >,
    generationId: string,
    build: (stored: StoredMessage) => ServerOwnedMessageFields,
    appliedOutcome?: BackgroundGenerationOutcome,
    shouldDeleteResponse = true,
  ): Promise<BackgroundWriteOutcome> {
    let outcome: BackgroundWriteOutcome;
    try {
      outcome = await updatePendingBackgroundMessage({
        persistence: this.persistence,
        conversationPath: context.conversationPath,
        token: context.token,
        bucket: context.bucket,
        generationId,
        mutate: build,
      });
    } catch (err) {
      this.logger.warn(
        `Background terminal write failed — generationId: ${generationId}`,
        err,
      );
      outcome = { result: BackgroundWriteResult.Failed };
    }
    if (outcome.result === BackgroundWriteResult.Failed) {
      backgroundGenerationOutcomesTotal.add(1, {
        outcome: BackgroundGenerationOutcome.SaveFailed,
      });
    } else if (outcome.result === BackgroundWriteResult.Applied) {
      if (appliedOutcome) {
        backgroundGenerationOutcomesTotal.add(1, { outcome: appliedOutcome });
      }
      const responseId = outcome.storedMessage?.responseId;
      if (responseId && shouldDeleteResponse) {
        void this.deleteBestEffort(responseId, context.token);
      }
    }
    return outcome;
  }

  /**
   * Builds and stores the pending placeholder with a conditional write. Resolves the
   * saved conversation and the placeholder's index, `null` on a storage error (the
   * caller falls back), or throws `ConflictException` when a pending background
   * message exists or concurrent starts keep winning.
   * @param params - request context resolved by `streamCompletion`
   */
  private async savePlaceholder(
    params: BackgroundStartParams,
  ): Promise<{ conversation: ConversationResponseDto; index: number } | null> {
    let saved: { conversation: ConversationResponseDto; index: number } | null =
      null;
    try {
      const result = await this.persistence.updateConversation(
        params.conversationPath,
        params.token,
        params.bucket,
        (stored) => {
          if (!stored?.etag) return null;
          if (findPendingBackgroundMessage(stored.conversation)) {
            throw new ConflictException(GENERATION_ACTIVE_MESSAGE);
          }
          const { conversation, assistantMessageIndex } =
            buildConversationHistory(
              params.mode,
              stored.conversation,
              params.message,
              params.messageIndex,
              params.customContent,
              params.model,
            );
          const messages = [
            ...conversation.messages,
          ] as ConversationMessageDto[];
          messages[assistantMessageIndex] = {
            ...messages[assistantMessageIndex],
            backgroundGeneration: {
              generationId: params.generationId,
              status: BackgroundGenerationStatus.Pending,
              startedAt: Date.now(),
            },
          };
          const withPlaceholder = {
            ...conversation,
            messages,
          } as ConversationResponseDto;
          saved = {
            conversation: withPlaceholder,
            index: assistantMessageIndex,
          };
          return withPlaceholder;
        },
        params.storedConversation,
      );
      if (result.status === ConditionalUpdateStatus.Conflict) {
        throw new ConflictException(GENERATION_ACTIVE_MESSAGE);
      }
      return result.status === ConditionalUpdateStatus.Saved ? saved : null;
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      this.logger.warn(
        'Background placeholder save failed; continuing on the stateless Responses path',
        err,
      );
      return null;
    }
  }

  /**
   * Stores `responseId` on the pending message. Resolves `false` when the message is no
   * longer this generation's pending message (stopped or replaced meanwhile); storage
   * errors are retried and then tolerated, because the terminal write carries the id too.
   * @param params - request context
   * @param responseId - id Core assigned to the job
   */
  private async saveResponseId(
    params: BackgroundStartParams,
    responseId: string,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < CONDITIONAL_WRITE_ATTEMPTS; attempt++) {
      try {
        const outcome = await updatePendingBackgroundMessage({
          persistence: this.persistence,
          conversationPath: params.conversationPath,
          token: params.token,
          bucket: params.bucket,
          generationId: params.generationId,
          mutate: (stored) => ({
            content: stored.content,
            custom_content: stored.custom_content,
            backgroundGeneration: stored.backgroundGeneration,
            responseId,
          }),
        });
        if (outcome.result === BackgroundWriteResult.Skipped) return false;
        if (outcome.result === BackgroundWriteResult.Applied) return true;
      } catch (err) {
        this.logger.warn(
          `Saving responseId failed (attempt ${attempt + 1}) — generationId: ${params.generationId}`,
          err,
        );
      }
    }
    return true;
  }

  /**
   * Plans `completions/attach` for a conversation that contains a pending background
   * message: replays a running job from DIAL Core, finalizes a finished or expired one,
   * or marks an interrupted start as failed. Resolves `null` when the conversation has
   * no pending background message, so the caller keeps its registry-based attach.
   * @param context - conversation location and the attaching request's token
   * @param signal - aborted when the attaching client disconnects
   */
  async resolveAttach(
    context: BackgroundRequestContext,
    signal: AbortSignal,
  ): Promise<BackgroundAttachPlan | null> {
    const stored = await this.readForRouting(context);
    const pending = findPendingBackgroundMessage(stored?.conversation);
    if (!pending) return null;
    const message = pending.message as StoredMessage;
    const generationId = message.backgroundGeneration?.generationId as string;

    if (!message.responseId) {
      const startedAt = message.backgroundGeneration?.startedAt ?? 0;
      if (Date.now() - startedAt <= BACKGROUND_START_TIMEOUT_MS) {
        return { kind: 'not_found' };
      }
      const outcome = await this.writeTerminal(
        context,
        generationId,
        (current) => ({
          content: current.content ?? '',
          custom_content: current.custom_content,
          backgroundGeneration: {
            ...(current.backgroundGeneration as BackgroundGenerationDto),
            status: BackgroundGenerationStatus.Failed,
          },
          streamErrorMessage: '',
        }),
        BackgroundGenerationOutcome.InterruptedStart,
      );
      return this.finishedPlan(outcome);
    }

    const retrieved = await this.coreResponses.retrieveResponse(
      message.responseId,
      context.token,
    );
    switch (retrieved.kind) {
      case CoreResponseResultKind.Forbidden:
      case CoreResponseResultKind.Error:
      case CoreResponseResultKind.Active:
        return { kind: 'not_found' };
      case CoreResponseResultKind.NotFound:
        return this.finishedPlan(
          await this.finalizeFromCore(
            context,
            generationId,
            message.responseId,
            BackgroundGenerationOutcome.FinalizedRecovery,
            retrieved,
          ),
        );
      default:
        break;
    }
    if (!isRunningStatus(retrieved.response.status)) {
      return this.finishedPlan(
        await this.finalizeFromCore(
          context,
          generationId,
          message.responseId,
          BackgroundGenerationOutcome.FinalizedRecovery,
          retrieved,
        ),
      );
    }
    return {
      kind: 'stream',
      events: this.replayEvents(
        context,
        message,
        generationId,
        message.responseId,
        signal,
      ),
    };
  }

  /**
   * Snapshot of the stored pending message, the job's events replayed from the first
   * one, then the terminal event matching what was persisted.
   */
  private async *replayEvents(
    context: BackgroundRequestContext,
    message: StoredMessage,
    generationId: string,
    responseId: string,
    signal: AbortSignal,
  ): AsyncGenerator<object, void, void> {
    yield { type: 'snapshot', message };
    const replay = await this.coreResponses.replayResponse(
      responseId,
      context.token,
      signal,
    );
    if (replay.kind === CoreResponseResultKind.Ok) {
      const relay = this.responsesAdapter.stream(
        { model: '', input: [], stream: true, store: true },
        context.token,
        signal,
        message,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { isPassThrough: true, replayBody: replay.body },
      );
      let next = await relay.next();
      while (!next.done) {
        const chunk = parseChunkFrame(next.value);
        if (chunk) yield { type: 'chunk', chunk };
        next = await relay.next();
      }
      if (next.value.outcome === 'aborted' || signal.aborted) return;
    }
    const outcome = await this.finalizeFromCore(
      context,
      generationId,
      responseId,
      BackgroundGenerationOutcome.FinalizedRecovery,
    );
    if (outcome) yield this.terminalFor(outcome);
  }

  private finishedPlan(
    outcome: BackgroundWriteOutcome | null,
  ): BackgroundAttachPlan {
    if (!outcome) return { kind: 'not_found' };
    const snapshot = outcome.storedMessage;
    const terminal = this.terminalFor(outcome);
    return {
      kind: 'stream',
      events: (async function* () {
        if (snapshot) yield { type: 'snapshot', message: snapshot };
        yield terminal;
      })(),
    };
  }

  private terminalFor(
    outcome: BackgroundWriteOutcome,
  ): GenerationTerminalEvent {
    if (outcome.result === BackgroundWriteResult.Failed) {
      return {
        type: 'error',
        errorType: GENERATION_PERSISTENCE_ERROR.type,
        message: GENERATION_PERSISTENCE_ERROR.message,
      };
    }
    return toStoredTerminalEvent(outcome.storedMessage);
  }

  /**
   * Stops a pending background generation from any instance: writes it as stopped with
   * the text the client has shown (the backend never assembles the answer, and DIAL
   * Core cannot return partial text quickly), so every other writer skips, then cancels
   * the job without waiting and deletes it once Core reports it finished. A finished
   * message resolves `Handled` without any write; a failed write throws
   * `ServiceUnavailableException` and leaves the job running.
   * @param context - conversation location and the stopping request's token
   * @param generationId - generation id posted by the client
   * @param shownContent - answer text the client has shown so far, if sent
   */
  async stop(
    context: BackgroundRequestContext,
    generationId: string,
    shownContent?: string,
  ): Promise<BackgroundStopResult> {
    const stored = await this.readForRouting(context);
    const message = (
      (stored?.conversation.messages ?? []) as StoredMessage[]
    ).find(
      (candidate) =>
        candidate.backgroundGeneration?.generationId === generationId,
    );
    if (!message) return BackgroundStopResult.NotBackground;
    if (
      message.backgroundGeneration?.status !==
      BackgroundGenerationStatus.Pending
    ) {
      return BackgroundStopResult.AlreadyFinished;
    }

    const outcome = await this.writeTerminal(
      context,
      generationId,
      (current) => ({
        content: shownContent || current.content || '',
        custom_content: current.custom_content,
        responseId: current.responseId,
        backgroundGeneration: {
          ...(current.backgroundGeneration as BackgroundGenerationDto),
          status: BackgroundGenerationStatus.Stopped,
        },
        wasStoppedByUser: true,
      }),
      BackgroundGenerationOutcome.Stopped,
      false,
    );
    this.logger.debug(
      `Background stop — generationId: ${generationId}, write: ${outcome.result}, shownLength: ${shownContent?.length ?? 0}`,
    );

    if (outcome.result === BackgroundWriteResult.Failed) {
      throw new ServiceUnavailableException(
        'The generation could not be stopped; retry shortly.',
      );
    }
    if (outcome.result !== BackgroundWriteResult.Applied) {
      return BackgroundStopResult.AlreadyFinished;
    }
    /* The id as written, not as first read: the relay may have saved it in between. */
    const responseId = outcome.storedMessage?.responseId;
    if (!responseId) return BackgroundStopResult.StoppedBeforeJob;
    void this.cancelAfterStop(responseId, context.token);
    return BackgroundStopResult.Handled;
  }

  /**
   * Cancels a job whose message is already saved as stopped, and deletes the stored
   * response when Core reports the job finished. A job that keeps running is left to
   * Core's own expiry; its output is ignored because the message is no longer pending.
   * @param responseId - DIAL Core response id
   * @param token - stopping request's bearer token
   */
  private async cancelAfterStop(
    responseId: string,
    token: string,
  ): Promise<void> {
    try {
      const cancel = await this.coreResponses.cancelResponse(responseId, token);
      const status =
        cancel.kind === CoreResponseResultKind.Ok
          ? cancel.response?.status
          : undefined;
      this.logger.debug(
        `Background stop cancel — responseId: ${responseId}, result: ${cancel.kind}${status ? `, status: ${status}` : ''}`,
      );
      if (cancel.kind !== CoreResponseResultKind.Ok) {
        backgroundGenerationOutcomesTotal.add(1, {
          outcome: BackgroundGenerationOutcome.CancelUnsupported,
        });
        return;
      }
      if (status && !isRunningStatus(status)) {
        await this.deleteBestEffort(responseId, token);
      }
    } catch (err) {
      this.logger.warn(
        `Background stop cancel failed — responseId: ${responseId}: ${err instanceof Error ? err.name : 'unknown'}`,
      );
    }
  }

  /**
   * Saves a generation stopped through the local registry (a Stop that arrived before
   * the placeholder was visible, or that reached the originating instance) as stopped,
   * then cancels its job if it has one.
   * @param params - request context of the originating request
   * @param responseId - DIAL Core response id, when the job was already created
   */
  private async writeStoppedAfterLocalAbort(
    params: BackgroundStartParams,
    responseId: string | undefined,
  ): Promise<void> {
    const outcome = await this.writeTerminal(
      params,
      params.generationId,
      (stored) => ({
        content: stored.content ?? '',
        custom_content: stored.custom_content,
        responseId: stored.responseId,
        backgroundGeneration: {
          ...(stored.backgroundGeneration as BackgroundGenerationDto),
          status: BackgroundGenerationStatus.Stopped,
        },
        wasStoppedByUser: true,
      }),
      BackgroundGenerationOutcome.Stopped,
      false,
    );
    if (responseId && outcome.result === BackgroundWriteResult.Applied) {
      await this.cancelAfterStop(responseId, params.token);
    }
  }

  /**
   * Saves a client-sent conversation body on the latest stored version with
   * `If-Match` (see {@link mergeClientMessages} for how background messages are kept),
   * so it never overwrites a placeholder or a final answer written in between. Resolves
   * `null` when the conversation cannot be read, so the caller keeps its unconditional
   * save. When conflicts persist, {@link updateConversationUnlessPending} saves a
   * conversation without a pending background message unconditionally; one with a
   * pending message (or stored without an `ETag`) cannot be protected and makes the save
   * fail with `503`.
   * @param context - conversation location and the saving request's token
   * @param conversation - body sent by the client
   */
  async saveClientConversation(
    context: BackgroundRequestContext,
    conversation: ConversationResponseDto,
  ): Promise<ConversationResponseDto | null> {
    let isRead = false;
    let result: ConditionalUpdateResult;
    try {
      result = await updateConversationUnlessPending(
        this.persistence,
        context.conversationPath,
        context.token,
        context.bucket,
        (stored) => {
          isRead = true;
          if (
            stored &&
            !stored.etag &&
            findPendingBackgroundMessage(stored.conversation)
          ) {
            throw new ServiceUnavailableException(
              'The conversation could not be saved safely; retry shortly.',
            );
          }
          const body = withStoredLlmDisplayName(
            conversation,
            stored?.conversation,
          );
          return {
            ...body,
            messages: mergeClientMessages(
              (body.messages ?? []) as StoredMessage[],
              (stored?.conversation.messages ?? []) as StoredMessage[],
            ),
          } as ConversationResponseDto;
        },
      );
    } catch (err) {
      if (isRead) throw err;
      this.logger.warn(
        `Client save read failed; using the unconditional save — path: ${context.conversationPath}: ${err instanceof Error ? err.name : 'unknown'}`,
      );
      return null;
    }
    if (result.status !== ConditionalUpdateStatus.Saved) {
      throw new ServiceUnavailableException(
        'The conversation changed concurrently; retry shortly.',
      );
    }
    return result.conversation;
  }

  /**
   * Reads the conversation to decide whether attach or Stop takes the background path.
   * A storage error resolves `null`, so the request keeps the registry path that
   * non-background generations use.
   * @param context - conversation location and the current request's token
   */
  private async readForRouting(
    context: BackgroundRequestContext,
  ): Promise<VersionedConversation | null> {
    try {
      return await this.persistence.readConversationWithEtag(
        context.conversationPath,
        context.token,
        context.bucket,
      );
    } catch (err) {
      this.logger.warn(
        `Background routing read failed; using the registry path — path: ${context.conversationPath}: ${err instanceof Error ? err.name : 'unknown'}`,
      );
      return null;
    }
  }

  private async cancelBestEffort(
    responseId: string,
    token: string,
  ): Promise<void> {
    const result = await this.coreResponses.cancelResponse(responseId, token);
    if (result.kind !== CoreResponseResultKind.Ok) {
      this.logger.debug(
        `Best-effort cancel of ${responseId} returned ${result.kind}`,
      );
    }
  }

  private async deleteBestEffort(
    responseId: string,
    token: string,
  ): Promise<void> {
    const result = await this.coreResponses.deleteResponse(responseId, token);
    if (
      result !== CoreResponseResultKind.Ok &&
      result !== CoreResponseResultKind.NotFound
    ) {
      backgroundGenerationOutcomesTotal.add(1, {
        outcome: BackgroundGenerationOutcome.DeleteFailed,
      });
      this.logger.debug(`Deleting ${responseId} returned ${result}`);
    }
  }
}
