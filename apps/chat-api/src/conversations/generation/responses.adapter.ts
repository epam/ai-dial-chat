import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
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
import type {
  GenerationRelayOutcome,
  GenerationRelayTiming,
  NormalizedStreamChunk,
  ResponsesApiRequestBody,
  ResponsesSseEvent,
} from './generation.types';

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
   */
  buildRequest(params: {
    model: string;
    startConversation: ConversationResponseDto;
    messagesForCompletion: ConversationMessageDto[];
  }): ResponsesApiRequestBody {
    const { model, startConversation, messagesForCompletion } = params;

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

    return {
      model,
      input,
      stream: true,
      store: false,
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
        this.logger.error(
          `DIAL Core rejected Responses request — status: ${dialResult.response.status}`,
        );
        return {
          outcome: 'rejected',
          status: dialResult.response.status,
          errorMessage: '',
          assembledMessage,
        };
      }

      upstreamReader = dialResult.response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let terminalError: string | null = null;
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
              terminalError = `Responses generation ended with status "${status}"`;
              return;
            }
            writeChunk({
              choices: [{ delta: { ...(responseId && { responseId }) } }],
            });
            isDone = true;
            return;
          }
          case 'response.incomplete': {
            terminalError = 'Generation ended incomplete';
            return;
          }
          case 'error': {
            terminalError =
              event.error?.message ?? event.message ?? 'Responses stream error';
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

        if (terminalError || isDone) break;
      }

      if (terminalError) {
        return {
          outcome: 'error',
          error: new Error(terminalError),
          assembledMessage,
        };
      }

      res.write('data: [DONE]\n\n');
      return { outcome: 'completed', assembledMessage };
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
