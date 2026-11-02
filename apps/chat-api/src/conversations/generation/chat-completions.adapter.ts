import { Injectable, Logger } from '@nestjs/common';
import { extractDialErrorMessage } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import {
  buildConversationIdHeaders,
  buildJobTitleHeaders,
} from '../../common/utils/header-value';
import { StringUtils } from '../../common/utils/string-utils';
import { DialClientService } from '../../dial/dial-client.service';
import type { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from '../dto/conversation-message.dto';
import {
  applyChunkToMessage,
  extractDialStreamError,
  type DialStreamErrorPayload,
} from '../utils/apply-chunk.server';
import type {
  ChatCompletionsRequestBody,
  GenerationRelayOutcome,
  GenerationRelayTiming,
} from './generation.types';

const getValidAttachments = (
  customContent?: ConversationMessageDto['custom_content'],
) =>
  (customContent?.attachments ?? []).filter((attachment) =>
    Boolean(attachment.data || attachment.url),
  );

/*
 * `custom_content.skills[].url` is persisted verbatim from the frontend
 * (e.g. `skills/public/my chats/123`), unlike every other DIAL resource path
 * in this codebase, which is percent-encoded right at the DIAL Core call
 * boundary via `encodeDialResourcePath`. Left unencoded, a path segment with
 * a space or other reserved character makes DIAL Core reject the whole
 * completion request with a 400 — encode here, at the same boundary.
 */
const getEncodedSkills = (
  customContent?: ConversationMessageDto['custom_content'],
) =>
  customContent?.skills?.map((skill) => ({
    ...skill,
    url: encodeDialResourcePath(skill.url),
  }));

/**
 * Chat Completions request/response handling behind the generation adapter
 * seam: builds the request from `buildConversationHistory`'s messages, calls
 * `sendChatCompletionRequest` and parses the SSE chunks.
 * `ConversationStreamingService` uses it for every deployment that doesn't
 * resolve to `GenerationApi.Responses`.
 */
@Injectable()
export class ChatCompletionsAdapter {
  private readonly logger = new Logger(ChatCompletionsAdapter.name);

  constructor(private readonly dialClient: DialClientService) {}

  buildRequest(params: {
    startConversation: ConversationResponseDto;
    messagesForCompletion: ConversationMessageDto[];
    temperatureSupported: boolean;
    configuration?: Record<string, unknown>;
  }): ChatCompletionsRequestBody {
    const {
      startConversation,
      messagesForCompletion,
      temperatureSupported,
      configuration,
    } = params;

    const dialMessages = messagesForCompletion
      .filter((m) => m.role !== ConversationMessageRole.Status)
      .map((m) => {
        const validAttachments = getValidAttachments(m.custom_content);
        const encodedSkills = getEncodedSkills(m.custom_content);
        const content = Object.fromEntries(
          Object.entries({
            ...m.custom_content,
            attachments: validAttachments.length ? validAttachments : undefined,
            skills: encodedSkills?.length ? encodedSkills : undefined,
            configuration_value: undefined,
            stages: undefined,
          }).filter(([, value]) => value != null),
        );
        return {
          role: m.role,
          content: m.content,
          ...(Object.keys(content).length > 0
            ? { custom_content: content }
            : {}),
        };
      });

    const systemMessages = startConversation.prompt
      ? [{ role: 'system', content: startConversation.prompt }]
      : [];

    return {
      messages: [...systemMessages, ...dialMessages],
      stream: true,
      ...(temperatureSupported &&
        startConversation.temperature != null && {
          temperature: startConversation.temperature,
        }),
      ...(configuration ? { custom_fields: { configuration } } : {}),
    };
  }

  /**
   * Calls the model, yielding the raw SSE response bytes as they arrive, and
   * builds up `assembledMessage` from the parsed chunks. The generator's
   * return value (available once iteration completes) carries the outcome.
   * Log lines keep the `relayModelCompletion` prefix this relay had inside
   * `ConversationStreamingService`, so existing log searches still match.
   */
  async *stream(
    model: string,
    requestBody: unknown,
    token: string,
    signal: AbortSignal,
    initialAssembledMessage: ConversationMessageDto,
    clientChannelId?: string,
    timezone?: string,
    timing?: GenerationRelayTiming,
    conversationId?: string,
    onChunkApplied?: (
      rawChunk: unknown,
      message: ConversationMessageDto,
    ) => void,
    jobTitle?: string,
    options?: {
      /** Added to the model call, e.g. `x-project-id` for a project conversation. */
      extraHeaders?: Record<string, string>;
    },
  ): AsyncGenerator<Uint8Array, GenerationRelayOutcome, void> {
    let assembledMessage = initialAssembledMessage;
    let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    const cancelUpstreamOnAbort = (): void => {
      void upstreamReader?.cancel().catch(() => undefined);
    };

    try {
      const dialResult =
        (await this.dialClient.client.sendChatCompletionRequest(model, {
          body: requestBody as never,
          headers: {
            ...getBearerAuthHeaders(token),
            Accept: 'text/event-stream',
            ...(clientChannelId
              ? { 'X-DIAL-CLIENT-CHANNEL-ID': clientChannelId }
              : {}),
            ...(timezone ? { 'X-Timezone': timezone } : {}),
            ...buildConversationIdHeaders(conversationId),
            ...buildJobTitleHeaders(jobTitle),
            ...options?.extraHeaders,
          },
          params: { query: { 'api-version': this.dialClient.dialApiVersion } },
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
          try {
            const rawBody = await dialResult.response.text();
            errorMessage = extractDialErrorMessage(JSON.parse(rawBody)) ?? '';
          } catch {
            /* non-JSON or empty body */
          }
        }

        /*
         * When DIAL Core provides no error text (empty body, non-JSON), leave
         * errorMessage as '' — the frontend localizes a generic fallback via
         * i18n. A non-null streamErrorMessage (even '') still signals the
         * terminal error state for resume detection.
         */
        /*
         * Every upstream-derived message — SDK-parsed, JSON-extracted, or raw
         * text — is sanitized before it reaches the log line; the returned
         * `errorMessage` itself stays unmodified for the client.
         */
        const safeErrorMessage = StringUtils.sanitizeForLog(errorMessage, 500);
        this.logger.error(
          `DIAL Core rejected completion request — model: ${StringUtils.sanitizeForLog(model)}, status: ${dialResult.response.status}${safeErrorMessage ? `: ${safeErrorMessage}` : ''}`,
        );
        return {
          outcome: 'rejected',
          status: dialResult.response.status,
          errorMessage,
          assembledMessage,
        };
      }

      upstreamReader = dialResult.response.body.getReader();
      signal.addEventListener('abort', cancelUpstreamOnAbort, { once: true });
      if (signal.aborted) cancelUpstreamOnAbort();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let receivedDone = false;
      let streamError: DialStreamErrorPayload | null = null;

      while (true) {
        const { done, value } = await upstreamReader.read();
        if (signal.aborted) {
          return { outcome: 'aborted', assembledMessage };
        }
        if (done) {
          this.logger.debug(
            `relayModelCompletion upstream socket closed without [DONE] — model: ${model}`,
          );
          break;
        }

        yield value;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed.startsWith('data:')) {
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') {
              receivedDone = true;
              continue;
            }
            try {
              const parsed: unknown = JSON.parse(payload);
              const errorPayload = extractDialStreamError(parsed);
              if (errorPayload) {
                /*
                 * DIAL Core signals a mid-stream failure (e.g. a QuickApp's
                 * downstream tool call couldn't reach its upstream server)
                 * with a `{ error: {...} }` chunk instead of the usual
                 * `choices`-shaped delta, immediately followed by `[DONE]`.
                 * Treat it the same as a genuine stream error rather than
                 * letting it fall through `applyChunkToMessage` (which
                 * silently ignores it) and persisting an empty, non-error
                 * "completed" message.
                 */
                streamError = errorPayload;
                break;
              }
              const hasContent = Boolean(
                (parsed as { choices?: { delta?: { content?: string } }[] })
                  ?.choices?.[0]?.delta?.content,
              );
              if (hasContent && timing && timing.firstDeltaAt == null) {
                timing.firstDeltaAt = Date.now();
              }
              assembledMessage = applyChunkToMessage(assembledMessage, parsed);
              onChunkApplied?.(parsed, assembledMessage);
            } catch {
              /*
               * Never log the payload itself here — chunk content is
               * conversation text, and this fires once per malformed chunk
               * rather than once per stream, so it must not become a
               * per-token content log at debug level.
               */
              this.logger.debug(
                `relayModelCompletion malformed chunk — model: ${model}, length: ${payload.length}`,
              );
            }
          }
        }

        if (streamError) break;

        /*
         * `[DONE]` is the SSE completion signal. Stop here rather than waiting
         * for the upstream socket to close — some providers keep the connection
         * open after `[DONE]`, which would otherwise leave this generation
         * registered as active and reject the next request (e.g. regenerate)
         * with a 409 conflict.
         */
        if (receivedDone) {
          this.logger.debug(
            `relayModelCompletion received [DONE] — model: ${model}`,
          );
          break;
        }
      }

      if (streamError) {
        this.logger.debug(
          `relayModelCompletion outcome: error (in-band stream error chunk) — model: ${model}: ${streamError.message}`,
        );
        const displayMessage =
          streamError.displayMessage ?? streamError.message;
        return {
          outcome: 'error',
          error: new Error(displayMessage),
          displayMessage,
          assembledMessage,
        };
      }

      this.logger.debug(
        `relayModelCompletion outcome: completed — model: ${model}, assembledContentLength: ${assembledMessage.content?.length ?? 0}`,
      );
      return { outcome: 'completed', assembledMessage };
    } catch (err) {
      const isAbort =
        signal.aborted ||
        (err instanceof Error &&
          (err.name === 'AbortError' || err.name === 'DOMException'));
      this.logger.debug(
        `relayModelCompletion outcome: ${isAbort ? 'aborted' : 'error'} — model: ${model}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return isAbort
        ? { outcome: 'aborted', assembledMessage }
        : { outcome: 'error', error: err, assembledMessage };
    } finally {
      signal.removeEventListener('abort', cancelUpstreamOnAbort);
      if (upstreamReader) {
        try {
          /*
           * cancel() (not releaseLock) so the upstream connection is closed
           * when we stop early on `[DONE]`, instead of being left dangling.
           */
          await upstreamReader.cancel();
        } catch {
          /* already closed */
        }
      }
    }
  }
}
