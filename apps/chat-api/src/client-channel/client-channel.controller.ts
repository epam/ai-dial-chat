import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { FeatureKey } from '../app-config/feature-flags/feature-key.enum';
import { FeatureGuard } from '../app-config/feature-flags/feature.guard';
import { RequireFeature } from '../app-config/feature-flags/require-feature.decorator';
import type { SessionUser } from '../auth/session/session.types';
import { ClientChannelService } from './client-channel.service';
import {
  assertValidChannelId,
  assertValidOptionalChannelId,
} from './client-channel.utils';
import { ReportClientChannelDto } from './dto/report-client-channel.dto';

const CHANNEL_ID_HEADER = 'x-dial-client-channel-id';

@ApiTags('client-channel')
@Controller({ path: 'client-channel', version: '1' })
export class ClientChannelController {
  private readonly logger = new Logger(ClientChannelController.name);

  constructor(private readonly clientChannelService: ClientChannelService) {}

  @Post('subscribe')
  @UseGuards(FeatureGuard)
  @RequireFeature(FeatureKey.LiveChatInteraction)
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'subscribeClientChannel',
    summary: 'Subscribe to the DIAL Core client channel',
    description:
      "Opens an SSE stream proxying DIAL Core's client-channel RPC events " +
      '(e.g. `toolset/signin`) for the authenticated session. Relays the ' +
      'upstream stream without buffering and echoes the assigned ' +
      'X-DIAL-CLIENT-CHANNEL-ID response header. Send the same header on ' +
      'reconnect to resume an existing channel.',
  })
  @ApiHeader({
    name: CHANNEL_ID_HEADER,
    required: false,
    description: 'Existing channel id — send only when reconnecting.',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream of client-channel RPC events',
  })
  @ApiResponse({
    status: 400,
    description: 'The reconnect channel id header is present but invalid',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description: 'The liveChatInteraction feature is not enabled for this user',
  })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core rejected or failed the subscription',
  })
  @ApiResponse({ status: 503, description: 'DIAL Core is unreachable' })
  async subscribe(
    @Req() req: Request,
    @Res() res: Response,
    @Headers(CHANNEL_ID_HEADER) reconnectChannelId: string | undefined,
  ): Promise<void> {
    const { at } = req.user as SessionUser;
    const validReconnectChannelId =
      assertValidOptionalChannelId(reconnectChannelId);
    const abortController = new AbortController();

    const { stream, channelId } = await this.clientChannelService.subscribe(
      at,
      validReconnectChannelId,
      abortController.signal,
    );

    res.setHeader(CHANNEL_ID_HEADER, channelId);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const reader = stream.getReader();
    let isClientAborted = false;
    let isReaderReleased = false;

    const handleClose = () => {
      isClientAborted = true;
      abortController.abort();
      if (!isReaderReleased) {
        void reader.cancel().catch(() => undefined);
      }
    };
    res.on('close', handleClose);

    try {
      while (true) {
        if (isClientAborted) break;

        const { done, value } = await reader.read();
        if (done) break;

        res.write(value);
      }
    } catch (err) {
      if (!isClientAborted) {
        this.logger.error(
          'Error while relaying client-channel events to browser',
          err,
        );
      }
    } finally {
      res.off('close', handleClose);
      isReaderReleased = true;
      reader.releaseLock();
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  @Post('report')
  @UseGuards(FeatureGuard)
  @RequireFeature(FeatureKey.LiveChatInteraction)
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    operationId: 'reportClientChannel',
    summary: 'Report an RPC response on the client channel',
    description:
      'Forwards a `{ id, result }` RPC response (e.g. a toolset sign-in ' +
      'success/denial) to DIAL Core for the given channel, so Core can ' +
      'resume or terminate the blocked tool call.',
  })
  @ApiHeader({
    name: CHANNEL_ID_HEADER,
    required: true,
    description: 'The active client channel id.',
  })
  @ApiResponse({ status: 200, description: 'Report accepted' })
  @ApiResponse({
    status: 400,
    description: 'Missing/invalid channel id header or malformed body',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description: 'The liveChatInteraction feature is not enabled for this user',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  async report(
    @Req() req: Request,
    @Headers(CHANNEL_ID_HEADER) channelId: string | undefined,
    @Body() body: ReportClientChannelDto,
  ): Promise<void> {
    const { at } = req.user as SessionUser;
    const validChannelId = assertValidChannelId(channelId);
    await this.clientChannelService.report(at, validChannelId, body);
  }

  /*
   * Deliberately not gated by @RequireFeature: a client that already has a
   * channel open must always be able to tear it down (e.g. the flag flips
   * off mid-session, or the user logs out), even if the feature is
   * currently disabled or role-restricted for this user.
   */
  @Post('unsubscribe')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    operationId: 'unsubscribeClientChannel',
    summary: 'Unsubscribe from the client channel',
    description:
      'Closes the given client channel on DIAL Core. Treats an already-gone ' +
      'channel (404) as idempotent success.',
  })
  @ApiHeader({
    name: CHANNEL_ID_HEADER,
    required: true,
    description: 'The active client channel id to close.',
  })
  @ApiResponse({ status: 200, description: 'Unsubscribed successfully' })
  @ApiResponse({
    status: 400,
    description: 'Missing or invalid channel id header',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async unsubscribe(
    @Req() req: Request,
    @Headers(CHANNEL_ID_HEADER) channelId: string | undefined,
  ): Promise<void> {
    const { at } = req.user as SessionUser;
    const validChannelId = assertValidChannelId(channelId);
    await this.clientChannelService.unsubscribe(at, validChannelId);
  }
}
