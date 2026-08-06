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
   */
  buildRequest(params: {
    model: string;
    startConversation: ConversationResponseDto;
    messagesForCompletion: ConversationMessageDto[];
    temperatureSupported: boolean;
  }): ResponsesApiRequestBody {
    const {
      model,
      startConversation,
      messagesForCompletion,
      temperatureSupported,
    } = params;

    const systemInput = startConversation.prompt
      ? [{ role: 'system', content: startConversation.prompt }]
      : [];

    const input = [
      ...systemInput,
      ...messagesForCompletion
        .filter((m) => m.role !== ConversationMessageRole.Status)
        .map((m) => ({
          role: m.role as string,
          content: m.content,
        })),
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
    };
  }

  async relay(
    requestBody: ResponsesApiRequestBody,
    token: string,
    signal: AbortSignal,
    res: Response,
    initialAssembledMessage: ConversationMessageDto,
    clientChannelId?: string,
    timing?: GenerationRelayTiming,
  ): Promise<GenerationRelayOutcome> {
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

      const writeChunk = (chunk: NormalizedStreamChunk): void => {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        assembledMessage = applyChunkToMessage(assembledMessage, chunk);
      };

      const handleEvent = (event: ResponsesSseEvent): void => {
        switch (event.type) {
          case 'response.created': {
            const responseId = event.response?.id;
            if (responseId) {
              writeChunk({ choices: [{ delta: { responseId } }] });
            }
            return;
          }
          case 'response.output_text.delta': {
            if (event.delta) {
              if (timing && timing.firstDeltaAt == null) {
                timing.firstDeltaAt = Date.now();
              }
              writeChunk({ choices: [{ delta: { content: event.delta } }] });
            }
            return;
          }
          case 'response.completed': {
            const responseId = event.response?.id;
            const status = event.response?.status;
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
                extractDialErrorMessage(event.response?.error) ??
                'Responses generation failed',
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
                event.error?.message ??
                event.message ??
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
        res.write('data: [DONE]\n\n');
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
}
