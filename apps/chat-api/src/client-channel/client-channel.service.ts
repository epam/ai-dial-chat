import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import {
  handleDialFetchError,
  handleDialSdkError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { DialClientService } from '../dial/dial-client.service';
import type { ReportClientChannelDto } from './dto/report-client-channel.dto';

const CHANNEL_ID_HEADER = 'X-DIAL-CLIENT-CHANNEL-ID';

export interface ClientChannelSubscription {
  stream: ReadableStream<Uint8Array>;
  channelId: string;
}

/**
 * Proxies DIAL Core's client-channel RPC mechanism
 * (`/v1/ops/client-channel/{subscribe,report,unsubscribe}`) so a `toolset/signin`
 * event raised mid-completion can reach the browser and the browser's
 * response can reach Core, without ever exposing the session access token to
 * frontend JavaScript.
 *
 * Never logs full RPC request/response payloads — only the channel id and
 * event id, matching `ToolsetsService.loginToolset`'s logging discipline.
 */
@Injectable()
export class ClientChannelService {
  private readonly logger = new Logger(ClientChannelService.name);

  constructor(private readonly dialClient: DialClientService) {}

  async subscribe(
    token: string,
    reconnectChannelId: string | undefined,
    signal: AbortSignal,
  ): Promise<ClientChannelSubscription> {
    const startedAt = Date.now();
    this.logger.debug(
      `[timing] ${reconnectChannelId ? `Subscribing to client channel (reconnect: ${reconnectChannelId})` : 'Subscribing to a new client channel'} — calling DIAL Core now`,
    );

    try {
      const { response } = (await this.dialClient.client.subscribeClientChannel(
        {
          headers: {
            ...getBearerAuthHeaders(token),
            Accept: 'text/event-stream',
            ...(reconnectChannelId
              ? { [CHANNEL_ID_HEADER]: reconnectChannelId }
              : {}),
          },
          parseAs: 'stream',
          signal,
        },
      )) as { response: globalThis.Response; error?: unknown };

      const elapsedMs = Date.now() - startedAt;

      if (!response.ok || !response.body) {
        this.logger.warn(
          `[timing] DIAL Core rejected client-channel subscribe after ${elapsedMs}ms — status: ${response.status}`,
        );
        return handleDialSdkError(
          { status: response.status },
          'client-channel.subscribe',
          this.logger,
        );
      }

      /*
       * Core sets the channel id header only when it creates a channel. On a
       * reconnect it resumes the channel named in the request and answers
       * without the header, so the id the browser sent is the channel id.
       */
      const channelId =
        response.headers.get(CHANNEL_ID_HEADER) ?? reconnectChannelId;
      if (!channelId) {
        this.logger.error(
          `[timing] DIAL Core client-channel subscribe response is missing the channel id header after ${elapsedMs}ms`,
        );
        /*
         * Header names only — their values may carry cookies — plus the
         * content type and redirect flag, which tell a proxy or login page
         * that answered in Core's place from a Core response without the header.
         */
        this.logger.debug(
          `Client-channel subscribe response has no ${CHANNEL_ID_HEADER} — status: ${response.status}, content-type: ${response.headers.get('content-type') ?? 'none'}, redirected: ${response.redirected}, response headers: ${[...response.headers.keys()].join(', ') || 'none'}`,
        );
        /* The controller never reads this stream, so release the upstream connection here. */
        await response.body.cancel().catch(() => undefined);
        throw new BadGatewayException(
          'DIAL Core did not return a client channel id',
        );
      }

      this.logger.debug(
        `[timing] Subscribed to client channel: ${channelId} — DIAL Core responded after ${elapsedMs}ms`,
      );
      return { stream: response.body, channelId };
    } catch (err) {
      this.logger.debug(
        `[timing] client-channel subscribe fetch threw after ${Date.now() - startedAt}ms`,
      );
      return handleDialFetchError(err, 'client-channel.subscribe', this.logger);
    }
  }

  async report(
    token: string,
    channelId: string,
    body: ReportClientChannelDto,
  ): Promise<void> {
    this.logger.debug(
      `Reporting client-channel RPC response — channel: ${channelId}, event: ${body.id}, result: ${body.result}`,
    );

    try {
      const response = await this.dialClient.client.reportClientChannel({
        headers: {
          ...getBearerAuthHeaders(token),
          [CHANNEL_ID_HEADER]: channelId,
        },
        body: {
          jsonrpc: '2.0',
          id: body.id,
          result: body.result,
        } as never,
      });
      if (response.error) {
        return mapDialHttpStatus(
          response.response.status,
          'client-channel.report',
          this.logger,
        );
      }
      this.logger.debug(
        `Reported client-channel RPC response — channel: ${channelId}, event: ${body.id}`,
      );
    } catch (err) {
      return handleDialFetchError(err, 'client-channel.report', this.logger);
    }
  }

  async unsubscribe(token: string, channelId: string): Promise<number> {
    const startedAt = Date.now();
    this.logger.debug(
      `Unsubscribing client channel: ${channelId} — calling DIAL Core now`,
    );

    try {
      const response = await this.dialClient.client.unsubscribeClientChannel({
        headers: {
          ...getBearerAuthHeaders(token),
          [CHANNEL_ID_HEADER]: channelId,
        },
      });
      const status = response.response.status;
      this.logger.debug(
        `Client-channel unsubscribe completed — channel: ${channelId}, DIAL Core status: ${status}, already absent: ${status === 404}, elapsed: ${Date.now() - startedAt}ms`,
      );
      return status;
    } catch (err) {
      this.logger.debug(
        `Client-channel unsubscribe failed — channel: ${channelId}, elapsed: ${Date.now() - startedAt}ms`,
      );
      return handleDialFetchError(
        err,
        'client-channel.unsubscribe',
        this.logger,
      );
    }
  }
}
