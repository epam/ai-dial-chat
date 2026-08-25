import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { extractDialErrorMessage } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { StringUtils } from '../../common/utils/string-utils';
import { DialClientService } from '../../dial/dial-client.service';
import { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from '../dto/conversation-message.dto';
import { applyChunkToMessage } from '../utils/apply-chunk.server';
import { generationUnknownEventsTotal } from './generation-metrics';
import {
  isValidMaxOutputTokens,
  ResponsesTerminalState,
  type GenerationRelayOutcome,
  type GenerationRelayTiming,
  type NormalizedStreamChunk,
  type ResponsesApiRequestBody,
  type ResponsesInputContentPart,
  type ResponsesSseEvent,
  type ResponsesTerminalSignal,
} from './generation.types';

/*
 * Fixed, non-content message used whenever a Responses stream ends without
 * any recognized terminal signal (socket EOF or `[DONE]` with no prior
 * `response.completed`/`response.failed`/`response.incomplete`/`error`).
 * Never derived from upstream text so it can never leak prompt/response
 * content.
 */
const GENERIC_TRUNCATED_MESSAGE =
  'Responses generation ended before completion';

/**
 * Builds the Responses request and normalizes the Responses SSE event
 * stream into the same `chat.completion.chunk` shape the Chat Completions
 * adapter already emits, so `apply-chunk.server.ts` and the persistence
 * lifecycle need no changes. Raw `event: response.*` frames are never
 * forwarded to the browser.
 */
@Injectable()
export class ResponsesAdapter {
  private readonly logger = new Logger(ResponsesAdapter.name);

  constructor(private readonly dialClient: DialClientService) {}

  /**
   * Builds the Responses `input` array from the same history
   * `buildConversationHistory` already produced for Chat Completions — one
   * item per message, in order, with the system/instruction message (if
   * any) kept first. Mirrors the Chat Completions adapter by excluding
   * `ConversationMessageRole.Status` entries (internal bookkeeping markers,
   * e.g. model-changed) so they never reach DIAL Core/the model. `store` is
   * always `false` in this iteration; `previous_response_id`/`conversation`
   * are never set (DIAL Core rejects the key's mere presence, even as
   * `null`).
   *
   * `temperature` is included only when `temperatureSupported` is `true`
   * (some Responses-capable models reject the field outright — Chat never
   * substitutes a default of its own) and the conversation carries a usable
   * value, checked with a nullish check so `temperature: 0` is preserved.
   * `max_output_tokens` is included only when `startConversation
   * .maxOutputTokens` is a validated positive safe integer — it is never
   * gated by a capability flag (no Responses-specific one exists in this
   * codebase) and never derived from deployment limits or Chat Completions
   * defaults.
   *
   * `reasoning.effort` is a hardcoded test value: sent as the first entry of
   * `reasoningEfforts` (the deployment's own supported-values list) whenever
   * that list is non-empty. Chat has no persisted per-conversation
   * reasoning-effort setting to forward instead (unlike `temperature`).
   */
  buildRequest(params: {
    model: string;
    startConversation: ConversationResponseDto;
    messagesForCompletion: ConversationMessageDto[];
    temperatureSupported: boolean;
    reasoningEfforts?: string[];
    configuration?: Record<string, unknown>;
  }): ResponsesApiRequestBody {
    const {
      model,
      startConversation,
      messagesForCompletion,
      temperatureSupported,
      reasoningEfforts,
      configuration,
    } = params;

    const systemInput = startConversation.prompt
      ? [{ role: 'system', content: startConversation.prompt }]
      : [];

    const input = [
      ...systemInput,
      ...messagesForCompletion
        .filter((m) => m.role !== ConversationMessageRole.Status)
        .map((m) => this.buildInputItem(m)),
    ];

    const maxOutputTokens = startConversation.maxOutputTokens;

    return {
      model,
      input,
      stream: true,
      store: false,
      ...(temperatureSupported && startConversation.temperature != null
        ? { temperature: startConversation.temperature }
        : {}),
      ...(isValidMaxOutputTokens(maxOutputTokens)
        ? { max_output_tokens: maxOutputTokens }
        : {}),
      ...(reasoningEfforts?.length
        ? { reasoning: { effort: reasoningEfforts[0] } }
        : {}),
      ...(configuration ? { custom_fields: { configuration } } : {}),
    };
  }

  /**
   * Attachment mapping (see
   * `openspec/changes/extend-responses-api-capabilities/proposal.md` for the
   * full live-test findings behind this). DIAL's own `custom_content
   * .attachments` passthrough (mirroring Chat Completions) does not work on
   * this endpoint — confirmed live, Core reports no image seen. Mapping to
   * OpenAI-native content parts instead does work, but only for images:
   *
   * - `input_image`: confirmed working generally against a Responses-capable
   *   deployment.
   * - `input_file`: confirmed REJECTED by Core for any model other than
   *   `qwen3.5-ocr` (`"Invalid content type: 'input_file' is only supported
   *   for 'qwen3.5-ocr' model."`), with no capability flag found that
   *   predicts this. Sending it unconditionally would break any non-image
   *   attachment on most Responses deployments, so non-image attachments are
   *   dropped here rather than mapped to `input_file` — until a real
   *   capability signal or a documented Core contract is found, this must
   *   not be sent unconditionally.
   */
  private buildInputItem(message: ConversationMessageDto): {
    role: string;
    content: string | ResponsesInputContentPart[];
  } {
    const validAttachments = (message.custom_content?.attachments ?? []).filter(
      (attachment) => Boolean(attachment.data || attachment.url),
    );

    if (!validAttachments.length) {
      return { role: message.role as string, content: message.content };
    }

    const imageParts: ResponsesInputContentPart[] = validAttachments
      .filter((attachment) => attachment.type?.startsWith('image/'))
      .map((attachment) => ({
        type: 'input_image',
        image_url: attachment.data
          ? `data:${attachment.type};base64,${attachment.data}`
          : (attachment.url as string),
      }));

    return {
      role: message.role as string,
      content: [
        ...(message.content
          ? [{ type: 'input_text', text: message.content } as const]
          : []),
        ...imageParts,
      ],
    };
  }

  async *stream(
    requestBody: ResponsesApiRequestBody,
    token: string,
    signal: AbortSignal,
    initialAssembledMessage: ConversationMessageDto,
    clientChannelId?: string,
    timing?: GenerationRelayTiming,
    conversationId?: string,
  ): AsyncGenerator<string, GenerationRelayOutcome, void> {
    let assembledMessage = initialAssembledMessage;
    let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    try {
      const dialResult = (await this.dialClient.client.createResponse({
        body: requestBody as never,
        headers: {
          ...getBearerAuthHeaders(token),
          Accept: 'text/event-stream',
          ...(clientChannelId
            ? { 'X-DIAL-CLIENT-CHANNEL-ID': clientChannelId }
            : {}),
          ...(conversationId ? { 'X-CONVERSATION-ID': conversationId } : {}),
        },
        parseAs: 'stream',
        signal,
      })) as { response: globalThis.Response; error?: unknown };

      if (!dialResult.response.ok || !dialResult.response.body) {
        let errorMessage = '';

        /* 1. SDK-parsed error — most reliable, SDK reads body before us */
        if (dialResult.error != null) {
          errorMessage = extractDialErrorMessage(dialResult.error) ?? '';
        }

        /* 2. Raw body — for cases where SDK didn't parse it */
        if (!errorMessage) {
          const rawBody = await dialResult.response.text().catch(() => '');
          if (rawBody) {
            try {
              errorMessage = extractDialErrorMessage(JSON.parse(rawBody)) ?? '';
            } catch {
              /* not JSON — fall through to plain-text below */
            }
            /*
             * DIAL Core can return a plain-text body (e.g. "Upstream is
             * missing required id") rather than a JSON error object. Treat
             * the raw text itself as the error candidate, sanitized before
             * it can reach a log line.
             */
            if (!errorMessage) {
              errorMessage = StringUtils.sanitizeForLog(rawBody, 500);
            }
          }
        }

        /*
         * When DIAL Core provides no error text (empty body, non-JSON), leave
         * errorMessage as '' — the frontend localizes a generic fallback via
         * i18n. A non-null streamErrorMessage (even '') still signals the
         * terminal error state for resume detection.
         */
        this.logger.error(
          `DIAL Core rejected Responses request — status: ${dialResult.response.status}${errorMessage ? `: ${errorMessage}` : ''}`,
        );
        return {
          outcome: 'rejected',
          status: dialResult.response.status,
          errorMessage,
          assembledMessage,
        };
      }

      upstreamReader = dialResult.response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      /*
       * `terminalSignal` is the single source of truth for how (and whether)
       * this stream ended. `isDone` only controls when to stop reading the
       * socket — it never implies success on its own; see the post-loop
       * check below.
       */
      let terminalSignal: ResponsesTerminalSignal | null = null;
      let isDone = false;
      const pendingChunks: string[] = [];
      /* Tracks reasoning `item_id`s already opened as a stage, so the
       * synthetic "Thinking" stage name is sent once, not on every delta. */
      const reasoningStageItemIds = new Set<string>();

      const writeChunk = (chunk: NormalizedStreamChunk): void => {
        pendingChunks.push(`data: ${JSON.stringify(chunk)}\n\n`);
        assembledMessage = applyChunkToMessage(assembledMessage, chunk);
      };

      /*
       * Same accumulation as `writeChunk`, but never queued to
       * `pendingChunks` — the reasoning "Thinking" stage is persisted on the
       * assembled message (so it's available in exported/inspected
       * conversation data) without being live-streamed to the browser UI.
       */
      const recordWithoutStreaming = (chunk: NormalizedStreamChunk): void => {
        assembledMessage = applyChunkToMessage(assembledMessage, chunk);
      };

      const handleEvent = (event: ResponsesSseEvent): void => {
        switch (event.type) {
          case 'response.created': {
            const responseId = (event as { response?: { id?: string } })
              .response?.id;
            if (responseId) {
              writeChunk({ choices: [{ delta: { responseId } }] });
            }
            return;
          }
          case 'response.output_text.delta': {
            const delta = (event as { delta?: string }).delta;
            if (delta) {
              if (timing && timing.firstDeltaAt == null) {
                timing.firstDeltaAt = Date.now();
              }
              writeChunk({ choices: [{ delta: { content: delta } }] });
            }
            return;
          }
          case 'response.reasoning_text.delta': {
            /*
             * Records the model's reasoning into the persisted message using
             * the pre-existing `stages` mechanism (see `mergeStages` in
             * `apply-chunk.server.ts`) instead of a new wire concept, but via
             * `recordWithoutStreaming` rather than `writeChunk` — reasoning is
             * kept in the stored conversation data without being shown live in
             * the chat UI. `name` is sent only on the first delta for a given
             * `item_id`; `mergeStages` concatenates `name` on every merge, so
             * repeating it would duplicate the "Thinking" label.
             */
            const delta = (event as { delta?: string; item_id?: string }).delta;
            const itemId = (event as { item_id?: string }).item_id;
            if (delta && itemId) {
              const isFirstDeltaForItem = !reasoningStageItemIds.has(itemId);
              reasoningStageItemIds.add(itemId);
              recordWithoutStreaming({
                choices: [
                  {
                    delta: {
                      custom_content: {
                        stages: [
                          {
                            index: 0,
                            ...(isFirstDeltaForItem && { name: 'Thinking' }),
                            content: delta,
                          },
                        ],
                      },
                    },
                  },
                ],
              });
            }
            return;
          }
          case 'response.completed': {
            const response = (
              event as { response?: { id?: string; status?: string } }
            ).response;
            const responseId = response?.id;
            const status = response?.status;
            /*
             * `status` is normally "completed" — anything else present
             * (a status value DIAL Core doesn't guarantee is always
             * "completed") is treated as a non-terminal-success outcome
             * rather than silently persisted as a successful message.
             */
            if (status != null && status !== 'completed') {
              terminalSignal = {
                state: ResponsesTerminalState.StreamError,
                message: `Responses generation ended with status "${status}"`,
              };
              isDone = true;
              return;
            }
            writeChunk({
              choices: [{ delta: { ...(responseId && { responseId }) } }],
            });
            terminalSignal = { state: ResponsesTerminalState.Success };
            isDone = true;
            return;
          }
          case 'response.failed': {
            /*
             * Preserve any text already assembled from prior deltas — never
             * retried through Chat Completions, and never counted as an
             * unknown event since it is a recognized, handled type.
             */
            terminalSignal = {
              state: ResponsesTerminalState.Failed,
              message:
                extractDialErrorMessage(
                  (event as { response?: { error?: unknown } }).response?.error,
                ) ?? 'Responses generation failed',
            };
            isDone = true;
            return;
          }
          case 'response.incomplete': {
            terminalSignal = {
              state: ResponsesTerminalState.Incomplete,
              message: 'Generation ended incomplete',
            };
            isDone = true;
            return;
          }
          case 'error': {
            terminalSignal = {
              state: ResponsesTerminalState.StreamError,
              message:
                (event as { error?: { message?: string } }).error?.message ??
                (event as { message?: string }).message ??
                'Responses stream error',
            };
            isDone = true;
            return;
          }
          default: {
            /*
             * Never forwarded to the browser and never logged with content —
             * only the event type is recorded, so an unexpected upstream
             * event can't leak prompt/response text into metrics or logs.
             * The type itself is sanitized/truncated first since it is an
             * arbitrary upstream-controlled string — otherwise a malicious
             * or malfunctioning upstream could inject log-control
             * characters or blow up metrics label cardinality.
             */
            const safeType = StringUtils.sanitizeForLog(String(event.type), 64);
            generationUnknownEventsTotal.add(1, { 'event.type': safeType });
            this.logger.debug(
              `responses.adapter unhandled event type: ${safeType}`,
            );
          }
        }
      };

      while (true) {
        const { done, value } = await upstreamReader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (
            !trimmed ||
            trimmed.startsWith(':') ||
            trimmed.startsWith('event:')
          ) {
            continue;
          }
          if (!trimmed.startsWith('data:')) continue;

          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') {
            isDone = true;
            /*
             * `[DONE]` is a backward-compatibility signal for legacy/
             * non-standard upstreams only — it must never override an
             * already-recorded error/incomplete/stream-error signal (a
             * canonical Core stream never needs it: `response.completed`
             * already set `Success` above).
             */
            if (!terminalSignal) {
              terminalSignal = { state: ResponsesTerminalState.Success };
            }
            continue;
          }

          try {
            const parsed = JSON.parse(payload) as ResponsesSseEvent;
            handleEvent(parsed);
            while (pendingChunks.length > 0) {
              yield pendingChunks.shift() as string;
            }
          } catch {
            /* Never log the payload itself — may carry response text. */
            this.logger.debug(
              `responses.adapter malformed chunk — length: ${payload.length}`,
            );
          }
        }

        if (terminalSignal || isDone) break;
      }

      /*
       * A clean socket close (or a legacy `[DONE]`) does not by itself mean
       * the generation succeeded — success requires an explicit
       * `response.completed`/`[DONE]` signal having been recorded above. A
       * non-`Success` signal (response.failed/incomplete/stream-error) is an
       * error; no signal at all (stream ended without any recognized
       * terminal event) is also an error, with a fixed generic message that
       * never echoes prompt or response content.
       */
      if (terminalSignal?.state === ResponsesTerminalState.Success) {
        yield 'data: [DONE]\n\n';
        return { outcome: 'completed', assembledMessage };
      }

      return {
        outcome: 'error',
        error: new Error(terminalSignal?.message ?? GENERIC_TRUNCATED_MESSAGE),
        assembledMessage,
      };
    } catch (err) {
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.name === 'DOMException');
      return isAbort
        ? { outcome: 'aborted', assembledMessage }
        : { outcome: 'error', error: err, assembledMessage };
    } finally {
      if (upstreamReader) {
        try {
          await upstreamReader.cancel();
        } catch {
          /* already closed */
        }
      }
    }
  }

  async relay(
    requestBody: ResponsesApiRequestBody,
    token: string,
    signal: AbortSignal,
    res: Response,
    initialAssembledMessage: ConversationMessageDto,
    clientChannelId?: string,
    timing?: GenerationRelayTiming,
    conversationId?: string,
  ): Promise<GenerationRelayOutcome> {
    const iterator = this.stream(
      requestBody,
      token,
      signal,
      initialAssembledMessage,
      clientChannelId,
      timing,
      conversationId,
    );
    let next = await iterator.next();
    while (!next.done) {
      res.write(next.value);
      next = await iterator.next();
    }
    return next.value;
  }
}
