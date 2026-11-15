import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { ApiDialCoreErrors } from '../common/dial/api-dial-core-errors.decorator';
import {
  SSE_DRAIN_TIMEOUT_MS,
  SSE_KEEPALIVE_PAYLOAD,
  startSseResponse,
  waitForDrain,
  writeSseChunk,
} from '../common/utils/sse';
import {
  SseSubscriptionKind,
  trackSseSubscription,
} from '../telemetry/runtime-metrics';
import { ConversationService } from './conversation.service';
import { WatchConversationBodyDto } from './dto/watch-conversation.dto';
import { SSE_KEEPALIVE_INTERVAL_MS } from './streaming/conversation-completions.responder';

/**
 * Relays DIAL Core resource events for one conversation as SSE. A sibling of
 * `ConversationController` on the same `conversations` v1 path, split out by
 * route group (see `openspec/changes/split-conversation-controller/design.md` D1).
 */
@ApiTags('conversations')
@Controller({ path: 'conversations', version: '1' })
export class ConversationWatchController {
  private readonly logger = new Logger(ConversationWatchController.name);

  constructor(private readonly conversationService: ConversationService) {}

  @Post('watch')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'watchConversation',
    summary: 'Subscribe to conversation resource updates via SSE',
    description:
      'Opens an SSE stream that proxies DIAL Core resource-update events for the given conversation path. Used by the frontend to detect when LLM naming completes.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({ status: 200, description: 'SSE stream of resource events' })
  @ApiResponse({ status: 400, description: 'Invalid or missing path' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 502, description: 'DIAL Core subscription failed' })
  async watchConversation(
    @Req() req: Request,
    @Res() res: Response,
    @Body() dto: WatchConversationBodyDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    const finishSubscription = trackSseSubscription(
      SseSubscriptionKind.ConversationWatch,
    );

    const abortController = new AbortController();
    let isClientAborted = false;
    let isReaderReleased = false;
    let isCancelRequested = false;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    const handleClose = () => {
      isClientAborted = true;
      abortController.abort();
      if (isReaderReleased || isCancelRequested || !reader) {
        return;
      }

      isCancelRequested = true;
      void reader.cancel().catch(() => undefined);
    };

    res.on('close', handleClose);

    try {
      const stream = await this.conversationService.watchConversation(
        dto.path,
        at,
        bucket,
        abortController.signal,
      );

      if (isClientAborted) {
        await stream.cancel().catch(() => undefined);
        return;
      }

      startSseResponse(res);

      reader = stream.getReader();

      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
      try {
        keepaliveTimer = setInterval(() => {
          if (!isClientAborted && !res.writableEnded) {
            writeSseChunk(res, SSE_KEEPALIVE_PAYLOAD);
          }
        }, SSE_KEEPALIVE_INTERVAL_MS);

        while (true) {
          if (isClientAborted) break;

          const { done, value } = await reader.read();
          if (done) break;

          const { needsDrain } = writeSseChunk(res, value);
          if (needsDrain) {
            const outcome = await waitForDrain(
              res,
              abortController.signal,
              SSE_DRAIN_TIMEOUT_MS,
            );
            if (outcome === 'timeout') {
              isClientAborted = true;
              void reader.cancel().catch(() => undefined);
              break;
            }
            if (outcome === 'aborted') break;
          }
        }
      } catch (err) {
        if (!isClientAborted) {
          this.logger.error(
            'Error while streaming watch events to client',
            err,
          );
        }
      } finally {
        if (keepaliveTimer) clearInterval(keepaliveTimer);
        isReaderReleased = true;
        reader.releaseLock();
        if (!res.writableEnded) {
          res.end();
        }
      }
    } finally {
      res.off('close', handleClose);
      finishSubscription();
    }
  }
}
