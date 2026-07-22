import { Injectable, Logger } from '@nestjs/common';
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
    this.logger.debug(
      reconnectChannelId
        ? `Subscribing to client channel (reconnect: ${reconnectChannelId})`
        : 'Subscribing to a new client channel',
    );

    try {
      const result = (await this.dialClient.client.subscribeClientChannel({
        headers: {
          ...getBearerAuthHeaders(token),
          Accept: 'text/event-stream',
          ...(reconnectChannelId
            ? { [CHANNEL_ID_HEADER]: reconnectChannelId }
            : {}),
        },
        parseAs: 'stream',
        signal,
      })) as { response: globalThis.Response; error?: unknown };

      if (!result.response.ok || !result.response.body) {
        this.logger.warn(
          `DIAL Core rejected client-channel subscribe — status: ${result.response.status}`,
        );
        return handleDialSdkError(
          { status: result.response.status },
          'client-channel.subscribe',
          this.logger,
        );
      }

      const channelId = result.response.headers.get(CHANNEL_ID_HEADER);
      if (!channelId) {
        this.logger.error(
          'DIAL Core client-channel subscribe response is missing the channel id header',
        );
        return handleDialSdkError(
          { status: 502 },
          'client-channel.subscribe',
          this.logger,
        );
      }

      this.logger.debug(`Subscribed to client channel: ${channelId}`);
      return { stream: result.response.body, channelId };
    } catch (err) {
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

  async unsubscribe(token: string, channelId: string): Promise<void> {
    this.logger.debug(`Unsubscribing client channel: ${channelId}`);

    try {
      const response = await this.dialClient.client.unsubscribeClientChannel({
        headers: {
          ...getBearerAuthHeaders(token),
          [CHANNEL_ID_HEADER]: channelId,
        },
      });
      /*
       * A 404 means Core already dropped the channel (e.g. it expired) —
       * treat it as the idempotent success it represents, mirroring
       * `ToolsetsService.logoutToolset`'s handling of an already-signed-out
       * credential.
       */
      if (response.error && response.response.status !== 404) {
        return mapDialHttpStatus(
          response.response.status,
          'client-channel.unsubscribe',
          this.logger,
        );
      }
      this.logger.debug(`Unsubscribed client channel: ${channelId}`);
    } catch (err) {
      return handleDialFetchError(
        err,
        'client-channel.unsubscribe',
        this.logger,
      );
    }
  }
}
