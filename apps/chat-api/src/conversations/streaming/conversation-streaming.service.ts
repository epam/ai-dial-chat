import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  extractDialErrorMessage,
  handleDialSdkError,
} from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { StringUtils } from '../../common/utils/string-utils';
import { DeploymentsService } from '../../deployments/deployments.service';
import { DialClientService } from '../../dial/dial-client.service';
import {
  ConversationGenerationService,
  GenerationStatus,
} from '../conversation-generation.service';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from '../dto/conversation-message.dto';
import { MessageCustomContentDto } from '../dto/message-custom-content.dto';
import { CompletionMode } from '../dto/send-completion.dto';
import {
  GenerationApi,
  resolveGenerationApi,
} from '../generation/generation-api';
import {
  generationCapabilityResolutionTotal,
  generationRequestsTotal,
  generationStreamDuration,
  generationTimeToFirstDelta,
} from '../generation/generation-metrics';
import type { GenerationRelayTiming } from '../generation/generation.types';
import { ResponsesAdapter } from '../generation/responses.adapter';
import { ConversationPersistenceService } from '../persistence/conversation-persistence.service';
import {
  applyChunkToMessage,
  extractDialStreamError,
  type DialStreamErrorPayload,
} from '../utils/apply-chunk.server';
import { buildConversationHistory } from '../utils/conversation-history-builder';
import {
  buildConversationUrl,
  qualifySessionConversationPath,
  resolveConversationLocation,
} from '../utils/conversation.utils';

const getValidAttachments = (
  customContent?: ConversationMessageDto['custom_content'],
) =>
  (customContent?.attachments ?? []).filter((attachment) =>
    Boolean(attachment.data || attachment.url),
  );

type RelayOutcome =
  | {
      outcome: 'rejected';
      status: number;
      errorMessage: string;
      assembledMessage: ConversationMessageDto;
    }
  | { outcome: 'completed'; assembledMessage: ConversationMessageDto }
  | { outcome: 'aborted'; assembledMessage: ConversationMessageDto }
  | {
      outcome: 'error';
      error: unknown;
      assembledMessage: ConversationMessageDto;
    };

@Injectable()
export class ConversationStreamingService {
  private readonly logger = new Logger(ConversationStreamingService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly generationService: ConversationGenerationService,
    private readonly persistenceService: ConversationPersistenceService,
    private readonly deploymentsService: DeploymentsService,
    private readonly responsesAdapter: ResponsesAdapter,
  ) {}

  private async resolveGenerationApiForDeployment(
    sub: string,
    model: string,
    token: string,
  ): Promise<{ generationApi: GenerationApi; temperatureSupported: boolean }> {
    const details = await this.deploymentsService.getDeploymentDetails(
      sub,
      model,
      token,
    );

    if (details.type === 'toolset') {
      const safeModel = StringUtils.sanitizeForLog(model);
      throw new BadRequestException(
        `Deployment "${safeModel}" is a toolset and cannot be used for generation`,
      );
    }

    const features =
      details.type === 'application'
        ? details.applicationDetails?.features
        : details.modelDetails?.features;

    return {
      generationApi: resolveGenerationApi(features),
      temperatureSupported: features?.temperature === true,
    };
  }

  async watchConversation(
    conversationPath: string,
    token: string,
    sessionBucket: string,
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
   * Calls the model, yielding the raw SSE response bytes as they arrive, and
   * builds up `assembledMessage` from the parsed chunks. The generator's
   * return value (available once iteration completes) carries the outcome.
   * Used by `streamCompletion`.
   */
  private async *relayModelCompletion(
    model: string,
    requestBody: unknown,
    token: string,
    signal: AbortSignal,
    initialAssembledMessage: ConversationMessageDto,
    clientChannelId?: string,
    timing?: GenerationRelayTiming,
  ): AsyncGenerator<Uint8Array, RelayOutcome, void> {
    let assembledMessage = initialAssembledMessage;
    let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

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
        this.logger.error(
          `DIAL Core rejected completion request — model: ${model}, status: ${dialResult.response.status}${errorMessage ? `: ${errorMessage}` : ''}`,
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
      let receivedDone = false;
      let streamError: DialStreamErrorPayload | null = null;

      while (true) {
        const { done, value } = await upstreamReader.read();
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
        return {
          outcome: 'error',
          error: new Error(streamError.displayMessage ?? streamError.message),
          assembledMessage,
        };
      }

      this.logger.debug(
        `relayModelCompletion outcome: completed — model: ${model}, assembledContentLength: ${assembledMessage.content?.length ?? 0}`,
      );
      return { outcome: 'completed', assembledMessage };
    } catch (err) {
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.name === 'DOMException');
      this.logger.debug(
        `relayModelCompletion outcome: ${isAbort ? 'aborted' : 'error'} — model: ${model}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return isAbort
        ? { outcome: 'aborted', assembledMessage }
        : { outcome: 'error', error: err, assembledMessage };
    } finally {
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

  /**
   * Streams a chat completion as raw SSE bytes. The caller (controller) is
   * responsible for the HTTP transport: it must call `onReadyToStream` at
   * the point the caller wants SSE response headers sent — mirroring the
   * exact point the pre-split implementation used to call
   * `res.setHeader(...)`/`res.flushHeaders()` — then write each yielded
   * chunk to the response and end it once iteration completes.
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
    sessionId: string,
    onReadyToStream: () => void,
    sub: string,
    clientChannelId?: string,
  ): AsyncGenerator<Uint8Array | string, void, void> {
    this.logger.debug(
      `streamCompletion start — model: ${model}, bucket: ${bucket}, path: ${conversationPath}, mode: ${mode}`,
    );

    const abortController = this.generationService.register(
      sessionId,
      conversationPath,
      generationId,
    );

    let generationApi: GenerationApi;
    let temperatureSupported: boolean;
    try {
      ({ generationApi, temperatureSupported } =
        await this.resolveGenerationApiForDeployment(sub, model, token));
      generationCapabilityResolutionTotal.add(1, {
        outcome: 'resolved',
        'generation.api': generationApi,
      });
    } catch (err) {
      generationCapabilityResolutionTotal.add(1, { outcome: 'failed' });
      this.generationService.error(sessionId, conversationPath, generationId);
      throw err;
    }

    let startState: ReturnType<typeof buildConversationHistory>;
    try {
      const fetchedConversation = await this.persistenceService.getConversation(
        qualifySessionConversationPath(conversationPath, bucket),
        token,
        bucket,
      );
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
       */
      this.generationService.error(sessionId, conversationPath, generationId);
      throw err;
    }

    const { conversation: startConversation, assistantMessageIndex } =
      startState;

    try {
      await this.persistenceService.saveConversation(
        conversationPath,
        token,
        bucket,
        startConversation,
      );
    } catch (err) {
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

    const dialMessages = messagesForCompletion
      .filter((m) => m.role !== ConversationMessageRole.Status)
      .map((m) => {
        const validAttachments = getValidAttachments(m.custom_content);
        const content = Object.fromEntries(
          Object.entries({
            ...m.custom_content,
            attachments: validAttachments.length ? validAttachments : undefined,
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

    const requestBody = {
      messages: [...systemMessages, ...dialMessages],
      stream: true,
      ...(startConversation.temperature != null && {
        temperature: startConversation.temperature,
      }),
      ...(configuration ? { custom_fields: { configuration } } : {}),
    };

    this.logger.debug(
      `streamCompletion sending ${dialMessages.length} message(s) to model: ${model}`,
    );

    onReadyToStream();

    const assembledMessage = {
      ...startConversation.messages[assistantMessageIndex],
    };

    const finalize = async (
      status:
        | GenerationStatus.Done
        | GenerationStatus.Stopped
        | GenerationStatus.Error,
      partialMessage: ConversationMessageDto,
    ): Promise<void> => {
      const finalConversation = {
        ...startConversation,
        messages: [
          ...startConversation.messages.slice(0, assistantMessageIndex),
          partialMessage,
        ],
      };
      try {
        await this.persistenceService.saveConversation(
          conversationPath,
          token,
          bucket,
          finalConversation,
        );
      } catch (err) {
        this.logger.warn(`Failed to save ${status} conversation`, err);
      }
      if (status === GenerationStatus.Done) {
        this.generationService.complete(
          sessionId,
          conversationPath,
          generationId,
        );
      } else {
        this.generationService.error(sessionId, conversationPath, generationId);
      }
    };

    const streamStartedAt = Date.now();
    const timing: GenerationRelayTiming = {};
    const relayIterator =
      generationApi === GenerationApi.Responses
        ? this.responsesAdapter.stream(
            this.responsesAdapter.buildRequest({
              model,
              startConversation,
              messagesForCompletion,
              temperatureSupported,
            }),
            token,
            abortController.signal,
            assembledMessage,
            clientChannelId,
            timing,
          )
        : this.relayModelCompletion(
            model,
            requestBody,
            token,
            abortController.signal,
            assembledMessage,
            clientChannelId,
            timing,
          );
    let next = await relayIterator.next();
    while (!next.done) {
      yield next.value;
      next = await relayIterator.next();
    }
    const relayResult = next.value;

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
          this.generationService.getStatus(sessionId, conversationPath) ===
          GenerationStatus.Stopped;
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
        const errorMessage =
          relayResult.error instanceof Error ? relayResult.error.message : '';
        const partialMsg = {
          ...relayResult.assembledMessage,
          streamErrorMessage: errorMessage,
        } as ConversationMessageDto;
        await finalize(GenerationStatus.Error, partialMsg);
        break;
      }
    }
  }
}
